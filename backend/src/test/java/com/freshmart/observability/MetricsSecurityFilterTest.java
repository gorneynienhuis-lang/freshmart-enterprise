package com.freshmart.observability;

import com.freshmart.audit.AuditRecorder;
import com.freshmart.common.*;
import com.freshmart.identity.*;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.*;
import tools.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MetricsSecurityFilterTest {
    @TempDir Path temp;
    static final String TOKEN="synthetic_MetricsCredential_2026_never_runtime_0123456789";
    AuthenticationService authentication;CsrfService csrf;ApiAuthorizationRules rules;AuditRecorder audit;SecurityFilter filter;
    @BeforeEach void setUp()throws Exception {
        Path file=temp.toRealPath().resolve("credential");Files.writeString(file,TOKEN);Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));
        authentication=mock(AuthenticationService.class);csrf=mock(CsrfService.class);rules=mock(ApiAuthorizationRules.class);audit=mock(AuditRecorder.class);
        filter=new SecurityFilter(authentication,csrf,new ObjectMapper(),rules,audit,new MetricsScrapeAuth(true,file.toString()));
    }
    @Test void scrapeCredentialDoesNotCreateAdminActorOrAccessTheSessionDatabase()throws Exception {
        var request=request("GET","/actuator/prometheus",TOKEN);var response=new MockHttpServletResponse();FilterChain chain=mock(FilterChain.class);
        filter.doFilter(request,response,chain);verify(chain).doFilter(request,response);verifyNoInteractions(authentication,audit,rules,csrf);
        assertNull(request.getAttribute(RequestActor.ATTRIBUTE));assertEquals("no-store",response.getHeader("Cache-Control"));assertNotNull(response.getHeader("X-Trace-Id"));assertNotEquals(response.getHeader("X-Trace-Id"),TraceContext.id());
    }
    @Test void sameCredentialCannotBypassOtherRoutesOrMethods()throws Exception {
        when(authentication.authenticate(TOKEN)).thenThrow(ApiException.unauthorized());
        for(String path:new String[]{"/api/v1/auth/me","/api/v1/admin/employees","/actuator/info"}){
            var response=new MockHttpServletResponse();FilterChain chain=mock(FilterChain.class);filter.doFilter(request("GET",path,TOKEN),response,chain);assertEquals(401,response.getStatus());verifyNoInteractions(chain);
        }
        var response=new MockHttpServletResponse();FilterChain chain=mock(FilterChain.class);filter.doFilter(request("POST","/actuator/prometheus",TOKEN),response,chain);assertEquals(401,response.getStatus());verifyNoInteractions(chain);
    }
    @Test void normalAdminAuthenticationAndCurrentRoleChecksRemainEffective()throws Exception {
        var admin=new RequestActor("synthetic-admin",Set.of("ADMIN"),Set.of(),"synthetic-session");
        when(authentication.authenticate("normal-session")).thenReturn(admin);when(authentication.user(admin.userId())).thenReturn(user(admin));
        var response=new MockHttpServletResponse();FilterChain chain=mock(FilterChain.class);filter.doFilter(request("GET","/actuator/prometheus","normal-session"),response,chain);verify(chain).doFilter(any(),any());assertEquals(200,response.getStatus());
        var member=new RequestActor("synthetic-member",Set.of("MEMBER"),Set.of(),"synthetic-session");when(authentication.authenticate("member-session")).thenReturn(member);when(authentication.user(member.userId())).thenReturn(user(member));
        response=new MockHttpServletResponse();chain=mock(FilterChain.class);filter.doFilter(request("GET","/actuator/prometheus","member-session"),response,chain);assertEquals(403,response.getStatus());verifyNoInteractions(chain);
    }
    @Test void dynamicRetryAfterComesFromTheActualThrottleException()throws Exception {
        when(authentication.authenticate("throttled")).thenThrow(new ApiException(429,1029,"RATE_LIMITED","Too many attempts"){@Override public long retryAfterSeconds(){return 53;}});
        var response=new MockHttpServletResponse();filter.doFilter(request("GET","/api/v1/auth/me","throttled"),response,mock(FilterChain.class));assertEquals(429,response.getStatus());assertEquals("53",response.getHeader("Retry-After"));
    }
    AuthenticationService.UserView user(RequestActor actor){return new AuthenticationService.UserView(actor.userId(),"Synthetic","***",new ArrayList<>(actor.roles()),"ACTIVE",1,List.of(),false);}
    MockHttpServletRequest request(String method,String path,String token){var value=new MockHttpServletRequest(method,path);value.addHeader("Authorization","Bearer "+token);return value;}
}
