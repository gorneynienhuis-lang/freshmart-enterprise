package com.freshmart.commerce;

import com.freshmart.aftersale.*;
import com.freshmart.checkout.*;
import com.freshmart.common.*;
import com.freshmart.identity.AuthenticationService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
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

/** Failure states are produced by the real sandbox adapter; never forged by UPDATE fm_refund.status. */
@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.url=jdbc:h2:mem:refundrecovery;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.username=sa","spring.datasource.password=","app.token-secret=refund-recovery-test-secret-2026-123456789","app.sandbox-enabled=true","app.sandbox-secret=refund-recovery-channel-secret-2026-123456789","app.secure-cookies=false","app.commerce-jobs-enabled=false","app.sandbox-refund-faults-enabled=true","server.address=127.0.0.1","app.refund-max-attempts=3","app.refund-retry-base-seconds=10","app.refund-retry-max-seconds=15","app.refund-lease-seconds=30"})
@AutoConfigureMockMvc
class RefundRecoveryIntegrationTest {
 @TestConfiguration static class Config {@Bean @Primary MutableClock refundTestClock(){return new MutableClock();}}
 static class MutableClock extends Clock {private volatile Instant now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);void reset(){now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS);}void advance(long seconds){now=now.plusSeconds(seconds);}@Override public ZoneId getZone(){return ZoneOffset.UTC;}@Override public Clock withZone(ZoneId zone){return this;}@Override public Instant instant(){return now;}}
 record Account(RequestActor actor,String token){}
 static final AtomicLong PHONE=new AtomicLong(13200000000L);
 @Autowired AuthenticationService auth;@Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;@Autowired CommerceService orders;@Autowired CommerceMapper db;@Autowired RefundProcessor processor;@Autowired SandboxRefundGateway gateway;@Autowired SandboxRefundFaults faults;@Autowired JdbcTemplate jdbc;@Autowired MutableClock clock;@Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired AfterSaleService aftersales;@Autowired PlatformTransactionManager transactions;
 Account buyer,finance;String orderId,refundId,paymentId;long amount;
 Account account(String... roles){var issued=auth.register(Long.toString(PHONE.incrementAndGet()),"Recovery-test-password-2026!","恢复测试");String id=issued.body().user().userId();jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",id);for(String role:roles)jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,?)",id,role);return new Account(auth.authenticate(issued.body().accessToken()),issued.body().accessToken());}
 @BeforeEach void fixture(){
  clock.reset();buyer=account("MEMBER","FINANCE");finance=account("FINANCE");var address=checkout.createAddress(buyer.actor.userId(),new CheckoutModels.AddressInput("测试同学","13800138000","上海市","上海市","松江区","东华大学恢复测试",true));
  Instant start=clock.instant().plusSeconds(86400);String slot=id();checkoutDb.insertSlot(new CheckoutModels.SlotRow(slot,LocalDate.ofInstant(start,CheckoutService.ZONE),"测试时段",start,start.plusSeconds(7200),start,30,0,true,0));
  String category=id(),product=id(),sku=id(),batch=id();jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'生鲜','鲜','http://localhost:8080/catalog/S001.jpg')",category,category);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'测试苹果','真实退款恢复测试','上海','AMBIENT','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,category);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price,member_price,image_url,status) VALUES(?,?,?,'一件','件','PIECE','BY_PIECE',1200,1000,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
  jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'W1',?,?,'NORMAL',20,0,0)",batch,sku,batch,Timestamp.from(clock.instant().minusSeconds(86400)),Timestamp.from(start.plusSeconds(864000)));
  var quote=checkout.quote(buyer.actor.userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,1L)),address.addressId(),slot,null));orderId=(String)orders.create(buyer.actor,new CreateOrder(quote.quoteId(),quote.quoteToken(),null)).get("orderId");
  var payment=orders.prepay(buyer.actor,new Prepay(orderId,"ORDER",null));paymentId=(String)payment.get("paymentId");orders.simulate(buyer.actor,paymentId,new Simulate("SUCCESS",((Number)payment.get("version")).longValue()));var order=db.order(orderId);orders.cancel(buyer.actor,orderId,new ReasonVersion("真实取消产生原路退款",order.version),false);
  var refund=db.refunds(orderId).getFirst();refundId=refund.refundId;amount=refund.amount;assertTrue(amount>0);assertEquals(amount,db.payment(paymentId).refundReserved);
 }
 String id(){return UUID.randomUUID().toString();}
 String outboxState(){return jdbc.queryForObject("SELECT status FROM fm_outbox WHERE aggregate_id=?",String.class,refundId);}
 int count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table+" WHERE refund_id=?",Integer.class,refundId);}
 RefundProcessor.ClaimedRefund reject(){faults.arm(refundId,SandboxRefundFaults.Mode.REJECT_BEFORE_COMMIT,1);var claim=processor.claim(refundId);assertNotNull(claim);var error=assertThrows(RefundChannelException.class,()->gateway.execute(claim));processor.failed(claim,error);assertEquals("FAILED",db.refund(refundId).status);assertEquals("DEAD",outboxState());return claim;}
 void recover(Account actor){var r=db.refund(refundId);aftersales.execute(actor.actor,refundId,new AfterSaleModels.ReasonVersion(r.version,"独立财务核验原任务后恢复"),true);}
 void settle(){var claim=processor.claim(refundId);assertNotNull(claim);gateway.execute(claim);processor.complete(claim);assertEquals("SUCCESS",db.refund(refundId).status);assertEquals("COMPLETED",outboxState());assertEquals(amount,db.payment(paymentId).refundedAmount);assertEquals(0,db.payment(paymentId).refundReserved);assertEquals(amount,db.order(orderId).refundedAmount);assertEquals(1,count("fm_sandbox_refund_receipt"));}
 @Test void transientFailuresRespectAvailableAtBoundedBackoffAndDeadBudget(){
  faults.arm(refundId,SandboxRefundFaults.Mode.TRANSIENT_BEFORE_COMMIT,3);
  for(int attempt=1;attempt<=3;attempt++){var claim=processor.claim(refundId);assertNotNull(claim);Instant failedAt=clock.instant();var error=assertThrows(RefundChannelException.class,()->gateway.execute(claim));processor.failed(claim,error);assertNull(db.receiptAmount(refundId));
   if(attempt<3){long delay=attempt==1?10:15;assertEquals("PENDING",outboxState());assertEquals(failedAt.plusSeconds(delay),jdbc.queryForObject("SELECT available_at FROM fm_outbox WHERE aggregate_id=?",Timestamp.class,refundId).toInstant());assertNull(processor.claim(refundId));assertFalse(db.dueRefunds(clock.instant()).contains(refundId));clock.advance(delay-1);assertNull(processor.claim(refundId));clock.advance(1);}
  }
  assertEquals("DEAD",outboxState());assertEquals("FAILED",db.refund(refundId).status);assertEquals(3,jdbc.queryForObject("SELECT attempt_count FROM fm_outbox WHERE aggregate_id=?",Integer.class,refundId));assertEquals(amount,db.payment(paymentId).refundReserved);assertEquals(0,db.payment(paymentId).refundedAmount);assertNull(processor.claim(refundId));
 }
 @Test void permanentRejectionRecoveryKeepsOriginalIdBudgetAndExecutorAudit(){
  reject();recover(finance);assertEquals(finance.actor.userId(),db.refund(refundId).executorId);assertEquals(1,db.refunds(orderId).size());assertEquals(0,jdbc.queryForObject("SELECT cycle_attempt_count FROM fm_outbox WHERE aggregate_id=?",Integer.class,refundId));assertEquals(amount,db.payment(paymentId).refundReserved);
  assertTrue(jdbc.queryForObject("SELECT before_summary FROM fm_audit_event WHERE resource_id=? AND operation='refund.retry'",String.class,refundId).contains("executor=SYSTEM"));assertEquals(finance.actor.userId(),jdbc.queryForObject("SELECT actor_id FROM fm_audit_event WHERE resource_id=? AND operation='refund.retry'",String.class,refundId));settle();assertEquals(2,jdbc.queryForObject("SELECT attempt_count FROM fm_outbox WHERE aggregate_id=?",Integer.class,refundId));
 }
 @Test void lostAcknowledgementCommitsChannelFactBeforeMerchantBooksAndSurvivesRevocation(){
  reject();recover(finance);faults.arm(refundId,SandboxRefundFaults.Mode.ACK_LOST_AFTER_COMMIT,1);var claim=processor.claim(refundId);var failure=assertThrows(RefundChannelException.class,()->gateway.execute(claim));assertEquals(1,count("fm_sandbox_refund_receipt"));assertEquals(0,db.payment(paymentId).refundedAmount);assertEquals(amount,db.payment(paymentId).refundReserved);
  jdbc.update("DELETE FROM fm_user_role WHERE user_id=? AND role_code='FINANCE'",finance.actor.userId());processor.failed(claim,failure);processor.complete(claim);assertEquals("SUCCESS",db.refund(refundId).status);assertEquals(amount,db.payment(paymentId).refundedAmount);assertEquals(0,db.payment(paymentId).refundReserved);assertEquals(1,count("fm_sandbox_refund_receipt"));
 }
 @Test void crashAfterReceiptUsesNewLeaseAndNeverSendsAgainAfterRevocation(){
  reject();recover(finance);var abandoned=processor.claim(refundId);gateway.execute(abandoned);jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE user_id=?",finance.actor.userId());clock.advance(31);assertTrue(db.dueRefunds(clock.instant()).contains(refundId));var current=processor.claim(refundId);assertNotNull(current);gateway.execute(current);processor.complete(current);processor.failed(abandoned,new RefundChannelException("CHANNEL_TIMEOUT",false));assertEquals("SUCCESS",db.refund(refundId).status);assertEquals(1,count("fm_sandbox_refund_receipt"));assertEquals(amount,db.payment(paymentId).refundedAmount);
 }
 @Test void revokedRoleBetweenClaimAndSendCreatesNoChannelFactAndKeepsReserve(){
  reject();recover(finance);var claim=processor.claim(refundId);jdbc.update("DELETE FROM fm_user_role WHERE user_id=? AND role_code='FINANCE'",finance.actor.userId());gateway.execute(claim);processor.complete(claim);assertNull(db.receiptAmount(refundId));assertEquals("FAILED",db.refund(refundId).status);assertEquals("DEAD",outboxState());assertEquals(amount,db.payment(paymentId).refundReserved);assertEquals(0,db.payment(paymentId).refundedAmount);
 }
 @Test void staleClaimCannotClearNewLeaseOrRecordReceipt(){
  var stale=processor.claim(refundId);clock.advance(31);var current=processor.claim(refundId);assertNotNull(current);processor.failed(stale,new RefundChannelException("CHANNEL_TIMEOUT",false));gateway.execute(stale);processor.complete(stale);assertNull(db.receiptAmount(refundId));assertEquals("PROCESSING",outboxState());gateway.execute(current);processor.complete(current);processor.complete(current);assertEquals(amount,db.payment(paymentId).refundedAmount);assertEquals(1,count("fm_sandbox_refund_receipt"));
 }
 @Test void concurrentClaimsHaveExactlyOneWinnerAndCrashAtBudgetStopsResending()throws Exception{
  try(var pool=Executors.newFixedThreadPool(2)){var gate=new CountDownLatch(1);var a=pool.submit(()->{gate.await();return processor.claim(refundId);});var b=pool.submit(()->{gate.await();return processor.claim(refundId);});gate.countDown();var first=a.get(10,TimeUnit.SECONDS);var second=b.get(10,TimeUnit.SECONDS);assertEquals(1,(first==null?0:1)+(second==null?0:1));}
  clock.advance(31);assertNotNull(processor.claim(refundId));clock.advance(31);assertNotNull(processor.claim(refundId));clock.advance(31);assertNull(processor.claim(refundId));assertEquals("DEAD",outboxState());assertEquals("FAILED",db.refund(refundId).status);assertNull(db.receiptAmount(refundId));
 }
 @Test void recoveryChecksOwnerRoleCurrentSessionVersionAndMissingTask(){
  reject();var r=db.refund(refundId);assertEquals(403,assertThrows(ApiException.class,()->processor.recover(buyer.actor,refundId,r.version,"购买人禁止自退")).status());var member=account("MEMBER");assertEquals(403,assertThrows(ApiException.class,()->processor.recover(member.actor,refundId,r.version,"无财务角色")).status());assertEquals(409,assertThrows(ApiException.class,()->processor.recover(finance.actor,refundId,r.version-1,"旧版本")).status());
  var revoked=account("FINANCE");jdbc.update("UPDATE fm_auth_session SET status='REVOKED' WHERE user_id=?",revoked.actor.userId());assertEquals(401,assertThrows(ApiException.class,()->processor.recover(revoked.actor,refundId,r.version,"过期会话")).status());
  jdbc.update("DELETE FROM fm_outbox WHERE aggregate_id=?",refundId);assertEquals(409,assertThrows(ApiException.class,()->processor.recover(finance.actor,refundId,r.version,"任务缺失不得伪成功")).status());assertEquals("FAILED",db.refund(refundId).status);assertEquals(amount,db.payment(paymentId).refundReserved);
 }
 @Test void mismatchedChannelBindingCannotBookOrBeRecovered(){
  var claim=processor.claim(refundId);gateway.execute(claim);jdbc.update("UPDATE fm_sandbox_refund_receipt SET channel_refund_no='integrity-test-mismatch' WHERE refund_id=?",refundId);var failure=assertThrows(RefundChannelException.class,()->processor.complete(claim));processor.failed(claim,failure);assertEquals("DEAD",outboxState());assertEquals("FAILED",db.refund(refundId).status);assertEquals(0,db.payment(paymentId).refundedAmount);assertEquals(amount,db.payment(paymentId).refundReserved);var r=db.refund(refundId);assertEquals(409,assertThrows(ApiException.class,()->processor.recover(finance.actor,refundId,r.version,"完整回执绑定不符")).status());assertFalse(db.dueRefunds(clock.instant()).contains(refundId));
 }
 @Test void retryHttpIsIdempotentAndUnknownFieldsCannotChangeMoney()throws Exception{
  reject();var r=db.refund(refundId);String route="/api/v1/admin/refunds/"+refundId+"/retry",key=id(),body=json.writeValueAsString(new AfterSaleModels.ReasonVersion(r.version,"独立财务恢复原号"));
  var first=mvc.perform(post(route).header("Authorization","Bearer "+finance.token).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isOk()).andReturn();var second=mvc.perform(post(route).header("Authorization","Bearer "+finance.token).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isOk()).andReturn();assertEquals(json.readTree(first.getResponse().getContentAsString()).path("data"),json.readTree(second.getResponse().getContentAsString()).path("data"));assertEquals(1,db.refunds(orderId).size());
  mvc.perform(post(route).header("Authorization","Bearer "+finance.token).header("Idempotency-Key",id()).contentType("application/json").content("{\"version\":"+r.version+",\"reason\":\"恢复\",\"amount\":1}")).andExpect(status().isBadRequest());settle();
 }
 @Test void publicProjectionNeverContainsLeaseOrPrivateFaultPlan(){
  reject();String text=json.writeValueAsString(aftersales.refunds(finance.actor,"FAILED",orderId,1,20));assertFalse(text.contains("lease"));assertFalse(text.contains("triggeredCount"));assertFalse(text.contains("remainingFailures"));assertFalse(text.contains("cycleAttempt"));
 }
 @Test void repeatableReadSnapshotCannotReuseRevokedSendingRole()throws Exception{
  reject();recover(finance);var claim=processor.claim(refundId);var snapshot=new CountDownLatch(1);var revoked=new CountDownLatch(1);
  try(var pool=Executors.newSingleThreadExecutor()){
   var worker=pool.submit(()->{var tx=new TransactionTemplate(transactions);tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);try{return tx.execute(status->{
    db.refund(refundId);assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_user_role WHERE user_id=? AND role_code='FINANCE'",Integer.class,finance.actor.userId()));snapshot.countDown();try{assertTrue(revoked.await(10,TimeUnit.SECONDS));}catch(InterruptedException e){throw new IllegalStateException(e);}return processor.authorizeSend(claim);
   });}catch(org.springframework.dao.TransientDataAccessException serializedConflict){assertSqlState40001(serializedConflict);return false;}});
   assertTrue(snapshot.await(10,TimeUnit.SECONDS));new TransactionTemplate(transactions).executeWithoutResult(status->{db.lockUser(finance.actor.userId());jdbc.update("DELETE FROM fm_user_role WHERE user_id=? AND role_code='FINANCE'",finance.actor.userId());});revoked.countDown();assertFalse(worker.get(10,TimeUnit.SECONDS));
  }
  assertNull(db.receiptAmount(refundId));assertEquals(0,db.payment(paymentId).refundedAmount);assertEquals(amount,db.payment(paymentId).refundReserved);clock.advance(31);assertNull(processor.claim(refundId));assertEquals("DEAD",outboxState());
 }
 @Test void repeatableReadSnapshotCannotRecoverThroughRevokedSession()throws Exception{
  reject();var snapshot=new CountDownLatch(1);var revoked=new CountDownLatch(1);long version=db.refund(refundId).version;
  String outboxProjection="SELECT status,attempt_count,cycle_attempt_count,lease_generation,available_at,lease_until,last_error_code,failed_at,completed_at FROM fm_outbox WHERE aggregate_id=?";var beforeOutbox=jdbc.queryForMap(outboxProjection,refundId);long paymentVersion=db.payment(paymentId).version,orderVersion=db.order(orderId).version;
  try(var pool=Executors.newSingleThreadExecutor()){
   var worker=pool.submit(()->{var tx=new TransactionTemplate(transactions);tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);try{return tx.execute(status->{
    db.refund(refundId);assertEquals("ACTIVE",jdbc.queryForObject("SELECT status FROM fm_auth_session WHERE session_id=?",String.class,finance.actor.sessionId()));snapshot.countDown();try{assertTrue(revoked.await(10,TimeUnit.SECONDS));}catch(InterruptedException e){throw new IllegalStateException(e);}
    try{processor.recover(finance.actor,refundId,version,"已撤销会话不得恢复");fail("A revoked session unexpectedly recovered the refund");}
    catch(ApiException denied){assertEquals(401,denied.status());status.setRollbackOnly();}return false;
   });}catch(org.springframework.dao.TransientDataAccessException serializedConflict){assertSqlState40001(serializedConflict);return false;}});
   assertTrue(snapshot.await(10,TimeUnit.SECONDS));new TransactionTemplate(transactions).executeWithoutResult(status->{db.lockUser(finance.actor.userId());jdbc.update("UPDATE fm_auth_session SET status='REVOKED' WHERE session_id=?",finance.actor.sessionId());});revoked.countDown();assertFalse(worker.get(10,TimeUnit.SECONDS));
  }
  assertEquals("DEAD",outboxState());assertEquals("FAILED",db.refund(refundId).status);assertEquals(version,db.refund(refundId).version);assertNull(db.receiptAmount(refundId));assertEquals(0,db.payment(paymentId).refundedAmount);assertEquals(amount,db.payment(paymentId).refundReserved);assertEquals(paymentVersion,db.payment(paymentId).version);assertEquals(orderVersion,db.order(orderId).version);assertEquals(beforeOutbox,jdbc.queryForMap(outboxProjection,refundId));
 }
 static void assertSqlState40001(org.springframework.dao.TransientDataAccessException failure){
  for(Throwable cause=failure;cause!=null;cause=cause.getCause())if(cause instanceof java.sql.SQLException sql&&"40001".equals(sql.getSQLState()))return;
  fail("Only a SQLSTATE40001 serialization rollback is an allowed database rejection",failure);
 }
 @Test void faultGuardRejectsPublicProfilesNonLoopbackAndDisabledControl(){
  for(String profile:List.of("showcase","prod","production","dev")){var env=new MockEnvironment();env.setActiveProfiles(profile);var sandbox=new SandboxSignature(true,"private-unit-test-secret-at-least-32-bytes",env,clock);assertThrows(IllegalStateException.class,()->new SandboxRefundFaults(db,clock,env,sandbox,true,"127.0.0.1"));}
  var env=new MockEnvironment();env.setActiveProfiles("test");var sandbox=new SandboxSignature(true,"private-unit-test-secret-at-least-32-bytes",env,clock);assertThrows(IllegalStateException.class,()->new SandboxRefundFaults(db,clock,env,sandbox,true,"0.0.0.0"));var disabled=new SandboxRefundFaults(db,clock,env,sandbox,false,"127.0.0.1");assertThrows(IllegalStateException.class,()->disabled.arm(refundId,SandboxRefundFaults.Mode.REJECT_BEFORE_COMMIT,1));assertThrows(IllegalStateException.class,()->new RefundRecoveryPolicy(0,10,300,30));
 }
}
