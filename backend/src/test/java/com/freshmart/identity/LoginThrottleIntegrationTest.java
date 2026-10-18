package com.freshmart.identity;

import com.freshmart.common.ApiException;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:login-policy;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "spring.datasource.username=sa","spring.datasource.password=","app.token-secret=login-policy-test-secret-never-used-in-runtime-2026",
    "app.secure-cookies=false","app.commerce-jobs-enabled=false","app.login-account-max-failures=2",
    "app.login-account-window-seconds=60","app.login-account-block-seconds=120",
    "app.login-ip-max-failures=3","app.login-ip-window-seconds=60","app.login-ip-block-seconds=60"})
@AutoConfigureMockMvc @Import(LoginThrottleIntegrationTest.Config.class)
class LoginThrottleIntegrationTest {
    static final String PASSWORD="Login-policy-test-password-2026!";
    static final AtomicLong PHONES=new AtomicLong(13380000000L),PEERS=new AtomicLong();
    @Autowired AuthenticationService auth; @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc; @Autowired MutableClock clock;
    @BeforeEach void time(){clock.reset();}
    String phone(){return Long.toString(PHONES.incrementAndGet());}
    String peer(){return "192.0.2."+PEERS.incrementAndGet();}
    ApiException bad(String phone,String peer){return assertThrows(ApiException.class,()->auth.login(phone,PASSWORD,peer));}
    String member(){String phone=phone();auth.register(phone,PASSWORD,"限流合成会员");return phone;}

    @Test void accountLimitPersistsAcrossDifferentPeersAndBlockOutlastsWindow(){
        String unknown=phone();assertEquals(401,bad(unknown,peer()).status());assertEquals(401,bad(unknown,peer()).status());
        ApiException limited=bad(unknown,peer());assertEquals(429,limited.status());assertEquals(120,limited.retryAfterSeconds());
        clock.advance(61);limited=bad(unknown,peer());assertEquals(429,limited.status());assertEquals(59,limited.retryAfterSeconds());
        clock.advance(60);assertEquals(401,bad(unknown,peer()).status());
        assertEquals(1,jdbc.queryForObject("SELECT failed_count FROM fm_login_throttle WHERE subject_hash=?",Integer.class,TokenCodec.hash("login:"+unknown)));
    }
    @Test void peerLimitCountsDifferentAccountsAndValidLoginCannotResetIt(){
        String peer=peer(),valid=member();assertEquals(401,bad(phone(),peer).status());assertEquals(401,bad(phone(),peer).status());
        assertNotNull(auth.login(valid,PASSWORD,peer));assertEquals(401,bad(phone(),peer).status());
        assertEquals(429,bad(valid,peer).status());clock.advance(61);assertNotNull(auth.login(valid,PASSWORD,peer));
    }
    @Test void successfulLoginResetsOnlyItsOwnAccountFailureCounter(){
        String valid=member();assertEquals(401,assertThrows(ApiException.class,()->auth.login(valid,"Wrong-test-password-2026!",peer())).status());
        assertNotNull(auth.login(valid,PASSWORD,peer()));
        for(int i=0;i<2;i++)assertEquals(401,assertThrows(ApiException.class,()->auth.login(valid,"Wrong-test-password-2026!",peer())).status());
        assertEquals(429,bad(valid,peer()).status());
    }
    @Test void unknownAndDisabledAccountsReturnSameGenericFailure(){
        String disabled=member();jdbc.update("UPDATE fm_user SET status='DISABLED' WHERE phone=?",disabled);
        ApiException unknown=bad(phone(),peer()),inactive=bad(disabled,peer());
        assertEquals(401,unknown.status());assertEquals(unknown.status(),inactive.status());assertEquals(unknown.code(),inactive.code());assertEquals(unknown.getMessage(),inactive.getMessage());
        String hashes=String.join("|",jdbc.queryForList("SELECT subject_hash FROM fm_login_throttle",String.class));
        assertFalse(hashes.contains(disabled));assertTrue(hashes.matches("[a-f0-9|]+"));
    }
    @Test void httpPeerLimitIgnoresSpoofedForwardedHeadersAndReturnsRemainingRetrySeconds()throws Exception{
        String peer=peer();for(int i=0;i<3;i++)httpLogin(phone(),peer,"198.51.100."+(i+1),401);
        httpLogin(phone(),peer,"203.0.113.99",429).andExpect(header().string("Retry-After","60"));
        clock.advance(7);httpLogin(phone(),peer,"203.0.113.100",429).andExpect(header().string("Retry-After","53"));
    }
    @Test void concurrentPeerFailuresCannotLoseIncrements()throws Exception{
        String peer=peer();var pool=Executors.newFixedThreadPool(3);var start=new CountDownLatch(1);var futures=new ArrayList<Future<Integer>>();
        try{
            for(int i=0;i<3;i++){String unknown=phone();futures.add(pool.submit(()->{start.await();return bad(unknown,peer).status();}));}
            start.countDown();for(var result:futures)assertEquals(401,result.get(15,TimeUnit.SECONDS));
            assertEquals(3,jdbc.queryForObject("SELECT failed_count FROM fm_login_throttle WHERE subject_hash=?",Integer.class,TokenCodec.hash("login-peer:"+peer)));
            assertEquals(429,bad(phone(),peer).status());
        }finally{pool.shutdownNow();}
    }
    @Test void invalidThrottlePoliciesFailClosedAtStartup(){
        assertThrows(IllegalStateException.class,()->new LoginThrottlePolicy.Rule(0,60,60));
        assertThrows(IllegalStateException.class,()->new LoginThrottlePolicy.Rule(5,0,60));
        assertThrows(IllegalStateException.class,()->new LoginThrottlePolicy.Rule(5,60,86401));
    }
    ResultActions httpLogin(String phone,String peer,String forwarded,int expected)throws Exception{
        var csrf=mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse();
        String token=json.readTree(csrf.getContentAsString()).path("data").path("csrfToken").asString();
        String cookie=csrf.getHeaders("Set-Cookie").stream().filter(value->value.startsWith("csrf_context=")).findFirst().orElseThrow();
        String context=cookie.substring("csrf_context=".length(),cookie.indexOf(';'));
        return mvc.perform(post("/api/v1/auth/login").with(request->{request.setRemoteAddr(peer);return request;})
            .header("Origin","http://localhost:5173").header("X-CSRF-Token",token).header("X-Forwarded-For",forwarded)
            .header("Forwarded","for="+forwarded).cookie(new Cookie("csrf_context",context)).contentType("application/json")
            .content(json.writeValueAsString(Map.of("phone",phone,"password",PASSWORD)))).andExpect(status().is(expected));
    }
    @TestConfiguration static class Config {@Bean @Primary MutableClock loginTestClock(){return new MutableClock();}}
    static final class MutableClock extends Clock {
        private final AtomicReference<Instant> now=new AtomicReference<>(Instant.parse("2026-10-18T06:00:00Z"));
        void reset(){now.set(Instant.parse("2026-10-18T06:00:00Z"));}void advance(long seconds){now.updateAndGet(value->value.plusSeconds(seconds));}
        @Override public Instant instant(){return now.get();}@Override public ZoneId getZone(){return ZoneOffset.UTC;}@Override public Clock withZone(ZoneId zone){return this;}
    }
}
