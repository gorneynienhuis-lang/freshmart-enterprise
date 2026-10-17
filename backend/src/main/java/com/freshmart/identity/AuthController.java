package com.freshmart.identity;
import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;import jakarta.servlet.http.HttpServletResponse;import jakarta.validation.Valid;import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;import org.springframework.http.HttpHeaders;import org.springframework.http.HttpStatus;import org.springframework.http.ResponseCookie;import org.springframework.web.bind.annotation.*;
import java.time.Duration;
@RestController @RequestMapping("/api/v1/auth")
public class AuthController {
 private final AuthenticationService auth;private final CsrfService csrf;private final IdempotencyService idempotency;private final boolean secure;private final long refreshTtl,csrfTtl;
 public AuthController(AuthenticationService auth,CsrfService csrf,IdempotencyService idempotency,@Value("${app.secure-cookies:true}")boolean secure,@Value("${app.refresh-ttl-seconds:604800}")long refreshTtl,@Value("${app.csrf-ttl-seconds:600}")long csrfTtl){this.auth=auth;this.csrf=csrf;this.idempotency=idempotency;this.secure=secure;this.refreshTtl=refreshTtl;this.csrfTtl=csrfTtl;}
 @GetMapping("/csrf") public ApiEnvelope<CsrfResponse> csrf(HttpServletResponse response){var c=csrf.issue();cookie(response,"csrf_context",c.cookie(),csrfTtl);return ApiEnvelope.ok(new CsrfResponse(c.token(),c.expiresAt().toString()));}
 @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<AuthenticationService.AuthSession> register(@Valid @RequestBody RegisterRequest body,HttpServletRequest request,HttpServletResponse response){csrf.validate(request);return issue(auth.register(body.phone(),body.password(),body.displayName().trim()),response);}
 @PostMapping("/login") public ApiEnvelope<AuthenticationService.AuthSession> login(@Valid @RequestBody LoginRequest body,HttpServletRequest request,HttpServletResponse response){csrf.validate(request);return issue(auth.login(body.phone(),body.password()),response);}
 @PostMapping("/refresh") public ApiEnvelope<AuthenticationService.AuthSession> refresh(HttpServletRequest request,HttpServletResponse response){csrf.validate(request);return issue(auth.refresh(Cookies.get(request,"refresh_token")),response);}
 @PostMapping("/logout") public ApiEnvelope<AuthenticationService.CommandResult> logout(HttpServletRequest request,HttpServletResponse response){csrf.validate(request);var result=auth.logout(Cookies.get(request,"refresh_token"));cookie(response,"refresh_token","",0);cookie(response,"csrf_context","",0);return ApiEnvelope.ok(result);}
 @GetMapping("/me") public ApiEnvelope<AuthenticationService.UserView> me(HttpServletRequest request){return ApiEnvelope.ok(auth.user(RequestActor.current(request).userId()));}
 @PostMapping("/password") public ApiEnvelope<AuthenticationService.CommandResult> password(@Valid @RequestBody PasswordRequest body,HttpServletRequest request){RequestActor actor=RequestActor.current(request);String key=CommandHeaders.requireIdempotencyKey(request);String canonical=TokenCodec.hash(body.currentPassword())+":"+TokenCodec.hash(body.newPassword());return ApiEnvelope.ok(idempotency.execute(actor.userId(),"POST /api/v1/auth/password",key,canonical,AuthenticationService.CommandResult.class,()->auth.changePassword(actor,body.currentPassword(),body.newPassword())));}
 private ApiEnvelope<AuthenticationService.AuthSession> issue(AuthenticationService.Issued issued,HttpServletResponse response){cookie(response,"refresh_token",issued.refresh(),issued.refreshMaxAgeSeconds());cookie(response,"csrf_context",issued.csrfCookie(),csrfTtl);return ApiEnvelope.ok(issued.body());}
 private void cookie(HttpServletResponse response,String name,String value,long seconds){response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from(name,value).httpOnly(true).secure(secure).sameSite("Lax").path("/api/v1/auth").maxAge(Duration.ofSeconds(seconds)).build().toString());response.setHeader("Cache-Control","no-store");}
 public record CsrfResponse(String csrfToken,String expiresAt){}
 public record RegisterRequest(@NotBlank @Pattern(regexp="^1[3-9][0-9]{9}$")String phone,@NotBlank @Size(min=12,max=128)String password,@NotBlank @Size(max=60)String displayName){}
 public record LoginRequest(@NotBlank @Pattern(regexp="^1[3-9][0-9]{9}$")String phone,@NotBlank @Size(min=12,max=128)String password){}
 public record PasswordRequest(@NotBlank @Size(min=12,max=128)String currentPassword,@NotBlank @Size(min=12,max=128)String newPassword){}
}
