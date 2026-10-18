package com.freshmart.aftersale;

import com.freshmart.checkout.*;
import com.freshmart.commerce.*;
import com.freshmart.common.*;
import com.freshmart.identity.AuthenticationService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.freshmart.aftersale.AfterSaleModels.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Every fixture reaches FINISHED through the real quote/order/pay/pick/dispatch/receipt services. */
@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.url=jdbc:h2:mem:aftersale;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.username=sa","spring.datasource.password=","app.token-secret=aftersale-test-secret-not-for-deployment-123456789","app.sandbox-enabled=true","app.sandbox-secret=aftersale-sandbox-secret-not-for-deployment-987654321","app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
class AfterSaleIntegrationTest {
 static final AtomicLong PHONE=new AtomicLong(13500000000L);
 @Autowired AfterSaleService service;@Autowired AfterSaleMapper after;@Autowired AfterSaleCompletionService completion;
 @Autowired CommerceService orders;@Autowired CommerceMapper db;@Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;
 @Autowired AuthenticationService auth;@Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired MockMvc mvc;
 @Autowired RefundProcessor processor;@Autowired SandboxRefundGateway gateway;
 Account buyer,worker,finance,courier,outsider;String sku,batch,orderId,itemId;CheckoutModels.AddressView address;CheckoutModels.SlotRow slot;
 record Account(RequestActor actor,String token){}
 Account account(String... roles){var issued=auth.register(Long.toString(PHONE.incrementAndGet()),"Aftersale-password-2026!","测试账号");String id=issued.body().user().userId();jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",id);for(String role:roles)jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,?)",id,role);return new Account(new RequestActor(id,Set.of(roles),Set.of(),"test"),issued.body().accessToken());}
 @BeforeEach void seed(){
  buyer=account("MEMBER","SERVICE","FINANCE");worker=account("PICKER","SERVICE","FINANCE");finance=account("FINANCE");courier=account("COURIER");outsider=account("MEMBER","SERVICE");
  address=checkout.createAddress(buyer.actor().userId(),new CheckoutModels.AddressInput("测试同学","13800138000","上海市","上海市","松江区","东华大学演示地址",true));checkout.initializeSlots();slot=checkoutDb.slots(LocalDate.now(CheckoutService.ZONE).plusDays(1)).getFirst();
  String category=id(),product=id();sku=id();batch=id();
  jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'测试生鲜','鲜','http://localhost:8080/catalog/S001.jpg')",category,category);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'鲜虾','售后集成测试','上海','COLD','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,category);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url,status) VALUES(?,?,?,'500g','500g','GRAM','BY_WEIGHT',500,1200,1000,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
  jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'W1',?,?,'NORMAL',10000,0,0)",batch,sku,batch,Timestamp.from(Instant.now().minusSeconds(86400)),Timestamp.from(slot.endAt().plus(Duration.ofDays(10))));
  orderId=finishOrder(500);itemId=(String)items(orders.get(buyer.actor(),orderId)).getFirst().get("orderItemId");
 }
 String finishOrder(long actual){
  var quote=checkout.quote(buyer.actor().userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,500L)),address.addressId(),slot.slotId(),null));var view=orders.create(buyer.actor(),new CommerceModels.CreateOrder(quote.quoteId(),quote.quoteToken(),null));String id=(String)view.get("orderId");
  var payment=orders.prepay(buyer.actor(),new CommerceModels.Prepay(id,"ORDER",null));orders.simulate(buyer.actor(),(String)payment.get("paymentId"),new CommerceModels.Simulate("SUCCESS",number(payment,"version")));
  var o=db.order(id);var task=orders.claim(worker.actor(),o.pickTaskId,new CommerceModels.Version(o.version));var a=db.allocations(id).getFirst();orders.confirmPick(worker.actor(),o.pickTaskId,new CommerceModels.PickConfirm(List.of(new CommerceModels.PickLine(a.allocationId,actual,actual==500?"NORMAL":"WEIGHT_VARIANCE","真实称重测试")),number(task,"version")));
  o=db.order(id);if("TOP_UP_PENDING".equals(o.adjustmentStatus)){var top=orders.prepay(buyer.actor(),new CommerceModels.Prepay(id,"TOP_UP",o.adjustmentId));orders.simulate(buyer.actor(),(String)top.get("paymentId"),new CommerceModels.Simulate("SUCCESS",number(top,"version")));}
  o=db.order(id);orders.dispatch(worker.actor(),o.deliveryTaskId,new CommerceModels.Dispatch(courier.actor().userId(),o.version));o=db.order(id);orders.complete(courier.actor(),o.deliveryTaskId,new CommerceModels.Complete(o.receiptCode,"真实签收测试",o.version));assertEquals("FINISHED",db.order(id).status);return id;
 }
 ApplyRequest request(long amount){return new ApplyRequest(orderId,"SHORTAGE","收到后发现少量缺损",List.of(new LineInput(itemId,100L,amount)),List.of());}
 String apply(long amount){return (String)service.apply(buyer.actor(),request(amount)).get("aftersaleId");}
 void approve(String id,long amount){var row=after.find(id);service.claim(worker.actor(),id,new Version(row.version));row=after.find(id);service.approve(worker.actor(),id,new ApproveRequest(List.of(new LineInput(itemId,100L,amount)),"已核验订单及申请",row.version));}
 void executeAll(String afterId){for(var r:after.caseRefunds(afterId))service.execute(finance.actor(),r.refundId,new ReasonVersion(r.version,"独立财务复核通过"),false);}
 void settleAll(String afterId){for(var r:after.caseRefunds(afterId)){var claim=processor.claim(r.refundId);if(claim!=null){gateway.execute(claim);processor.complete(r.refundId);}}}
 @SuppressWarnings("unchecked") List<Map<String,Object>> items(Map<String,Object> v){return (List<Map<String,Object>>)v.get("items");}
 long number(Map<String,Object> v,String name){return ((Number)v.get(name)).longValue();}
 String id(){return UUID.randomUUID().toString();}

 @Test void completedOrderAftersaleRequiresIndependentFinancialAuthorizationAndDoesNotRestoreStock(){
  long hand=jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch);String id=apply(400);approve(id,350);
  assertEquals("APPROVED",after.find(id).status);var r=after.caseRefunds(id).getFirst();assertEquals("PENDING",r.status);assertNull(r.executorId);assertEquals(350,db.payment(r.paymentId).refundReserved);
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM fm_outbox WHERE aggregate_id=?",Integer.class,r.refundId));assertNull(processor.claim(r.refundId));
  executeAll(id);assertEquals("REFUNDING",after.find(id).status);settleAll(id);
  assertEquals("COMPLETED",after.find(id).status);assertEquals(350,after.lines(id).getFirst().refundedAmount);assertEquals(350,db.order(orderId).refundedAmount);assertEquals("FINISHED",db.order(orderId).status);
  assertEquals(350,number(items(orders.get(buyer.actor(),orderId)).getFirst(),"refundedAmount"));assertEquals(hand,jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch));
  processor.complete(r.refundId);completion.completeRefund(r.refundId);assertEquals(350,db.order(orderId).refundedAmount);assertEquals(350,after.lines(id).getFirst().refundedAmount);
 }
 @Test void wrongOwnerAndStaffScopeAreHiddenAndReviewerCannotExecuteEvenWithFinanceRole()throws Exception{
  String id=apply(500);assertEquals(404,assertThrows(ApiException.class,()->service.get(outsider.actor(),id,false)).status());
  assertEquals(404,assertThrows(ApiException.class,()->service.claim(buyer.actor(),id,new Version(0L))).status());
  assertEquals(403,assertThrows(ApiException.class,()->service.approve(worker.actor(),id,new ApproveRequest(List.of(new LineInput(itemId,100L,500L)),"未领取",0L))).status());
  approve(id,500);assertEquals(404,assertThrows(ApiException.class,()->service.get(outsider.actor(),id,true)).status());var r=after.caseRefunds(id).getFirst();
  for(Account account:List.of(worker,buyer))assertEquals(403,assertThrows(ApiException.class,()->service.execute(account.actor(),r.refundId,new ReasonVersion(r.version,"试图自审自退"),false)).status());
  assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE resource_id=? AND operation='aftersale.authorization.denied'",Integer.class,r.refundId));
  mvc.perform(get("/api/v1/admin/refunds").header("Authorization","Bearer "+outsider.token())).andExpect(status().isForbidden());
 }
 @Test void cashCapsUseFinalLineAmountExcludeFreightAndOnlyOneActiveCasePerLine(){
  assertEquals(409,assertThrows(ApiException.class,()->service.apply(buyer.actor(),request(1001))).status());String id=apply(400);assertEquals(409,assertThrows(ApiException.class,()->service.apply(buyer.actor(),request(1))).status());
  approve(id,400);executeAll(id);settleAll(id);assertEquals(409,assertThrows(ApiException.class,()->service.apply(buyer.actor(),request(601))).status());assertNotNull(service.apply(buyer.actor(),request(600)));
 }
 @Test void applicationRejectsUnfinishedExpiredOrdersAndUnverifiedEvidence(){
  jdbc.update("UPDATE fm_order SET finished_at=? WHERE order_id=?",Timestamp.from(Instant.now().minus(Duration.ofDays(8))),orderId);assertEquals(409,assertThrows(ApiException.class,()->service.apply(buyer.actor(),request(100))).status());jdbc.update("UPDATE fm_order SET finished_at=CURRENT_TIMESTAMP,status='DELIVERING' WHERE order_id=?",orderId);assertEquals(409,assertThrows(ApiException.class,()->service.apply(buyer.actor(),request(100))).status());jdbc.update("UPDATE fm_order SET status='FINISHED' WHERE order_id=?",orderId);
  assertEquals(400,assertThrows(ApiException.class,()->service.apply(buyer.actor(),new ApplyRequest(orderId,"QUALITY","品质问题",request(100).items(),List.of()))).status());
  assertEquals(400,assertThrows(ApiException.class,()->service.apply(buyer.actor(),new ApplyRequest(orderId,"SHORTAGE","缺损",request(100).items(),List.of("unverified-media")))).status());
  assertEquals(400,assertThrows(ApiException.class,()->service.apply(buyer.actor(),new ApplyRequest(orderId,"SHORTAGE","超量",List.of(new LineInput(itemId,501L,100L)),List.of()))).status());
 }
 @Test void cancelAndRejectReleaseOnlyActiveCaseGuardAndDoNotCreateRefund(){
  String id=apply(100);service.cancel(buyer.actor(),id,new ReasonVersion(0L,"撤销申请"));assertEquals("CANCELED",after.find(id).status);assertEquals(0,after.activeCount(itemId));
  String next=apply(100);service.claim(worker.actor(),next,new Version(0L));service.reject(worker.actor(),next,new ReviewRequest("未发现所述短缺",1L));assertEquals("REJECTED",after.find(next).status);assertEquals(0,db.refunds(orderId).size());assertNotNull(service.apply(buyer.actor(),request(100)));
 }
 @Test void httpIdempotencyRetriesDoNotRepeatApplicationAndUnknownMoneyFieldsAreRejected()throws Exception{
  String key=id(),body=json.writeValueAsString(request(200));var first=mvc.perform(post("/api/v1/aftersales").header("Authorization","Bearer "+buyer.token()).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn();var second=mvc.perform(post("/api/v1/aftersales").header("Authorization","Bearer "+buyer.token()).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn();
  assertEquals(json.readTree(first.getResponse().getContentAsString()).path("data"),json.readTree(second.getResponse().getContentAsString()).path("data"));
  mvc.perform(post("/api/v1/aftersales").header("Authorization","Bearer "+buyer.token()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(request(201)))).andExpect(status().isConflict());
  String afterId=json.readTree(first.getResponse().getContentAsString()).path("data").path("aftersaleId").asString();approve(afterId,200);var r=after.caseRefunds(afterId).getFirst();
  mvc.perform(post("/api/v1/admin/refunds/"+r.refundId+"/execute").header("Authorization","Bearer "+finance.token()).header("Idempotency-Key",id()).contentType("application/json").content("{\"version\":0,\"reason\":\"执行\",\"amount\":1}")).andExpect(status().isBadRequest());
 }
 @Test void concurrentApplicationsHaveExactlyOneActiveLine()throws Exception{
  try(var pool=Executors.newFixedThreadPool(2)){var gate=new CountDownLatch(1);var jobs=new ArrayList<Future<Boolean>>();for(int n=0;n<2;n++)jobs.add(pool.submit(()->{gate.await();try{service.apply(buyer.actor(),request(100));return true;}catch(ApiException expected){return false;}}));gate.countDown();int winners=0;for(var f:jobs)if(f.get(10,TimeUnit.SECONDS))winners++;assertEquals(1,winners);assertEquals(1,after.activeCount(itemId));}
 }
 @Test void multiPaymentApprovalCompletesOnlyAfterAllOriginalRoutesAndAllocatesLineRefundOnce(){
  jdbc.update("UPDATE fm_sku SET price=8400,member_price=7000,version=version+1 WHERE sku_id=?",sku);orderId=finishOrder(550);itemId=(String)items(orders.get(buyer.actor(),orderId)).getFirst().get("orderItemId");String id=apply(7700);approve(id,7700);assertEquals(2,after.caseRefunds(id).size());executeAll(id);
  var receipts=after.caseRefunds(id);var one=processor.claim(receipts.getFirst().refundId);gateway.execute(one);processor.complete(one.refundId);assertEquals("REFUNDING",after.find(id).status);assertEquals(one.amount,after.lines(id).getFirst().refundedAmount);
  var two=processor.claim(receipts.getLast().refundId);gateway.execute(two);processor.complete(two.refundId);assertEquals("COMPLETED",after.find(id).status);assertEquals(7700,db.order(orderId).refundedAmount);assertEquals(7700,after.lines(id).getFirst().refundedAmount);assertEquals(600,db.order(orderId).paidAmount-db.order(orderId).refundedAmount);
 }
 @Test void revokedFinanceAuthorizationPreventsWorkerSendingPendingRefund(){
  String id=apply(200);approve(id,200);executeAll(id);var r=after.caseRefunds(id).getFirst();
  jdbc.update("DELETE FROM fm_user_role WHERE user_id=? AND role_code='FINANCE'",finance.actor().userId());
  assertNull(processor.claim(r.refundId));assertNull(db.receiptAmount(r.refundId));assertEquals(0,db.order(orderId).refundedAmount);assertEquals("REFUNDING",after.find(id).status);
 }
 @Test void serviceOrderQueriesAreAssignmentScopedAndFinanceNeverReceivesAddressRegion(){
  var support=account("SERVICE");var otherSupport=account("SERVICE");String id=apply(200);
  assertEquals(404,assertThrows(ApiException.class,()->orders.adminOrder(support.actor(),orderId)).status());assertEquals(0,number(orders.list(support.actor(),null,1,20,true),"total"));
  service.claim(support.actor(),id,new Version(0L));assertEquals(orderId,orders.adminOrder(support.actor(),orderId).get("orderId"));assertEquals(1,number(orders.list(support.actor(),null,1,20,true),"total"));
  assertEquals(404,assertThrows(ApiException.class,()->orders.adminOrder(otherSupport.actor(),orderId)).status());assertEquals(0,number(orders.list(otherSupport.actor(),null,1,20,true),"total"));
  String financial=json.writeValueAsString(orders.adminOrder(finance.actor(),orderId));assertFalse(financial.contains("region"));assertFalse(financial.contains("东华大学演示地址"));assertFalse(financial.contains("13800138000"));
 }
 @Test void failedRefundRetryQueriesPersistentChannelReceiptBeforeSendingAgain(){
  String id=apply(200);approve(id,200);executeAll(id);var r=after.caseRefunds(id).getFirst();var claimed=processor.claim(r.refundId);gateway.execute(claimed);
  jdbc.update("UPDATE fm_refund SET status='FAILED',version=version+1 WHERE refund_id=?",r.refundId);r=db.refund(r.refundId);service.execute(finance.actor(),r.refundId,new ReasonVersion(r.version,"查询渠道已有成功回执，补记本地"),true);
  assertEquals("SUCCESS",db.refund(r.refundId).status);assertEquals("COMPLETED",after.find(id).status);assertEquals(200,db.order(orderId).refundedAmount);assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_sandbox_refund_receipt WHERE refund_id=?",Integer.class,r.refundId));
 }
}
