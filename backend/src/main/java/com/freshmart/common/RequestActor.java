package com.freshmart.common;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.util.Set;
public record RequestActor(String userId,Set<String> roles,Set<String> permissions,String sessionId){
  public static final String ATTRIBUTE=RequestActor.class.getName();
  public RequestActor { roles=Set.copyOf(roles);permissions=Set.copyOf(permissions); }
  public static RequestActor current(HttpServletRequest request){Object v=request.getAttribute(ATTRIBUTE);if(v instanceof RequestActor a)return a;throw ApiException.unauthorized();}
  public static RequestActor current(){if(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes a)return current(a.getRequest());throw ApiException.unauthorized();}
  public void requireRole(String role){if(!roles.contains(role))throw ApiException.forbidden();}
  public void requireAnyRole(String... allowed){for(String role:allowed)if(roles.contains(role))return;throw ApiException.forbidden();}
  public void requireOwner(String ownerId){if(!userId.equals(ownerId))throw ApiException.notFound();}
  public void requirePermission(String permission){if(!permissions.contains(permission))throw ApiException.forbidden();}
}
