package com.freshmart.identity;

import com.freshmart.common.*;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real H2/MySQL-mode transactions and HTTP filters; not a MySQL concurrency certification. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:identity;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.username=sa","spring.datasource.password=","app.token-secret=identity-test-only-randomizable-secret-123456789","app.secure-cookies=false"})
@AutoConfigureMockMvc
class IdentityIntegrationTest {
 static final String PASSWORD="Test-password-2026!";static final AtomicLong PHONE=new AtomicLong(13900000000L);
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired AuthenticationService auth;@Autowired IdentityMapper mapper;@Autowired JdbcTemplate jdbc;@Autowired PlatformTransactionManager tx;@Autowired PermissionRegistry permissions;
 record Session(String userId,String access,String refresh,String csrf,String context){}
 record Csrf(String token,String context){}
 String phone(){return Long.toString(PHONE.incrementAndGet());}
 JsonNode data(MvcResult result)throws Exception{return json.readTree(result.getResponse().getContentAsString()).path("data");}
 String cookie(MvcResult result,String name){return result.getResponse().getHeaders("Set-Cookie").stream().filter(h->h.startsWith(name+"=")).map(h->h.substring(name.length()+1,h.indexOf(';'))).findFirst().orElseThrow();}
 Csrf csrf()throws Exception{var r=mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn();return new Csrf(data(r).path("csrfToken").asString(),cookie(r,"csrf_context"));}
 Session register(String phone)throws Exception{var c=csrf();var r=mvc.perform(post("/api/v1/auth/register").header("Origin","http://localhost:5173").header("X-CSRF-Token",c.token()).cookie(new Cookie("csrf_context",c.context())).contentType("application/json").content(json.writeValueAsString(Map.of("phone",phone,"password",PASSWORD,"displayName","会员")))).andExpect(status().isCreated()).andReturn();return session(r);}
 Session session(MvcResult r)throws Exception{var d=data(r);return new Session(d.path("user").path("userId").asString(),d.path("accessToken").asString(),cookie(r,"refresh_token"),d.path("csrfToken").asString(),cookie(r,"csrf_context"));}
 MvcResult refresh(Session s,int expected)throws Exception{return mvc.perform(post("/api/v1/auth/refresh").header("Origin","http://localhost:5173").header("X-CSRF-Token",s.csrf()).cookie(new Cookie("csrf_context",s.context()),new Cookie("refresh_token",s.refresh()))).andExpect(status().is(expected)).andReturn();}

 @Test void registerPersistsOnlyHashesAndReturnsMaskedContract()throws Exception{
  String p=phone();Session s=register(p);var user=mapper.userById(s.userId());assertNotEquals(PASSWORD,user.passwordHash());assertTrue(user.passwordHash().startsWith("pbkdf2-sha256$"));assertTrue(user.passwordHash().length()<=100);
  var db=mapper.sessionByAccessHash(TokenCodec.hash(s.access()));assertNotNull(db);assertEquals(TokenCodec.hash(s.refresh()),db.refreshHash());assertNotEquals(s.refresh(),db.refreshHash());
  var r=mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+s.access())).andExpect(status().isOk()).andExpect(jsonPath("$.code").value(0)).andExpect(jsonPath("$.data.phoneMasked").value(p.substring(0,3)+"****"+p.substring(7))).andExpect(jsonPath("$.data.roles[0]").value("MEMBER")).andExpect(header().string("Cache-Control","no-store")).andReturn();
  var root=json.readTree(r.getResponse().getContentAsString());assertDoesNotThrow(()->OffsetDateTime.parse(root.path("timestamp").asString()));assertTrue(data(r).path("permissions").toString().contains("order.create"));assertFalse(r.getResponse().getContentAsString().contains("passwordHash"));
 }
 @Test void authenticationCsrfRolesAndUnknownFieldsFailClosed()throws Exception{
  mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/v1/auth/register").contentType("application/json").content(json.writeValueAsString(Map.of("phone",phone(),"password",PASSWORD,"displayName","会员")))).andExpect(status().isForbidden());
  var c=csrf();mvc.perform(post("/api/v1/auth/login").header("Origin","https://untrusted.invalid").header("X-CSRF-Token",c.token()).cookie(new Cookie("csrf_context",c.context())).contentType("application/json").content(json.writeValueAsString(Map.of("phone",phone(),"password",PASSWORD)))).andExpect(status().isForbidden());
  mvc.perform(post("/api/v1/auth/login").header("Origin","http://localhost:5173").header("X-CSRF-Token",c.token()).cookie(new Cookie("csrf_context",c.context())).contentType("application/json").content(json.writeValueAsString(Map.of("phone",phone(),"password",PASSWORD,"roles",List.of("ADMIN"))))).andExpect(status().isBadRequest());
  Session s=register(phone());mvc.perform(get("/api/v1/admin/products").header("Authorization","Bearer "+s.access())).andExpect(status().isForbidden());
  jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",s.userId());mapper.insertRole(s.userId(),"ADMIN");mvc.perform(get("/api/v1/orders").header("Authorization","Bearer "+s.access())).andExpect(status().isForbidden());
  mvc.perform(get("/api/v1/undeclared").header("Authorization","Bearer "+s.access())).andExpect(status().isNotFound());
  mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+s.access()+"broken")).andExpect(status().isUnauthorized());
 }
 @Test void rotationInvalidatesOldAccessAndReplayRevokesFamilyWithoutExtendingExpiry()throws Exception{
  Session s=register(phone());Instant limit=Instant.now().plusSeconds(3600).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);jdbc.update("UPDATE fm_auth_session SET refresh_expires_at=? WHERE user_id=?",Timestamp.from(limit),s.userId());
  var result=refresh(s,200);Session next=session(result);assertEquals(limit,mapper.sessionByRefreshHash(TokenCodec.hash(next.refresh())).refreshExpiresAt());assertTrue(result.getResponse().getHeaders("Set-Cookie").stream().anyMatch(h->h.startsWith("refresh_token=")&&!h.contains("Max-Age=604800")));
  mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+s.access())).andExpect(status().isUnauthorized());mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+next.access())).andExpect(status().isOk());
  refresh(s,401);assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE actor_id=? AND operation='auth.refresh.replay'",Integer.class,s.userId()));mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+next.access())).andExpect(status().isUnauthorized());
 }
 @Test void logoutRevokesFamilyAndClearsCookies()throws Exception{
  Session s=register(phone());mvc.perform(post("/api/v1/auth/logout").header("Origin","http://localhost:5173").header("X-CSRF-Token",s.csrf()).cookie(new Cookie("csrf_context",s.context()),new Cookie("refresh_token",s.refresh()))).andExpect(status().isOk()).andExpect(header().stringValues("Set-Cookie",org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.containsString("Max-Age=0"))));
  mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+s.access())).andExpect(status().isUnauthorized());
 }
 @Test void passwordChangeUsesIdempotencyAndRevokesEverySession()throws Exception{
  String p=phone();Session s=register(p);var second=auth.login(p,PASSWORD);String body=json.writeValueAsString(Map.of("currentPassword",PASSWORD,"newPassword","Replacement-password-2026!"));
  mvc.perform(post("/api/v1/auth/password").header("Authorization","Bearer "+s.access()).contentType("application/json").content(body)).andExpect(status().isBadRequest());
  mvc.perform(post("/api/v1/auth/password").header("Authorization","Bearer "+s.access()).header("Idempotency-Key",UUID.randomUUID().toString()).contentType("application/json").content(body)).andExpect(status().isOk());
  assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM fm_auth_session WHERE user_id=? AND status='ACTIVE'",Integer.class,s.userId()));assertThrows(ApiException.class,()->auth.authenticate(second.body().accessToken()));assertThrows(ApiException.class,()->auth.login(p,PASSWORD));assertNotNull(auth.login(p,"Replacement-password-2026!"));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE actor_id=? AND operation='auth.password'",Integer.class,s.userId()));String audits=json.writeValueAsString(jdbc.queryForList("SELECT * FROM fm_audit_event WHERE actor_id=?",s.userId()));assertFalse(audits.contains(PASSWORD));assertFalse(audits.contains(s.refresh()));assertFalse(audits.contains(p));
 }
 @Test void passwordChangeSerializesWithRefreshAndOldPasswordLogin()throws Exception{
  for(boolean refreshing:List.of(true,false)){
   String p=phone();var issued=auth.register(p,PASSWORD,"并发测试");var actor=auth.authenticate(issued.body().accessToken());var executor=Executors.newSingleThreadExecutor();var started=new CountDownLatch(1);var future=new java.util.concurrent.atomic.AtomicReference<Future<?>>();
   try{new TransactionTemplate(tx).executeWithoutResult(status->{mapper.lockUser(actor.userId());future.set(executor.submit(()->{started.countDown();return refreshing?auth.refresh(issued.refresh()):auth.login(p,PASSWORD);}));try{assertTrue(started.await(2,TimeUnit.SECONDS));assertThrows(TimeoutException.class,()->future.get().get(150,TimeUnit.MILLISECONDS));}catch(InterruptedException e){Thread.currentThread().interrupt();throw new RuntimeException(e);}auth.changePassword(actor,PASSWORD,"Replacement-password-2026!");});
    ExecutionException error=assertThrows(ExecutionException.class,()->future.get().get(5,TimeUnit.SECONDS));assertInstanceOf(ApiException.class,error.getCause());assertEquals(401,((ApiException)error.getCause()).status());assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM fm_auth_session WHERE user_id=? AND status='ACTIVE'",Integer.class,actor.userId()));
   }finally{executor.shutdownNow();}
  }
 }
 @Test void throttlingPersistsAcrossFailedTransactions(){String p=phone();for(int i=0;i<5;i++)assertEquals(401,assertThrows(ApiException.class,()->auth.login(p,PASSWORD)).status());assertEquals(429,assertThrows(ApiException.class,()->auth.login(p,PASSWORD)).status());}
 @Test void rolesDoNotInheritOtherJobsAndOwnerMismatchIsHidden(){assertTrue(permissions.permissions(Set.of("COURIER")).contains("delivery.self.read"));assertFalse(permissions.permissions(Set.of("PICKER")).contains("delivery.self.read"));assertFalse(permissions.permissions(Set.of("ADMIN")).contains("order.create"));assertEquals(404,assertThrows(ApiException.class,()->new RequestActor("me",Set.of("MEMBER"),Set.of(),"session").requireOwner("other")).status());}
}
