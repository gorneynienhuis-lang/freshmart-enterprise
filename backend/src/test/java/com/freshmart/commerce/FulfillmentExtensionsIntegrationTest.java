package com.freshmart.commerce;

import com.freshmart.checkout.*;
import com.freshmart.common.*;
import com.freshmart.identity.AuthenticationService;
import com.freshmart.identity.IdentityMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.*;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.freshmart.commerce.CommerceModels.*;
import static com.freshmart.commerce.CommerceService.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP guards, relational transactions and concurrent row locks in H2 MySQL mode. */
@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.url=jdbc:h2:mem:fulfillment;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
 "spring.datasource.username=sa","spring.datasource.password=","app.token-secret=fulfillment-test-only-secret-not-a-runtime-secret-123456789",
 "app.sandbox-enabled=true","app.sandbox-secret=fulfillment-channel-test-only-secret-not-a-runtime-secret-987654321","app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
class FulfillmentExtensionsIntegrationTest {
 static final AtomicLong PHONES=new AtomicLong(13400000000L),SLOTS=new AtomicLong();
 static final String CONTACT_PHONE="13800138000",CONTACT_NAME="独立收件测试人",CONTACT_DETAIL="东华大学合成配送地址2999号";
 @Autowired CommerceService service;@Autowired FulfillmentService fulfillment;@Autowired CommerceMapper db;@Autowired FulfillmentMapper extra;
 @Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;@Autowired AuthenticationService auth;@Autowired IdentityMapper identities;
 @Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired MockMvc mvc;
 record Account(RequestActor actor,String token){}
 Account member,picker,courier,otherPicker,otherCourier,supportA,supportB;
 CheckoutModels.AddressView address;CheckoutModels.SlotRow slot;String sku,originalBatch;
 @BeforeEach void seed(){
  // Prior test workers are retained but removed from the new test's assignment pool.
  jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE user_id IN (SELECT user_id FROM fm_user_role WHERE role_code='SERVICE')");
  member=account("MEMBER");picker=account("PICKER");courier=account("COURIER");otherPicker=account("PICKER");otherCourier=account("COURIER");supportA=account("SERVICE");supportB=account("SERVICE");
  address=checkout.createAddress(member.actor().userId(),new CheckoutModels.AddressInput(CONTACT_NAME,CONTACT_PHONE,"上海市","上海市","松江区",CONTACT_DETAIL,true));
  Instant start=LocalDate.now(CheckoutService.ZONE).plusDays(1).atTime(14,0).atZone(CheckoutService.ZONE).toInstant().plusSeconds(SLOTS.incrementAndGet());
  slot=new CheckoutModels.SlotRow(id("slot"),LocalDate.now(CheckoutService.ZONE).plusDays(1),"14:00–17:00",start,start.plusSeconds(10800),start,30,0,true,0);checkoutDb.insertSlot(slot);
  String cat=id("cat"),product=id("spu");sku=id("sku");originalBatch=id("batch");
  jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'生鲜','鲜','http://localhost:8080/catalog/S001.jpg')",cat,cat);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'测试水果','独立履约商品','上海','COLD','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,cat);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url,status) VALUES(?,?,?,'一件','件','PIECE','BY_PIECE',NULL,1000,900,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
  batch(originalBatch,sku,20,start.plusSeconds(12*86400),Instant.now().minusSeconds(86400));
 }
 Account account(String role){var issued=auth.register(Long.toString(PHONES.incrementAndGet()),"Fulfillment-test-only-password-2026!",role);String id=issued.body().user().userId();if(!role.equals("MEMBER")){jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",id);jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,?)",id,role);}return new Account(auth.authenticate(issued.body().accessToken()),issued.body().accessToken());}
 void batch(String id,String sku,long quantity,Instant expiry,Instant received){jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'warehouse-main',?,?,'NORMAL',?,0,0)",id,sku,id,Timestamp.from(received),Timestamp.from(expiry),quantity);}
 String order(){var q=checkout.quote(member.actor().userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,3L)),address.addressId(),slot.slotId(),null));return string(service.create(member.actor(),new CreateOrder(q.quoteId(),q.quoteToken(),null)),"orderId");}
 OrderRow claimed(){String id=order();var payment=service.prepay(member.actor(),new Prepay(id,"ORDER",null));service.simulate(member.actor(),string(payment,"paymentId"),new Simulate("SUCCESS",number(payment,"version")));var order=db.order(id);service.claim(picker.actor(),order.pickTaskId,new Version(order.version));return db.order(id);}
 OrderRow delivering(){var order=claimed();var allocation=db.allocations(order.orderId).getFirst();service.confirmPick(picker.actor(),order.pickTaskId,new PickConfirm(List.of(new PickLine(allocation.allocationId,3L,"NORMAL","正常实拣")),order.version));order=db.order(order.orderId);service.dispatch(picker.actor(),order.deliveryTaskId,new Dispatch(courier.actor().userId(),order.version));return db.order(order.orderId);}
 long quantity(String batch,String column){return jdbc.queryForObject("SELECT "+column+" FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch);}
 JsonNode data(MvcResult result)throws Exception{return json.readTree(result.getResponse().getContentAsString()).path("data");}
 String key(){return UUID.randomUUID().toString();}
 MvcResult postAs(Account actor,String route,Object body,String key,int expected)throws Exception{return mvc.perform(post(route).header("Authorization","Bearer "+actor.token()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().is(expected)).andReturn();}
 Reallocate reallocation(OrderRow order,String batch,long quantity){return new Reallocate(List.of(new ReallocateLine(db.allocations(order.orderId).getFirst().orderItemId,batch,quantity)),"按明确批次和FEFO重分配",order.version);}
 Account support(String id){return id.equals(supportA.actor().userId())?supportA:supportB;}
 String financesAndStock(OrderRow order){return json.writeValueAsString(map("paid",db.order(order.orderId).paidAmount,"refunded",db.order(order.orderId).refundedAmount,"onHand",quantity(originalBatch,"on_hand"),"reserved",quantity(originalBatch,"reserved"),"payments",jdbc.queryForList("SELECT payment_id,status,amount,refunded_amount,refund_reserved FROM fm_payment WHERE order_id=? ORDER BY payment_id",order.orderId),"refunds",jdbc.queryForList("SELECT refund_id,status,amount FROM fm_refund WHERE order_id=? ORDER BY refund_id",order.orderId)));}

 @Test void legalFefoReallocationIsAtomicIdempotentAndKeepsImmutableHistory()throws Exception{
  var order=claimed();var old=db.allocations(order.orderId).getFirst();String replacement=id("batch");batch(replacement,sku,10,slot.endAt().plusSeconds(4*86400),Instant.now().minusSeconds(86400));
  var request=reallocation(order,replacement,3);String route="/api/v1/admin/pick-tasks/"+order.pickTaskId+"/reallocate",key=key();
  var first=postAs(picker,route,request,key,200);assertEquals(data(first),data(postAs(picker,route,request,key,200)));
  assertEquals(20,quantity(originalBatch,"on_hand"));assertEquals(0,quantity(originalBatch,"reserved"));assertEquals(10,quantity(replacement,"on_hand"));assertEquals(3,quantity(replacement,"reserved"));
  var active=db.allocations(order.orderId);assertEquals(1,active.size());assertEquals(replacement,active.getFirst().batchId);assertNotEquals(old.allocationId,active.getFirst().allocationId);
  assertTrue(jdbc.queryForObject("SELECT retired FROM fm_order_allocation WHERE allocation_id=?",Boolean.class,old.allocationId));assertEquals(0,jdbc.queryForObject("SELECT reserved_quantity FROM fm_order_allocation WHERE allocation_id=?",Long.class,old.allocationId));
  assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM fm_inventory_movement WHERE order_id=?",Integer.class,order.orderId));
  var audit=jdbc.queryForMap("SELECT before_summary,after_summary FROM fm_audit_event WHERE operation='pick.reallocate' AND resource_id=?",order.pickTaskId);assertTrue(audit.get("before_summary").toString().contains(originalBatch));assertTrue(audit.get("after_summary").toString().contains(replacement));
  postAs(picker,route,new Reallocate(request.allocations(),"不同原因",request.version()),key,409);
  var current=db.order(order.orderId);service.confirmPick(picker.actor(),current.pickTaskId,new PickConfirm(List.of(new PickLine(active.getFirst().allocationId,3L,"NORMAL","真实新批次出库")),current.version));assertEquals(7,quantity(replacement,"on_hand"));assertEquals(0,quantity(replacement,"reserved"));assertEquals(20,quantity(originalBatch,"on_hand"));
 }
 @Test void expiredForDeliveryOriginalBatchCanBeReplacedButSkipOfValidFefoIsRejected()throws Exception{
  var order=claimed();String later=id("batch");batch(later,sku,10,slot.endAt().plusSeconds(15*86400),Instant.now().minusSeconds(86400));String route="/api/v1/admin/pick-tasks/"+order.pickTaskId+"/reallocate";
  postAs(picker,route,reallocation(order,later,3),key(),422);assertEquals(3,quantity(originalBatch,"reserved"));assertEquals(0,quantity(later,"reserved"));
  jdbc.update("UPDATE fm_inventory_batch SET expires_at=? WHERE batch_id=?",Timestamp.from(slot.endAt()),originalBatch);
  postAs(picker,route,reallocation(order,later,3),key(),200);assertEquals(0,quantity(originalBatch,"reserved"));assertEquals(3,quantity(later,"reserved"));assertEquals("NORMAL",jdbc.queryForObject("SELECT lifecycle_status FROM fm_inventory_batch WHERE batch_id=?",String.class,originalBatch));
 }
 @Test void failedReallocationLeavesAllReservationsAndStockUntouched()throws Exception{
  var order=claimed();String alternative=id("batch");batch(alternative,sku,2,slot.endAt().plusSeconds(3*86400),Instant.now().minusSeconds(86400));String route="/api/v1/admin/pick-tasks/"+order.pickTaskId+"/reallocate";
  jdbc.update("UPDATE fm_inventory_batch SET expires_at=? WHERE batch_id=?",Timestamp.from(slot.endAt()),originalBatch);
  postAs(picker,route,reallocation(order,alternative,3),key(),422);assertEquals(3,quantity(originalBatch,"reserved"));assertEquals(0,quantity(alternative,"reserved"));assertEquals(20,quantity(originalBatch,"on_hand"));assertEquals(2,quantity(alternative,"on_hand"));assertEquals(1,db.allocations(order.orderId).size());assertEquals(order.version,db.order(order.orderId).version);
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_inventory_movement WHERE order_id=?",Integer.class,order.orderId));
 }
 @Test void reallocationRejectsWrongRoleOwnerStaleVersionPartialAndIssuedTask()throws Exception{
  var order=claimed();String route="/api/v1/admin/pick-tasks/"+order.pickTaskId+"/reallocate";var valid=reallocation(order,originalBatch,3);
  postAs(member,route,valid,key(),403);postAs(otherPicker,route,valid,key(),404);postAs(picker,route,new Reallocate(valid.allocations(),"旧版本",order.version-1),key(),409);
  postAs(picker,route,reallocation(order,originalBatch,2),key(),400);postAs(picker,route,new Reallocate(List.of(valid.allocations().getFirst(),valid.allocations().getFirst()),"重复分配",order.version),key(),400);
  var allocation=db.allocations(order.orderId).getFirst();service.confirmPick(picker.actor(),order.pickTaskId,new PickConfirm(List.of(new PickLine(allocation.allocationId,3L,"NORMAL","确认出库")),order.version));
  postAs(picker,route,new Reallocate(valid.allocations(),"已出库不能替换",db.order(order.orderId).version),key(),409);assertEquals(17,quantity(originalBatch,"on_hand"));
 }
 @Test void concurrentReallocationWithSameVersionSucceedsOnce()throws Exception{
  var order=claimed();String replacement=id("batch");batch(replacement,sku,10,slot.endAt().plusSeconds(4*86400),Instant.now().minusSeconds(86400));var request=reallocation(order,replacement,3);var gate=new CountDownLatch(1);
  try(var pool=Executors.newFixedThreadPool(2)){List<Future<Integer>> results=new ArrayList<>();for(int i=0;i<2;i++)results.add(pool.submit(()->{gate.await();try{fulfillment.reallocate(picker.actor(),order.pickTaskId,request);return 200;}catch(ApiException error){return error.status();}}));gate.countDown();List<Integer> codes=new ArrayList<>();for(var future:results)codes.add(future.get(10,TimeUnit.SECONDS));Collections.sort(codes);assertEquals(List.of(200,409),codes);}
  assertEquals(3,quantity(replacement,"reserved"));assertEquals(0,quantity(originalBatch,"reserved"));assertEquals(1,db.allocations(order.orderId).size());assertEquals(order.version+1,db.order(order.orderId).version);
 }
 @Test void existingCommerceVersionRequestsRejectUnsafeJsonIntegersBeforeMutation()throws Exception{
  var order=claimed();var allocation=db.allocations(order.orderId).getFirst();long unsafe=MAX_SAFE+1;
  postAs(picker,"/api/v1/admin/pick-tasks/"+order.pickTaskId+"/claim",new Version(unsafe),key(),400);
  postAs(member,"/api/v1/orders/"+order.orderId+"/cancel",new ReasonVersion("超范围版本",unsafe),key(),400);
  postAs(picker,"/api/v1/admin/pick-tasks/"+order.pickTaskId+"/confirm",new PickConfirm(List.of(new PickLine(allocation.allocationId,3L,"NORMAL","版本边界")),unsafe),key(),400);
  postAs(picker,"/api/v1/admin/delivery-tasks/"+order.deliveryTaskId+"/dispatch",new Dispatch(courier.actor().userId(),unsafe),key(),400);
  postAs(courier,"/api/v1/admin/delivery-tasks/"+order.deliveryTaskId+"/complete",new Complete("123456",null,unsafe),key(),400);
  postAs(picker,"/api/v1/admin/orders/"+order.orderId+"/returns/receive",new ReturnReceive(List.of(new ReturnLine(allocation.allocationId,1L,0L)),"版本边界",unsafe),key(),400);
  String unpaid=order();var payment=service.prepay(member.actor(),new Prepay(unpaid,"ORDER",null));postAs(member,"/api/v1/payments/"+payment.get("paymentId")+"/sandbox-simulate",new Simulate("SUCCESS",unsafe),key(),400);
  assertEquals(400,assertThrows(ApiException.class,()->version(0,unsafe)).status());assertEquals(409,assertThrows(ApiException.class,()->nextVersion(MAX_SAFE)).status());assertEquals(order.version,db.order(order.orderId).version);assertEquals(20,quantity(originalBatch,"on_hand"));
 }
 @Test void deliveryExceptionIsScopedAndRecoverableWithoutFinancialOrInventoryEffects()throws Exception{
  var order=delivering();String baseline=financesAndStock(order),route="/api/v1/admin/delivery-tasks/"+order.deliveryTaskId;var contact=new ContactAccess("DELIVERY_CONTACT","预约配送联系",order.version);String contactKey=key();
  var full=postAs(courier,route+"/contact-access",contact,contactKey,200);assertEquals(CONTACT_PHONE,data(full).path("phone").asString());assertTrue(data(full).path("addressDetail").asString().endsWith(CONTACT_DETAIL));assertEquals("no-store",full.getResponse().getHeader("Cache-Control"));
  var masked=mvc.perform(get(route).header("Authorization","Bearer "+courier.token())).andExpect(status().isOk()).andReturn();assertFalse(masked.getResponse().getContentAsString().contains(CONTACT_PHONE));assertFalse(masked.getResponse().getContentAsString().contains(CONTACT_DETAIL));
  String eventKey=key();var exception=new DeliveryException("RECIPIENT_UNREACHABLE","无法联系收件人，通知客服处理",order.version);var first=postAs(courier,route+"/exceptions",exception,eventKey,200);assertEquals(data(first),data(postAs(courier,route+"/exceptions",exception,eventKey,200)));assertEquals("EXCEPTION",data(first).path("status").asString());
  var saved=extra.lockOpenException(order.orderId);Account assigned=support(saved.assigneeId()),other=assigned==supportA?supportB:supportA;assertNotEquals(order.userId,saved.assigneeId());
  mvc.perform(get(route).header("Authorization","Bearer "+assigned.token())).andExpect(status().isOk());mvc.perform(get(route).header("Authorization","Bearer "+other.token())).andExpect(status().isNotFound());
  var list=service.deliveryTasks(assigned.actor(),"EXCEPTION",1,100);assertTrue(list.get("items").toString().contains(order.deliveryTaskId));assertFalse(service.deliveryTasks(other.actor(),"EXCEPTION",1,100).get("items").toString().contains(order.deliveryTaskId));
  postAs(courier,route+"/contact-access",contact,contactKey,409);var interrupted=db.order(order.orderId);postAs(courier,route+"/complete",new Complete(order.receiptCode,null,interrupted.version),key(),409);
  postAs(other,route+"/resolve-exception",new ResolveException("不属于本人",interrupted.version),key(),404);postAs(assigned,route+"/resolve-exception",new ResolveException("旧版本",interrupted.version-1),key(),409);
  var resolved=postAs(assigned,route+"/resolve-exception",new ResolveException("已联系收货人，恢复原配送员继续配送",interrupted.version),key(),200);assertEquals("DELIVERING",data(resolved).path("status").asString());assertEquals(order.courierId,data(resolved).path("courierId").asString());assertEquals("DELIVERING",db.order(order.orderId).status);assertNull(extra.lockOpenException(order.orderId));assertEquals(baseline,financesAndStock(order));
  var resumed=db.order(order.orderId);mvc.perform(get(route).header("Authorization","Bearer "+assigned.token())).andExpect(status().isNotFound());assertFalse(service.deliveryTasks(assigned.actor(),null,1,100).get("items").toString().contains(order.deliveryTaskId));postAs(assigned,route+"/resolve-exception",new ResolveException("已解决后再次处理",resumed.version),key(),409);
  postAs(courier,route+"/contact-access",new ContactAccess("DELIVERY_CONTACT","异常解决后确认送达",resumed.version),key(),200);service.complete(courier.actor(),order.deliveryTaskId,new Complete(order.receiptCode,"真实签收",resumed.version));postAs(courier,route+"/contact-access",contact,contactKey,409);assertEquals("FINISHED",db.order(order.orderId).status);
 }
 @Test void noIndependentAvailableSupportRollsBackExceptionInsteadOfPretendingToNotify()throws Exception{
  var order=delivering();jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE user_id IN (?,?)",supportA.actor().userId(),supportB.actor().userId());jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,'SERVICE')",member.actor().userId());String baseline=financesAndStock(order);
  postAs(courier,"/api/v1/admin/delivery-tasks/"+order.deliveryTaskId+"/exceptions",new DeliveryException("DELAYED","延误需要独立客服",order.version),key(),409);
  assertEquals("DELIVERING",db.order(order.orderId).deliveryStatus);assertEquals(order.version,db.order(order.orderId).version);assertNull(extra.lockOpenException(order.orderId));assertEquals(baseline,financesAndStock(order));
 }
 @Test void contactAccessHasStrictRoleOwnerPurposeStateAndPrivacySafeIdempotency()throws Exception{
  var order=delivering();String route="/api/v1/admin/delivery-tasks/"+order.deliveryTaskId+"/contact-access",key=key();var request=new ContactAccess("DELIVERY_CONTACT","配送联系理由",order.version);
  postAs(member,route,request,key(),403);postAs(supportA,route,request,key(),403);postAs(otherCourier,route,request,key(),404);postAs(courier,route,new ContactAccess("EXPORT","错误用途",order.version),key(),400);postAs(courier,route,new ContactAccess("DELIVERY_CONTACT"," ",order.version),key(),400);
  var first=postAs(courier,route,request,key,200);assertEquals(data(first),data(postAs(courier,route,request,key,200)));postAs(courier,route,new ContactAccess("DELIVERY_CONTACT","不同理由",order.version),key,409);
  String persisted=json.writeValueAsString(jdbc.queryForList("SELECT result_json FROM fm_idempotency WHERE actor_id=? AND route=?",courier.actor().userId(),"POST "+route))+json.writeValueAsString(jdbc.queryForList("SELECT * FROM fm_audit_event WHERE operation='delivery.contact.access' AND resource_id=?",order.deliveryTaskId));
  assertFalse(persisted.contains(CONTACT_PHONE));assertFalse(persisted.contains(CONTACT_NAME));assertFalse(persisted.contains(CONTACT_DETAIL));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE operation='delivery.contact.access' AND resource_id=?",Integer.class,order.deliveryTaskId));
  identities.revokeUser(courier.actor().userId());postAs(courier,route,request,key,401);assertEquals(401,assertThrows(ApiException.class,()->fulfillment.contactAccess(courier.actor(),order.deliveryTaskId,request,key)).status());
 }
 @Test void courierCannotReportOtherTaskAndOriginalCourierCannotBeChangedByRecovery()throws Exception{
  var order=delivering();String route="/api/v1/admin/delivery-tasks/"+order.deliveryTaskId;var request=new DeliveryException("OTHER","测试异常",order.version);postAs(otherCourier,route+"/exceptions",request,key(),404);postAs(member,route+"/exceptions",request,key(),403);postAs(courier,route+"/exceptions",new DeliveryException("UNKNOWN","错误类型",order.version),key(),400);postAs(courier,route+"/exceptions",request,key(),200);
  var exception=extra.lockOpenException(order.orderId);Account assigned=support(exception.assigneeId());var current=db.order(order.orderId);jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE user_id=?",courier.actor().userId());postAs(assigned,route+"/resolve-exception",new ResolveException("原配送员失效不可自动改派",current.version),key(),409);assertEquals("EXCEPTION",db.order(order.orderId).deliveryStatus);assertEquals(order.courierId,db.order(order.orderId).courierId);assertNotNull(extra.lockOpenException(order.orderId));
 }
}
