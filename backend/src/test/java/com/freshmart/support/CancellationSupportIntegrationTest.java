package com.freshmart.support;

import com.freshmart.checkout.*;
import com.freshmart.commerce.*;
import com.freshmart.common.*;
import com.freshmart.identity.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.freshmart.commerce.CommerceModels.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real filters, transactions and persistent assignment governance in isolated H2 MySQL mode. */
@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.url=jdbc:h2:mem:cancellation_support;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
 "spring.datasource.username=sa","spring.datasource.password=","app.token-secret=cancellation-test-only-secret-never-deploy-123456789",
 "app.sandbox-enabled=true","app.sandbox-secret=cancellation-sandbox-test-only-secret-never-deploy-987654321","app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
class CancellationSupportIntegrationTest {
 static final AtomicLong PHONES=new AtomicLong(13500000000L),SLOTS=new AtomicLong();
 @Autowired CancellationSupportService support;@Autowired CancellationSupportMapper requests;
 @Autowired CommerceService commerce;@Autowired CommerceMapper orders;@Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;
 @Autowired AuthenticationService auth;@Autowired RefundProcessor refunds;@Autowired SandboxRefundGateway gateway;
 @Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired MockMvc mvc;
 record Account(RequestActor actor,String token){}
 Account member,otherMember,picker,courier,serviceA,serviceB,finance,operator;
 CheckoutModels.AddressView address;CheckoutModels.SlotRow slot;String sku,batch;
 @BeforeEach void fixture(){
  jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE user_id IN (SELECT user_id FROM fm_user_role WHERE role_code='SERVICE')");
  member=account("MEMBER");otherMember=account("MEMBER");picker=account("PICKER");courier=account("COURIER");serviceA=account("SERVICE");serviceB=account("SERVICE");finance=account("FINANCE");operator=account("OPERATOR");
  address=checkout.createAddress(member.actor().userId(),new CheckoutModels.AddressInput("课程取消测试人","13800138000","上海市","上海市","松江区","东华大学合成验收地址",true));
  Instant start=LocalDate.now(CheckoutService.ZONE).plusDays(1).atTime(14,0).atZone(CheckoutService.ZONE).toInstant().plusSeconds(SLOTS.incrementAndGet());
  slot=new CheckoutModels.SlotRow(id("slot"),LocalDate.now(CheckoutService.ZONE).plusDays(1),"14:00–17:00",start,start.plusSeconds(10800),start,30,0,true,0);checkoutDb.insertSlot(slot);
  String category=id("category"),product=id("product");sku=id("sku");batch=id("batch");
  jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'合成生鲜','鲜','http://localhost:8080/catalog/S001.jpg')",category,category);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'取消闭环测试商品','仅用于隔离测试','上海','COLD','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,category);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price,member_price,image_url,status) VALUES(?,?,?,'标准件','件','PIECE','BY_PIECE',1000,1000,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
  jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'warehouse-main',?,?,'NORMAL',100,0,0)",batch,sku,batch,Timestamp.from(Instant.now().minusSeconds(86400)),Timestamp.from(slot.endAt().plusSeconds(10*86400)));
 }
 Account account(String role){var session=auth.register(Long.toString(PHONES.incrementAndGet()),"Cancellation-test-only-password-2026!",role);String user=session.body().user().userId();if(!role.equals("MEMBER")){jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",user);jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,?)",user,role);}return new Account(auth.authenticate(session.body().accessToken()),session.body().accessToken());}
 String create(){var quote=checkout.quote(member.actor().userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,3L)),address.addressId(),slot.slotId(),null));return (String)commerce.create(member.actor(),new CreateOrder(quote.quoteId(),quote.quoteToken(),null)).get("orderId");}
 OrderRow paid(){String id=create();var payment=commerce.prepay(member.actor(),new Prepay(id,"ORDER",null));commerce.simulate(member.actor(),(String)payment.get("paymentId"),new Simulate("SUCCESS",((Number)payment.get("version")).longValue()));return orders.order(id);}
 OrderRow ready(){var order=paid();commerce.claim(picker.actor(),order.pickTaskId,new Version(order.version));order=orders.order(order.orderId);var allocation=orders.allocations(order.orderId).getFirst();commerce.confirmPick(picker.actor(),order.pickTaskId,new PickConfirm(List.of(new PickLine(allocation.allocationId,3L,"NORMAL","已实拣三件")),order.version));return orders.order(order.orderId);}
 Account assignee(String order){String id=requests.latest(order).assigneeId();return id.equals(serviceA.actor().userId())?serviceA:serviceB;}
 Account unrelated(Account assigned){return assigned.actor().userId().equals(serviceA.actor().userId())?serviceB:serviceA;}
 String route(String order){return "/api/v1/orders/"+order+"/cancellation-requests";}
 MvcResult postAs(Account actor,String route,Object input,String key,int expected)throws Exception{return mvc.perform(post(route).header("Authorization","Bearer "+actor.token()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().is(expected)).andReturn();}
 JsonNode data(MvcResult result)throws Exception{return json.readTree(result.getResponse().getContentAsString()).path("data");}
 String id(String prefix){return prefix+"-"+UUID.randomUUID();}
 String key(){return UUID.randomUUID().toString();}
 long stock(String column){return jdbc.queryForObject("SELECT "+column+" FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch);}
 String moneyAndStock(String order){return json.writeValueAsString(Map.of("stock",jdbc.queryForMap("SELECT on_hand,reserved,quarantined FROM fm_inventory_batch WHERE batch_id=?",batch),"slot",jdbc.queryForMap("SELECT used FROM fm_delivery_slot WHERE slot_id=?",slot.slotId()),"payments",jdbc.queryForList("SELECT payment_id,status,amount,refunded_amount,refund_reserved FROM fm_payment WHERE order_id=? ORDER BY payment_id",order),"refunds",jdbc.queryForList("SELECT refund_id,status,amount FROM fm_refund WHERE order_id=? ORDER BY refund_id",order)));}

 @Test void requestIsAtomicIdempotentVersionedAndSeparatelyAuditsSystemAssignment()throws Exception{
  var order=paid();String before=moneyAndStock(order.orderId),key=key();var input=new ReasonVersion("请协助取消，本人稍后不在校",order.version);
  var first=postAs(member,route(order.orderId),input,key,201);var repeated=postAs(member,route(order.orderId),input,key,201);
  assertEquals(data(first),data(repeated));assertEquals("OPEN",data(first).path("status").asString());assertEquals(before,moneyAndStock(order.orderId));assertEquals(order.version+1,orders.order(order.orderId).version);
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_cancellation_request WHERE order_id=?",Integer.class,order.orderId));
  postAs(member,route(order.orderId),new ReasonVersion("不同原因",order.version),key,409);
  var updated=orders.order(order.orderId);postAs(member,route(order.orderId),new ReasonVersion("重复新请求",updated.version),key(),409);
  var chosen=requests.latest(order.orderId);String expected=serviceA.actor().userId().compareTo(serviceB.actor().userId())<0?serviceA.actor().userId():serviceB.actor().userId();assertEquals(expected,chosen.assigneeId());
  assertEquals("OPEN",json.valueToTree(commerce.get(member.actor(),order.orderId)).path("cancellationSupport").path("status").asString());
  assertFalse(commerce.adminOrder(finance.actor(),order.orderId).containsKey("cancellationSupport"));
  var event=jdbc.queryForMap("SELECT actor_id,actor_roles_snapshot,reason FROM fm_audit_event WHERE operation='cancellation.assign' AND resource_id=?",chosen.requestId());assertEquals("SYSTEM",event.get("actor_id"));assertEquals("",event.get("actor_roles_snapshot"));assertTrue(event.get("reason").toString().contains("LEAST_OPEN_SUPPORT_WORKLOAD_THEN_USER_ID"));
 }
 @Test void resourceRolesVersionsAndLegalStateRemainEnforced()throws Exception{
  String id=create();var order=orders.order(id);var input=new ReasonVersion("请协助取消",order.version);
  mvc.perform(post(route(id)).header("Idempotency-Key",key()).contentType("application/json").content(json.writeValueAsString(input))).andExpect(status().isUnauthorized());
  postAs(picker,route(id),input,key(),403);postAs(serviceA,route(id),input,key(),403);postAs(otherMember,route(id),input,key(),404);
  postAs(member,route(id),new ReasonVersion("陈旧版本",order.version+1),key(),409);postAs(member,route(id),new ReasonVersion(" ",order.version),key(),400);
  postAs(member,route(id),new ReasonVersion("越界版本",9007199254740992L),key(),400);
  commerce.cancel(member.actor(),id,input,false);postAs(member,route(id),new ReasonVersion("已取消不能重开",orders.order(id).version),key(),409);
  var delivered=ready();commerce.dispatch(picker.actor(),delivered.deliveryTaskId,new Dispatch(courier.actor().userId(),delivered.version));delivered=orders.order(delivered.orderId);
  postAs(member,route(delivered.orderId),new ReasonVersion("配送中不能新建",delivered.version),key(),409);
  commerce.complete(courier.actor(),delivered.deliveryTaskId,new Complete(delivered.receiptCode,null,delivered.version));
  postAs(member,route(delivered.orderId),new ReasonVersion("完成后不能新建",orders.order(delivered.orderId).version),key(),409);
 }
 @Test void noIndependentActiveServiceRollsBackAndCombinedBuyerCannotAssignSelf()throws Exception{
  String id=create();var order=orders.order(id);String before=moneyAndStock(id);
  jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE user_id IN (?,?)",serviceA.actor().userId(),serviceB.actor().userId());
  jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,'SERVICE')",member.actor().userId());var combined=new Account(auth.authenticate(member.token()),member.token());
  postAs(combined,route(id),new ReasonVersion("不能由本人客服处理",order.version),key(),409);
  assertNull(requests.latest(id));assertEquals(order.version,orders.order(id).version);assertEquals(before,moneyAndStock(id));
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE operation='order.cancellation.request.denied' AND resource_id=? AND outcome='DENIED'",Integer.class,id));
  jdbc.update("UPDATE fm_user SET status='ACTIVE' WHERE user_id=?",serviceB.actor().userId());support.request(combined.actor(),id,new ReasonVersion("独立客服可处理",order.version));assertEquals(serviceB.actor().userId(),requests.latest(id).assigneeId());
 }
 @Test void exactOrderSearchNeverExpandsAssignedServiceScope()throws Exception{
  String first=create(),second=create();var one=orders.order(first);var two=orders.order(second);
  support.request(member.actor(),first,new ReasonVersion("订单一取消协助",one.version));Account chosen=assignee(first),outsider=unrelated(chosen);
  mvc.perform(get("/api/v1/admin/orders").header("Authorization","Bearer "+chosen.token()).param("orderNo",one.orderNo).param("size","1")).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].orderId").value(first)).andExpect(jsonPath("$.data.items[0].allowedActions[0]").value("CANCEL"));
  mvc.perform(get("/api/v1/admin/orders").header("Authorization","Bearer "+chosen.token()).param("orderNo",two.orderNo)).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0)).andExpect(jsonPath("$.data.items.length()").value(0));
  mvc.perform(get("/api/v1/admin/orders").header("Authorization","Bearer "+outsider.token()).param("orderNo",one.orderNo)).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0));
  mvc.perform(get("/api/v1/admin/orders/"+first).header("Authorization","Bearer "+outsider.token())).andExpect(status().isNotFound());
  postAs(outsider,"/api/v1/admin/orders/"+first+"/cancel",new ReasonVersion("越权取消",orders.order(first).version),key(),404);
  mvc.perform(get("/api/v1/admin/orders").header("Authorization","Bearer "+operator.token()).param("orderNo",two.orderNo)).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1));
  mvc.perform(get("/api/v1/admin/orders").header("Authorization","Bearer "+finance.token()).param("orderNo",one.orderNo)).andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].cancellationSupport").doesNotExist());
  for(String bad:List.of("%"," x","x' OR 1=1","x".repeat(65)))mvc.perform(get("/api/v1/admin/orders").header("Authorization","Bearer "+operator.token()).param("orderNo",bad)).andExpect(status().isBadRequest());
 }
 @Test void serviceCancellationPreservesMoneyAndStockRulesUntilActualInspection()throws Exception{
  var order=ready();assertEquals(97,stock("on_hand"));support.request(member.actor(),order.orderId,new ReasonVersion("实物待发前协助取消",order.version));var current=orders.order(order.orderId);Account assigned=assignee(order.orderId);
  postAs(assigned,"/api/v1/admin/orders/"+order.orderId+"/cancel",new ReasonVersion("已核对会员请求",current.version),key(),200);
  assertEquals("CANCELED",orders.order(order.orderId).status);assertEquals("RESOLVED",requests.latest(order.orderId).status());assertNotNull(requests.latest(order.orderId).resolvedAt());assertEquals(97,stock("on_hand"));assertEquals(0,stock("reserved"));
  var allocation=orders.allocations(order.orderId).getFirst();commerce.receiveReturn(picker.actor(),order.orderId,new ReturnReceive(List.of(new ReturnLine(allocation.allocationId,2L,1L)),"实际收到两件合格、一件待检隔离",orders.order(order.orderId).version));
  assertEquals(100,stock("on_hand"));assertEquals(1,stock("quarantined"));assertEquals(3,orders.allocations(order.orderId).getFirst().returnedQuantity);
  assertEquals(1,orders.refunds(order.orderId).size());var refund=orders.refunds(order.orderId).getFirst();assertEquals(order.paidAmount,refund.amount);var claimed=refunds.claim(refund.refundId);gateway.execute(claimed);refunds.complete(claimed);assertEquals(order.paidAmount,orders.order(order.orderId).refundedAmount);
 }
 @Test void selfCancellationTimeoutAndSuccessfulDispatchResolveOpenAssistance(){
  String canceled=create();support.request(member.actor(),canceled,new ReasonVersion("先请求后自行取消",orders.order(canceled).version));commerce.cancel(member.actor(),canceled,new ReasonVersion("自行取消",orders.order(canceled).version),false);assertEquals("RESOLVED",requests.latest(canceled).status());
  String expired=create();support.request(member.actor(),expired,new ReasonVersion("等待客服期间付款过期",orders.order(expired).version));jdbc.update("UPDATE fm_order SET payment_expires_at=? WHERE order_id=?",Timestamp.from(Instant.now().minusSeconds(10)),expired);commerce.expire(expired);assertEquals("CLOSED",orders.order(expired).status);assertEquals("RESOLVED",requests.latest(expired).status());
  var dispatched=ready();support.request(member.actor(),dispatched.orderId,new ReasonVersion("协助请求不冻结履约",dispatched.version));dispatched=orders.order(dispatched.orderId);commerce.dispatch(picker.actor(),dispatched.deliveryTaskId,new Dispatch(courier.actor().userId(),dispatched.version));
  assertEquals("DELIVERING",orders.order(dispatched.orderId).status);assertEquals("RESOLVED",requests.latest(dispatched.orderId).status());
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE operation='cancellation.resolve' AND resource_id=? AND actor_id='SYSTEM' AND actor_roles_snapshot=''",Integer.class,requests.latest(dispatched.orderId).requestId()));
 }
 @Test void concurrentRequestsUseOneOpenRecordAndBalancePersistentWorkload()throws Exception{
  String first=create();long version=orders.order(first).version;var start=new CountDownLatch(1);
  try(var pool=Executors.newFixedThreadPool(2)){
   var a=pool.submit(()->{start.await();try{support.request(member.actor(),first,new ReasonVersion("并发请求一",version));return true;}catch(ApiException e){assertEquals(409,e.status());return false;}});
   var b=pool.submit(()->{start.await();try{support.request(member.actor(),first,new ReasonVersion("并发请求二",version));return true;}catch(ApiException e){assertEquals(409,e.status());return false;}});
   start.countDown();assertNotEquals(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS));
  }
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_cancellation_request WHERE order_id=? AND status='OPEN'",Integer.class,first));assertEquals(version+1,orders.order(first).version);
  var ids=new ArrayList<String>();for(int i=0;i<3;i++)ids.add(create());
  try(var pool=Executors.newFixedThreadPool(3)){var gate=new CountDownLatch(1);var results=new ArrayList<Future<?>>();for(String id:ids)results.add(pool.submit(()->{gate.await();return support.request(member.actor(),id,new ReasonVersion("并发独立订单稳定分派",orders.order(id).version));}));gate.countDown();for(var result:results)result.get(10,TimeUnit.SECONDS);}
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM fm_cancellation_request WHERE assignee_id=? AND status='OPEN'",Integer.class,serviceA.actor().userId()));assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM fm_cancellation_request WHERE assignee_id=? AND status='OPEN'",Integer.class,serviceB.actor().userId()));
 }
 @Test void requestRacesWithCancellationOrDispatchNeverLeaveAnOpenRequestOnTerminalOrder()throws Exception{
  for(boolean dispatch:List.of(false,true))for(int round=0;round<3;round++){
   var initial=dispatch?ready():orders.order(create());long version=initial.version;String orderId=initial.orderId;var gate=new CountDownLatch(1);
   try(var pool=Executors.newFixedThreadPool(2)){
    var request=pool.submit(()->{gate.await();try{support.request(member.actor(),orderId,new ReasonVersion("竞争窗口请求协助",version));}catch(ApiException expected){assertEquals(409,expected.status());}return true;});
    var finish=pool.submit(()->{gate.await();try{if(dispatch)commerce.dispatch(picker.actor(),initial.deliveryTaskId,new Dispatch(courier.actor().userId(),version));else commerce.cancel(member.actor(),orderId,new ReasonVersion("竞争窗口取消",version),false);}catch(ApiException expected){assertEquals(409,expected.status());}return true;});gate.countDown();request.get(10,TimeUnit.SECONDS);finish.get(10,TimeUnit.SECONDS);
   }
   var current=orders.order(orderId);if(dispatch&&!current.status.equals("DELIVERING"))commerce.dispatch(picker.actor(),current.deliveryTaskId,new Dispatch(courier.actor().userId(),current.version));else if(!dispatch&&!current.status.equals("CANCELED"))commerce.cancel(member.actor(),orderId,new ReasonVersion("刷新版本后明确取消",current.version),false);
   assertNull(requests.lockOpen(orderId));assertEquals(dispatch?"DELIVERING":"CANCELED",orders.order(orderId).status);
  }
 }
}
