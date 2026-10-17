package com.freshmart.identity;
import com.freshmart.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Service;
import java.security.MessageDigest;import java.nio.charset.StandardCharsets;import java.time.Clock;import java.time.Instant;import java.util.Arrays;import java.util.Set;import java.util.stream.Collectors;
@Service
public class CsrfService {
 private final IdentityMapper mapper;private final TokenCodec tokens;private final Clock clock;private final long ttl;private final Set<String> origins;
 public CsrfService(IdentityMapper mapper,TokenCodec tokens,Clock clock,@Value("${app.csrf-ttl-seconds:600}")long ttl,@Value("${app.allowed-origins}")String origins){this.mapper=mapper;this.tokens=tokens;this.clock=clock;this.ttl=ttl;this.origins=Arrays.stream(origins.split(",")).map(String::trim).collect(Collectors.toUnmodifiableSet());if(this.origins.contains("*"))throw new IllegalStateException("CORS must use exact allowed origins");}
 public Issued issue(){String cookie=tokens.randomToken(),token=tokens.randomToken();Instant now=clock.instant(),expires=now.plusSeconds(ttl);mapper.insertCsrf(new CsrfRow(TokenCodec.hash(cookie),TokenCodec.hash(token),expires,now));return new Issued(cookie,token,expires);}
 public void validate(HttpServletRequest request){String origin=request.getHeader("Origin"),token=request.getHeader("X-CSRF-Token"),cookie=Cookies.get(request,"csrf_context");if(origin==null||!origins.contains(origin)||token==null||token.length()>256||cookie==null)throw ApiException.forbidden();CsrfRow row=mapper.csrfByHash(TokenCodec.hash(cookie));if(row==null||!row.expiresAt().isAfter(clock.instant())||!MessageDigest.isEqual(row.tokenHash().getBytes(StandardCharsets.US_ASCII),TokenCodec.hash(token).getBytes(StandardCharsets.US_ASCII)))throw ApiException.forbidden();}
 public boolean allowsOrigin(String origin){return origins.contains(origin);}
 public record Issued(String cookie,String token,Instant expiresAt){}
}
