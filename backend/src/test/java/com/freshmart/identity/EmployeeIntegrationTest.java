package com.freshmart.identity;

import com.freshmart.common.*;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;
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

/** Actual HTTP filters, JDBC transactions and row-lock concurrency; H2 is not MySQL certification. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:employees;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.username=sa","spring.datasource.password=","app.token-secret=employee-test-only-secret-not-a-runtime-credential-123456789","app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
class EmployeeIntegrationTest {
 static final String PASSWORD="Employee-test-password-2026!",REPLACEMENT="Employee-new-password-2026!";
 static final AtomicLong PHONE=new AtomicLong(13700000000L);
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired IdentityMapper users;@Autowired EmployeeMapper employees;@Autowired EmployeeService service;@Autowired AuthenticationService auth;@Autowired PasswordHasher passwords;@Autowired PlatformTransactionManager tx;
 record Session(String userId,String phone,String access,RequestActor actor) {}
 @BeforeEach void clear(){for(String table:List.of("fm_idempotency","fm_audit_event","fm_auth_session","fm_employee","fm_user_role","fm_user"))jdbc.update("DELETE FROM "+table);}
 Session account(String role,boolean employee){String id=UUID.randomUUID().toString(),phone=Long.toString(PHONE.incrementAndGet());var now=Instant.now();users.insertUser(new UserRow(id,phone,passwords.encode(PASSWORD),"测试"+role,"ACTIVE",false,0,now,now));users.insertRole(id,role);if(employee)employees.insert(id,now);var login=auth.login(phone,PASSWORD);return new Session(id,phone,login.body().accessToken(),auth.authenticate(login.body().accessToken()));}
 JsonNode data(MvcResult result)throws Exception{return json.readTree(result.getResponse().getContentAsString()).path("data");}
 String key(){return UUID.randomUUID().toString();}
 Map<String,Object> createBody(String phone,List<String> roles){return Map.of("phone",phone,"displayName","新员工","temporaryPassword",PASSWORD,"roles",roles);}
 MvcResult create(Session admin,String phone,List<String> roles,String key,int expected)throws Exception{return mvc.perform(post("/api/v1/admin/employees").header("Authorization","Bearer "+admin.access()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(createBody(phone,roles)))).andExpect(status().is(expected)).andReturn();}
 MvcResult roles(Session admin,String target,List<String> roles,long version,String key,int expected)throws Exception{return mvc.perform(put("/api/v1/admin/employees/"+target+"/roles").header("Authorization","Bearer "+admin.access()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(Map.of("roles",roles,"version",version,"reason","调整员工岗位")))).andExpect(status().is(expected)).andReturn();}
 MvcResult setStatus(Session admin,String target,String value,long version,int expected)throws Exception{return mvc.perform(put("/api/v1/admin/employees/"+target+"/status").header("Authorization","Bearer "+admin.access()).header("Idempotency-Key",key()).contentType("application/json").content(json.writeValueAsString(Map.of("status",value,"version",version,"reason","停启员工账户")))).andExpect(status().is(expected)).andReturn();}

 @Test void createReturnsOnlyMaskedFieldsAndPersistsHashAndExactlyOnce()throws Exception{
  Session admin=account("ADMIN",true);Session member=account("MEMBER",false);String phone=Long.toString(PHONE.incrementAndGet()),key=key();
  var first=create(admin,phone,List.of("PICKER","MEMBER"),key,201);var result=data(first);String id=result.path("employeeId").asString();assertEquals(id,result.path("userId").asString());assertEquals(0,result.path("version").asLong());assertTrue(result.path("mustChangePassword").asBoolean());assertEquals(phone.substring(0,3)+"****"+phone.substring(7),result.path("phoneMasked").asString());
  assertEquals(result,data(create(admin,phone,List.of("PICKER","MEMBER"),key,201)));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_user WHERE phone=?",Integer.class,phone));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE operation='employee.create'",Integer.class));
  assertTrue(passwords.matches(PASSWORD,users.userById(id).passwordHash()));assertFalse(first.getResponse().getContentAsString().contains("password"));
  var list=mvc.perform(get("/api/v1/admin/employees").header("Authorization","Bearer "+admin.access())).andExpect(status().isOk()).andReturn();assertEquals(2,data(list).path("total").asLong());assertFalse(list.getResponse().getContentAsString().contains(member.userId()));assertFalse(list.getResponse().getContentAsString().contains(phone));
  var roleList=mvc.perform(get("/api/v1/admin/roles").header("Authorization","Bearer "+admin.access())).andExpect(status().isOk()).andReturn();assertEquals(7,data(roleList).path("items").size());
  create(admin,Long.toString(PHONE.incrementAndGet()),List.of("PICKER"),key,409);
  String persisted=json.writeValueAsString(jdbc.queryForList("SELECT * FROM fm_idempotency"))+json.writeValueAsString(jdbc.queryForList("SELECT * FROM fm_audit_event"));assertFalse(persisted.contains(PASSWORD));assertFalse(persisted.contains(phone));assertFalse(persisted.contains(admin.access()));
 }
 @Test void authenticationWrongRolesInvalidRolesAndMemberTakeoverFailClosed()throws Exception{
  Session admin=account("ADMIN",true),member=account("MEMBER",false),operator=account("OPERATOR",true);
  mvc.perform(get("/api/v1/admin/employees")).andExpect(status().isUnauthorized());
  for(Session other:List.of(member,operator)){mvc.perform(get("/api/v1/admin/employees").header("Authorization","Bearer "+other.access())).andExpect(status().isForbidden());create(other,Long.toString(PHONE.incrementAndGet()),List.of("PICKER"),key(),403);}
  create(admin,Long.toString(PHONE.incrementAndGet()),List.of("SYSTEM"),key(),400);create(admin,Long.toString(PHONE.incrementAndGet()),List.of("PICKER","PICKER"),key(),400);create(admin,member.phone(),List.of("ADMIN"),key(),409);
  roles(admin,member.userId(),List.of("ADMIN"),0,key(),404);setStatus(admin,member.userId(),"DISABLED",0,404);assertEquals(List.of("MEMBER"),users.roles(member.userId()));assertEquals("ACTIVE",users.userById(member.userId()).status());
  mvc.perform(get("/api/v1/admin/employees").param("size","101").header("Authorization","Bearer "+admin.access())).andExpect(status().isBadRequest());
 }
 @Test void roleAndStatusUpdatesRevokeOldSessionsAndRejectStaleVersion()throws Exception{
  Session admin=account("ADMIN",true),picker=account("PICKER",true);var second=auth.login(picker.phone(),PASSWORD);
  var changed=roles(admin,picker.userId(),List.of("COURIER","MEMBER"),0,key(),200);assertEquals(1,data(changed).path("version").asLong());
  assertEquals(401,assertThrows(ApiException.class,()->auth.authenticate(picker.access())).status());assertEquals(401,assertThrows(ApiException.class,()->auth.authenticate(second.body().accessToken())).status());
  roles(admin,picker.userId(),List.of("ADMIN"),0,key(),409);assertEquals(List.of("COURIER","MEMBER"),users.roles(picker.userId()));
  var fresh=auth.login(picker.phone(),PASSWORD);setStatus(admin,picker.userId(),"DISABLED",1,200);assertEquals(401,assertThrows(ApiException.class,()->auth.authenticate(fresh.body().accessToken())).status());assertThrows(ApiException.class,()->auth.login(picker.phone(),PASSWORD));
  setStatus(admin,picker.userId(),"ACTIVE",2,200);assertNotNull(auth.login(picker.phone(),PASSWORD));assertEquals(3,users.userById(picker.userId()).version());
 }
 @Test void selfChangesAreRejectedAndDenialAuditSurvivesRollback()throws Exception{
  Session admin=account("ADMIN",true);roles(admin,admin.userId(),List.of("MEMBER"),0,key(),403);setStatus(admin,admin.userId(),"DISABLED",0,403);
  assertEquals(1,employees.activeAdmins());assertEquals(0,users.userById(admin.userId()).version());assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE operation='employee.command.denied'",Integer.class));
  var records=jdbc.queryForList("SELECT * FROM fm_audit_event WHERE operation='employee.command.denied'");String audit=json.writeValueAsString(records);assertTrue(audit.contains("SELF_ROLE_CHANGE"));assertTrue(audit.contains("SELF_STATUS_CHANGE"));assertFalse(audit.contains(PASSWORD));assertFalse(audit.contains(admin.phone()));assertFalse(audit.contains(admin.access()));
 }
 @Test void concurrentMutualAdminRemovalPreservesOneAdminAndRevokesLoser()throws Exception{
  for(boolean removeRole:List.of(false,true)){
   clear();Session a=account("ADMIN",true),b=account("ADMIN",true);var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
   try{List<Callable<Integer>> calls=List.of(()->changeAfterGate(gate,a,b,removeRole),()->changeAfterGate(gate,b,a,removeRole));List<Future<Integer>> futures=new ArrayList<>();for(var call:calls)futures.add(pool.submit(call));gate.countDown();List<Integer> outcomes=new ArrayList<>();for(var future:futures)outcomes.add(future.get(10,TimeUnit.SECONDS));Collections.sort(outcomes);assertEquals(List.of(200,401),outcomes);assertEquals(1,employees.activeAdmins());assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE operation='employee.command.denied'",Integer.class));
   }finally{pool.shutdownNow();}
  }
 }
 private int changeAfterGate(CountDownLatch gate,Session actor,Session target,boolean removeRole)throws Exception{gate.await();try{if(removeRole)service.setRoles(actor.actor(),target.userId(),new EmployeeModels.Roles(List.of("MEMBER"),"并发岗位变更",0L));else service.setStatus(actor.actor(),target.userId(),new EmployeeModels.Status("DISABLED","并发停用",0L));return 200;}catch(ApiException e){return e.status();}}
 @Test void governanceUsesDatabaseMutexInsteadOfProcessLocalLock()throws Exception{
  Session admin=account("ADMIN",true),picker=account("PICKER",true);var pool=Executors.newSingleThreadExecutor();var started=new CountDownLatch(1);var future=new java.util.concurrent.atomic.AtomicReference<Future<EmployeeModels.Employee>>();
  try{new TransactionTemplate(tx).executeWithoutResult(s->{employees.lockGovernance();future.set(pool.submit(()->{started.countDown();return service.setStatus(admin.actor(),picker.userId(),new EmployeeModels.Status("DISABLED","事务互斥验证",0L));}));try{assertTrue(started.await(2,TimeUnit.SECONDS));assertThrows(TimeoutException.class,()->future.get().get(150,TimeUnit.MILLISECONDS));}catch(InterruptedException e){Thread.currentThread().interrupt();throw new RuntimeException(e);}});assertEquals("DISABLED",future.get().get(5,TimeUnit.SECONDS).status());}finally{pool.shutdownNow();}
 }
 @Test void temporaryEmployeeMustChangePasswordBeforeBusinessAndOldTokenDies()throws Exception{
  Session admin=account("ADMIN",true);String phone=Long.toString(PHONE.incrementAndGet());var created=data(create(admin,phone,List.of("PICKER"),key(),201));assertTrue(created.path("mustChangePassword").asBoolean());var login=auth.login(phone,PASSWORD);String token=login.body().accessToken();
  mvc.perform(get("/api/v1/admin/pick-tasks").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isOk());
  mvc.perform(post("/api/v1/auth/password").header("Authorization","Bearer "+token).header("Idempotency-Key",key()).contentType("application/json").content(json.writeValueAsString(Map.of("currentPassword",PASSWORD,"newPassword",REPLACEMENT)))).andExpect(status().isOk());
  assertFalse(users.userById(created.path("userId").asString()).mustChangePassword());mvc.perform(get("/api/v1/auth/me").header("Authorization","Bearer "+token)).andExpect(status().isUnauthorized());var next=auth.login(phone,REPLACEMENT);mvc.perform(get("/api/v1/admin/pick-tasks").header("Authorization","Bearer "+next.body().accessToken())).andExpect(status().isOk());
 }
}
