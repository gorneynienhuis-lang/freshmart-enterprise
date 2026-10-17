package com.freshmart.common;
import com.freshmart.identity.AuthenticationService;import com.freshmart.identity.CsrfService;
import jakarta.servlet.FilterChain;import jakarta.servlet.ServletException;import jakarta.servlet.http.HttpServletRequest;import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;import org.springframework.core.annotation.Order;import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;import org.slf4j.LoggerFactory;
import java.io.IOException;import java.util.UUID;import java.util.Set;
@Component @Order(Ordered.HIGHEST_PRECEDENCE+10)
public class SecurityFilter extends OncePerRequestFilter {
 private static final Logger log=LoggerFactory.getLogger(SecurityFilter.class);
 private final AuthenticationService auth;private final CsrfService csrf;private final ObjectMapper json;private final ApiAuthorizationRules authorization;
 private static final Set<String> COOKIE_AUTH=Set.of("/api/v1/auth/register","/api/v1/auth/login","/api/v1/auth/refresh","/api/v1/auth/logout");
 public SecurityFilter(AuthenticationService auth,CsrfService csrf,ObjectMapper json,ApiAuthorizationRules authorization){this.auth=auth;this.csrf=csrf;this.json=json;this.authorization=authorization;}
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  String trace=UUID.randomUUID().toString();TraceContext.set(trace);response.setHeader("X-Trace-Id",trace);if(request.getRequestURI().startsWith("/api/"))response.setHeader("Cache-Control","no-store");
  try{
   String origin=request.getHeader("Origin");if(origin!=null){if(!csrf.allowsOrigin(origin))throw ApiException.forbidden();response.setHeader("Access-Control-Allow-Origin",origin);response.setHeader("Vary","Origin");response.setHeader("Access-Control-Allow-Credentials","true");}
   if("OPTIONS".equals(request.getMethod())){if(origin==null)throw ApiException.forbidden();response.setHeader("Access-Control-Allow-Methods","GET,POST,PUT,PATCH,DELETE,OPTIONS");response.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type,Idempotency-Key,X-CSRF-Token");response.setHeader("Access-Control-Max-Age","600");response.setStatus(204);return;}
   String path=request.getRequestURI();boolean cookieAuth=COOKIE_AUTH.contains(path)&&"POST".equals(request.getMethod());boolean callback="/api/v1/payments/sandbox/callback".equals(path)&&"POST".equals(request.getMethod());
   if(!cookieAuth&&!callback){String header=request.getHeader("Authorization");if(header!=null){if(!header.startsWith("Bearer "))throw ApiException.unauthorized();RequestActor actor=auth.authenticate(header.substring(7));request.setAttribute(RequestActor.ATTRIBUTE,actor);if(auth.user(actor.userId()).mustChangePassword()&&!Set.of("/api/v1/auth/me","/api/v1/auth/password").contains(path))throw ApiException.forbidden();}else if(!isPublic(request))throw ApiException.unauthorized();}
   if(!cookieAuth&&!callback)authorization.authorize(request.getMethod(),path,(RequestActor)request.getAttribute(RequestActor.ATTRIBUTE));
   if(path.startsWith("/actuator/")&&!path.equals("/actuator/health"))RequestActor.current(request).requireRole("ADMIN");
   if(path.startsWith("/api/v1/auth")||request.getAttribute(RequestActor.ATTRIBUTE)!=null)response.setHeader("Cache-Control","no-store");
   chain.doFilter(request,response);
  }catch(ApiException e){response.setStatus(e.status());response.setContentType("application/json");response.setCharacterEncoding("UTF-8");if(e.status()==429)response.setHeader("Retry-After","900");json.writeValue(response.getOutputStream(),ApiEnvelope.error(e.code(),e.getMessage(),ApiError.of(e.errorKey())));
  }catch(RuntimeException e){if(response.isCommitted())throw e;log.error("Authentication boundary error traceId={} type={}",trace,e.getClass().getSimpleName());response.setStatus(500);response.setContentType("application/json");response.setCharacterEncoding("UTF-8");json.writeValue(response.getOutputStream(),ApiEnvelope.error(1050,"系统暂时不可用",new ApiError("INTERNAL_ERROR",true,java.util.List.of())));
  }finally{TraceContext.clear();}
 }
 private boolean isPublic(HttpServletRequest request){String p=request.getRequestURI();if(!"GET".equals(request.getMethod()))return false;return p.equals("/api/v1/auth/csrf")||p.equals("/api/v1/home")||p.equals("/api/v1/categories")||p.equals("/api/v1/products")||p.matches("^/api/v1/products/[A-Za-z0-9_-]+(?:/reviews)?$")||p.equals("/actuator/health")||p.startsWith("/static/products/")||p.startsWith("/static/categories/")||p.startsWith("/catalog/");}
}
