package com.freshmart.finance;

import com.freshmart.audit.AuditRecorder;
import com.freshmart.checkout.*;
import com.freshmart.commerce.*;
import com.freshmart.common.*;
import com.freshmart.identity.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.freshmart.commerce.CommerceModels.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Independent real relational database per test; fixture corruption never touches the live demo. */
@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.username=sa","spring.datasource.password=",
 "app.token-secret=finance-audit-test-only-secret-not-a-runtime-credential-123456789",
 "app.sandbox-enabled=true","app.sandbox-secret=finance-audit-channel-test-only-secret-not-a-runtime-credential-987654321",
 "app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class FinanceAuditIntegrationTest {
 static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
 static final AtomicLong PHONES=new AtomicLong(13500000000L);
 static final String PASSWORD="Finance-audit-test-only-password-2026!";
 @DynamicPropertySource static void isolatedDatabase(DynamicPropertyRegistry registry){String url="jdbc:h2:mem:financeaudit_"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";registry.add("spring.datasource.url",()->url);}
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired Clock clock;
 @Autowired AuthenticationService auth;@Autowired IdentityMapper identities;@Autowired EmployeeMapper employees;@Autowired EmployeeService employeeService;
 @Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;@Autowired CommerceService commerce;@Autowired CommerceMapper commerceDb;
 @Autowired SandboxSignature signatures;@Autowired RefundProcessor refunds;@Autowired SandboxRefundGateway gateway;@Autowired AuditRecorder audits;
 Account member,finance,admin,operator;String sku,batch;CheckoutModels.AddressView address;CheckoutModels.SlotRow slot;
 record Account(RequestActor actor,String token,String phone){}
 record Paid(String orderId,String paymentId,long amount,String tradeNo){}
 @BeforeEach void fixture(){
  member=account("MEMBER");finance=account("FINANCE");admin=account("ADMIN");operator=account("OPERATOR");
  address=checkout.createAddress(member.actor().userId(),new CheckoutModels.AddressInput("合成收件人","13800138000","上海市","上海市","松江区","东华大学财务验收合成地址",true));
  // Startup already creates canonical windows; use the actual stored ID rather
  // than inserting a duplicate window whose ON DUPLICATE KEY path retains its ID.
  checkout.initializeSlots();slot=checkoutDb.slots(today().plusDays(1)).stream().filter(row->row.startAt().atZone(ZONE).getHour()==14).findFirst().orElseThrow();
  assertNotNull(checkoutDb.slot(slot.slotId()));Instant start=slot.startAt();
  String cat=id("cat"),product=id("spu");sku=id("sku");batch=id("batch");
  jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'生鲜','鲜','http://localhost:8080/catalog/S001.jpg')",cat,cat);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'财务测试商品','独立数据库真实交易','上海','COLD','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,cat);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url,status) VALUES(?,?,?,'一件','件','PIECE','BY_PIECE',NULL,1000,900,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
  jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'warehouse-main',?,?,'NORMAL',100,0,0)",batch,sku,batch,Timestamp.from(clock.instant().minusSeconds(86400)),Timestamp.from(start.plusSeconds(10*86400)));
 }
 Account account(String role){String phone=Long.toString(PHONES.incrementAndGet());var session=auth.register(phone,PASSWORD,role);String id=session.body().user().userId();if(!role.equals("MEMBER")){jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",id);identities.insertRole(id,role);employees.insert(id,clock.instant());}return new Account(auth.authenticate(session.body().accessToken()),session.body().accessToken(),phone);}
 LocalDate today(){return LocalDate.now(clock.withZone(ZONE));}
 String id(String prefix){return prefix+"_"+UUID.randomUUID();}
 String key(){return UUID.randomUUID().toString();}
 JsonNode data(MvcResult result)throws Exception{return json.readTree(result.getResponse().getContentAsString()).path("data");}
 String order(){var quote=checkout.quote(member.actor().userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,1L)),address.addressId(),slot.slotId(),null));return (String)commerce.create(member.actor(),new CreateOrder(quote.quoteId(),quote.quoteToken(),null)).get("orderId");}
 MvcResult callback(Callback event)throws Exception{String raw=json.writeValueAsString(event);var signed=signatures.sign(raw);return mvc.perform(post("/api/v1/payments/sandbox/callback").header("X-Sandbox-Timestamp",signed.timestamp()).header("X-Sandbox-Nonce",signed.nonce()).header("X-Sandbox-Signature",signed.signature()).contentType("application/json").content(raw)).andExpect(status().isOk()).andReturn();}
 Paid pay(boolean retransmit)throws Exception{String order=order();var payment=commerce.prepay(member.actor(),new Prepay(order,"ORDER",null));String paymentId=(String)payment.get("paymentId"),trade=id("trade");long amount=((Number)payment.get("amount")).longValue();var event=new Callback(id("event"),paymentId,trade,"SUCCESS",amount,"CNY",clock.instant());assertFalse(data(callback(event)).path("duplicate").asBoolean());if(retransmit){assertTrue(data(callback(event)).path("duplicate").asBoolean());callback(new Callback(id("event"),paymentId,trade,"SUCCESS",amount,"CNY",clock.instant()));}return new Paid(order,paymentId,amount,trade);}
 MvcResult reconcile(Account actor,LocalDate date,String key,int expected)throws Exception{return mvc.perform(post("/api/v1/admin/reconciliations").header("Authorization","Bearer "+actor.token()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(Map.of("businessDate",date.toString())))).andExpect(status().is(expected)).andReturn();}
 MvcResult auditQuery(Account actor,String resource,int page,int size)throws Exception{return mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization","Bearer "+actor.token()).param("resourceId",resource).param("page",Integer.toString(page)).param("size",Integer.toString(size))).andExpect(status().isOk()).andReturn();}

 @Test void verifiedCallbacksAndActualRefundReconcileOnceWithoutDifferences()throws Exception{
  Paid paid=pay(true);assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_payment WHERE order_id=? AND status='SUCCESS'",Integer.class,paid.orderId()));assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM fm_sandbox_payment_receipt WHERE payment_id=? AND status='SUCCESS'",Integer.class,paid.paymentId()));
  var order=commerceDb.order(paid.orderId());commerce.cancel(member.actor(),order.orderId,new ReasonVersion("财务验收真实沙箱取消",order.version),false);
  var refund=commerceDb.refunds(order.orderId).getFirst();var claimed=refunds.claim(refund.refundId);assertNotNull(claimed);gateway.execute(claimed);refunds.complete(claimed);
  String key=key();var result=reconcile(finance,today(),key,201);var report=data(result);assertEquals("COMPLETED",report.path("status").asString());assertEquals(1,report.path("paymentCount").asLong());assertEquals(paid.amount(),report.path("paymentAmount").asLong());assertEquals(1,report.path("refundCount").asLong());assertEquals(paid.amount(),report.path("refundAmount").asLong());assertEquals(0,report.path("differenceCount").asLong());assertEquals(0,report.path("differenceAmount").asLong());assertEquals(0,report.path("differences").size());
  assertEquals(report,data(reconcile(finance,today(),key,201)));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_reconciliation",Integer.class));assertEquals(paid.amount(),commerceDb.order(paid.orderId()).paidAmount);assertEquals(paid.amount(),commerceDb.order(paid.orderId()).refundedAmount);
 }
 @Test void independentBookChannelAndOrderCorruptionIsReportedWithoutRepairingAnything()throws Exception{
  Paid book=pay(false),channel=pay(false),order=pay(false);
  jdbc.update("UPDATE fm_payment SET amount=amount+7 WHERE payment_id=?",book.paymentId());jdbc.update("UPDATE fm_sandbox_payment_receipt SET amount=amount+11 WHERE payment_id=?",channel.paymentId());jdbc.update("UPDATE fm_order SET paid_amount=paid_amount+13 WHERE order_id=?",order.orderId());
  String before=json.writeValueAsString(jdbc.queryForList("SELECT payment_id,amount FROM fm_payment ORDER BY payment_id"))+json.writeValueAsString(jdbc.queryForList("SELECT event_id,amount FROM fm_sandbox_payment_receipt ORDER BY event_id"))+json.writeValueAsString(jdbc.queryForList("SELECT order_id,paid_amount,refunded_amount FROM fm_order ORDER BY order_id"));
  var report=data(reconcile(finance,today(),key(),201));assertTrue(report.path("differenceCount").asLong()>=4);assertEquals(-4,report.path("differenceAmount").asLong());var differences=report.path("differences");
  assertTrue(differences.toString().contains(book.paymentId()));assertTrue(differences.toString().contains(channel.paymentId()));assertTrue(differences.toString().contains(order.orderId()));assertTrue(differences.toString().contains("AMOUNT_MISMATCH"));assertTrue(differences.toString().contains("ORDER_PAID_MISMATCH"));
  String after=json.writeValueAsString(jdbc.queryForList("SELECT payment_id,amount FROM fm_payment ORDER BY payment_id"))+json.writeValueAsString(jdbc.queryForList("SELECT event_id,amount FROM fm_sandbox_payment_receipt ORDER BY event_id"))+json.writeValueAsString(jdbc.queryForList("SELECT order_id,paid_amount,refunded_amount FROM fm_order ORDER BY order_id"));assertEquals(before,after,"Reconciliation must never auto-repair books or channel evidence");
 }
 @Test void historicPaymentWithoutIndependentReceiptRemainsAnExplicitDifference()throws Exception{
  Paid paid=pay(false);jdbc.update("DELETE FROM fm_sandbox_payment_receipt WHERE payment_id=?",paid.paymentId());
  var report=data(reconcile(finance,today(),key(),201));assertEquals(1,report.path("differenceCount").asLong());assertEquals(paid.amount(),report.path("differenceAmount").asLong());assertEquals("MISSING_CHANNEL",report.path("differences").get(0).path("type").asString());assertTrue(report.path("differences").get(0).path("channelAmount").isNull());
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM fm_sandbox_payment_receipt WHERE payment_id=?",Integer.class,paid.paymentId()));assertEquals(paid.amount(),commerceDb.order(paid.orderId()).paidAmount);
 }
 @Test void financePermissionsIdempotencyDateValidationAndFilteredPaginationAreReal()throws Exception{
  mvc.perform(get("/api/v1/admin/reconciliations")).andExpect(status().isUnauthorized());for(Account other:List.of(member,operator,admin)){mvc.perform(get("/api/v1/admin/reconciliations").header("Authorization","Bearer "+other.token())).andExpect(status().isForbidden());reconcile(other,today(),key(),403);}
  mvc.perform(post("/api/v1/admin/reconciliations").header("Authorization","Bearer "+finance.token()).contentType("application/json").content(json.writeValueAsString(Map.of("businessDate",today().toString())))).andExpect(status().isBadRequest());
  reconcile(finance,today().plusDays(1),key(),400);reconcile(finance,today().minusDays(367),key(),400);String key=key();var first=data(reconcile(finance,today(),key,201));reconcile(finance,today().minusDays(1),key,409);var yesterday=data(reconcile(finance,today().minusDays(1),key(),201));
  var list=mvc.perform(get("/api/v1/admin/reconciliations").header("Authorization","Bearer "+finance.token()).param("businessDate",today().minusDays(1).toString()).param("size","1")).andExpect(status().isOk()).andReturn();assertEquals(1,data(list).path("total").asLong());assertEquals(yesterday.path("reconciliationId").asString(),data(list).path("items").get(0).path("reconciliationId").asString());assertNotEquals(first.path("reconciliationId").asString(),yesterday.path("reconciliationId").asString());
  mvc.perform(get("/api/v1/admin/reconciliations").header("Authorization","Bearer "+finance.token()).param("size","101")).andExpect(status().isBadRequest());mvc.perform(get("/api/v1/admin/reconciliations").header("Authorization","Bearer "+finance.token()).param("businessDate","2026-99-99")).andExpect(status().isBadRequest());
 }
 @Test void auditRoleSnapshotsSurviveRealEmployeeRoleChangesAndSessionRevocation()throws Exception{
  String target=id("snapshot");audits.record(operator.actor(),"snapshot.before","TEST",target,"SUCCESS","岗位变更前事件");
  employeeService.setRoles(admin.actor(),operator.actor().userId(),new EmployeeModels.Roles(List.of("FINANCE"),"审计快照验收：岗位从运营改为财务",0L));mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+operator.token())).andExpect(status().isUnauthorized());
  var fresh=auth.login(operator.phone(),PASSWORD);RequestActor now=auth.authenticate(fresh.body().accessToken());audits.record(now,"snapshot.after","TEST",target,"SUCCESS","岗位变更后事件");
  var page=data(auditQuery(admin,target,1,20));assertEquals(2,page.path("total").asLong());JsonNode before=null,after=null;for(var event:page.path("items")){if(event.path("action").asString().equals("snapshot.before"))before=event;if(event.path("action").asString().equals("snapshot.after"))after=event;}
  assertNotNull(before);assertNotNull(after);assertEquals("OPERATOR",before.path("actorRoles").get(0).asString());assertEquals("FINANCE",after.path("actorRoles").get(0).asString());assertEquals("OPERATOR",jdbc.queryForObject("SELECT actor_roles_snapshot FROM fm_audit_event WHERE resource_id=? AND operation='snapshot.before'",String.class,target));
 }
 @Test void legacyAuditsStayUnknownAndFreeTextAndCommerceReasonsAreRedacted()throws Exception{
  String legacy=id("legacy"),raw="联系13800138000 password=NeverPublishThis token=SensitiveValue";
  jdbc.update("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at) VALUES(?,?,'legacy.sample','TEST',?,?,?,?)",id("audit"),member.actor().userId(),legacy,raw,id("trace"),Timestamp.from(clock.instant().minusSeconds(60)));
  var page=data(auditQuery(admin,legacy,1,20));assertEquals(1,page.path("total").asLong());var event=page.path("items").get(0);assertEquals(0,event.path("actorRoles").size());assertEquals("UNKNOWN",event.path("result").asString());String encoded=page.toString();for(String sensitive:List.of("13800138000","NeverPublishThis","SensitiveValue"))assertFalse(encoded.contains(sensitive));assertEquals(raw,jdbc.queryForObject("SELECT reason FROM fm_audit_event WHERE resource_id=?",String.class,legacy),"Read must not backfill or rewrite legacy records");
  String order=order();var current=commerceDb.order(order);commerce.cancel(member.actor(),order,new ReasonVersion(raw,current.version),false);var stored=jdbc.queryForMap("SELECT reason,actor_roles_snapshot,outcome FROM fm_audit_event WHERE resource_id=? AND operation='order.cancel'",order);assertEquals("MEMBER",stored.get("actor_roles_snapshot"));assertEquals("SUCCESS",stored.get("outcome"));for(String sensitive:List.of("13800138000","NeverPublishThis","SensitiveValue"))assertFalse(stored.get("reason").toString().contains(sensitive));
 }
 @Test void auditIsAdminOnlyAndEnforcesDatabasePaginationAndBoundedWindow()throws Exception{
  mvc.perform(get("/api/v1/admin/audit-logs")).andExpect(status().isUnauthorized());for(Account other:List.of(member,finance,operator))mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization","Bearer "+other.token())).andExpect(status().isForbidden());
  String target=id("pagination");for(int i=0;i<3;i++)audits.record(operator.actor(),"page.sample."+i,"TEST",target,"SUCCESS","分页事件");JsonNode first=data(auditQuery(admin,target,1,2)),second=data(auditQuery(admin,target,2,2));assertEquals(3,first.path("total").asLong());assertEquals(2,first.path("items").size());assertEquals(1,second.path("items").size());Set<String> ids=new HashSet<>();for(var event:first.path("items"))ids.add(event.path("auditId").asString());assertFalse(ids.contains(second.path("items").get(0).path("auditId").asString()));
  String from=clock.instant().minusSeconds(60).toString(),to=clock.instant().plusSeconds(30).toString();var filtered=mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization","Bearer "+admin.token()).param("resourceId",target).param("actorId",operator.actor().userId()).param("from",from).param("to",to)).andExpect(status().isOk()).andReturn();assertEquals(3,data(filtered).path("total").asLong());
  for(String[] range:List.of(new String[]{to,from},new String[]{clock.instant().minus(Duration.ofDays(32)).toString(),to},new String[]{from,clock.instant().plusSeconds(600).toString()}))mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization","Bearer "+admin.token()).param("from",range[0]).param("to",range[1])).andExpect(status().isBadRequest());
  mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization","Bearer "+admin.token()).param("size","101")).andExpect(status().isBadRequest());mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization","Bearer "+admin.token()).param("actorId","bad/id")).andExpect(status().isBadRequest());
 }
}
