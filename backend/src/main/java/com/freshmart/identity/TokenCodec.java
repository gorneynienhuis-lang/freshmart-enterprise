package com.freshmart.identity;
import com.freshmart.common.ApiException;
import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import javax.crypto.Mac;import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;import java.security.MessageDigest;import java.security.SecureRandom;
import java.time.Clock;import java.time.Instant;import java.util.Base64;import java.util.HexFormat;import java.util.Map;
@Component
public class TokenCodec {
 private static final Base64.Encoder ENCODER=Base64.getUrlEncoder().withoutPadding();
 private final byte[] secret;private final ObjectMapper json;private final Clock clock;private final SecureRandom random=new SecureRandom();
 public TokenCodec(@Value("${app.token-secret}")String secret,ObjectMapper json,Clock clock){this.secret=secret.getBytes(StandardCharsets.UTF_8);if(this.secret.length<32)throw new IllegalStateException("APP_TOKEN_SECRET must contain at least 32 bytes; no default signing secret exists");this.json=json;this.clock=clock;}
 public String randomToken(){byte[]bytes=new byte[32];random.nextBytes(bytes);return ENCODER.encodeToString(bytes);}
 public static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 public String access(String userId,String sessionId,Instant expires){String h=encode(json.writeValueAsBytes(Map.of("alg","HS256","typ","JWT")));String p=encode(json.writeValueAsBytes(Map.of("iss","fresh-mall","sub",userId,"jti",sessionId,"iat",clock.instant().getEpochSecond(),"exp",expires.getEpochSecond())));String content=h+"."+p;return content+"."+encode(sign(content));}
 public Claims verify(String token){try{
  if(token==null||token.length()>8192)throw ApiException.unauthorized();String[] p=token.split("\\.",-1);if(p.length!=3)throw ApiException.unauthorized();
  if(!MessageDigest.isEqual(sign(p[0]+"."+p[1]),Base64.getUrlDecoder().decode(p[2])))throw ApiException.unauthorized();
  var header=json.readTree(Base64.getUrlDecoder().decode(p[0]));var body=json.readTree(Base64.getUrlDecoder().decode(p[1]));
  if(!"HS256".equals(header.path("alg").asString())||!"JWT".equals(header.path("typ").asString())||!"fresh-mall".equals(body.path("iss").asString())||!body.path("exp").isIntegralNumber()||!body.path("iat").isIntegralNumber())throw ApiException.unauthorized();
  Instant now=clock.instant();long exp=body.path("exp").asLong(),iat=body.path("iat").asLong();if(exp<=now.getEpochSecond()||iat>now.getEpochSecond()+30||exp-iat>900)throw ApiException.unauthorized();String user=body.path("sub").asString(),session=body.path("jti").asString();if(user==null||session==null||user.isBlank()||session.isBlank())throw ApiException.unauthorized();return new Claims(user,session);
 }catch(ApiException e){throw e;}catch(Exception e){throw ApiException.unauthorized();}}
 private byte[] sign(String content){try{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret,"HmacSHA256"));return mac.doFinal(content.getBytes(StandardCharsets.US_ASCII));}catch(Exception e){throw new IllegalStateException(e);}}
 private static String encode(byte[] bytes){return ENCODER.encodeToString(bytes);}
 public record Claims(String userId,String sessionId){}
}
