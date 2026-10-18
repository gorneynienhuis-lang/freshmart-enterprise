package com.freshmart.commerce;

import com.freshmart.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.HexFormat;
import java.util.UUID;

/** Explicit course/demo sandbox only. Browser success redirects are never payment evidence. */
@Component
public class SandboxSignature {
    private final boolean enabled;
    private final byte[] secret;
    private final Clock clock;
    public SandboxSignature(@Value("${app.sandbox-enabled:false}")boolean enabled,@Value("${app.sandbox-secret:}")String secret,
                            Environment environment,Clock clock) {
        this.enabled=enabled&&environment.acceptsProfiles(Profiles.of("demo","dev","test","showcase"))&&!environment.acceptsProfiles(Profiles.of("prod","production"));
        this.secret=secret.getBytes(StandardCharsets.UTF_8);this.clock=clock;
        if(this.enabled&&this.secret.length<32)throw new IllegalStateException("Sandbox secret must contain at least 32 bytes");
    }
    public boolean enabled(){return enabled;}
    public void requireEnabled(){if(!enabled)throw ApiException.notFound();}
    public record Signed(String timestamp,String nonce,String signature) {}
    public Signed sign(String raw){requireEnabled();String timestamp=Long.toString(clock.instant().getEpochSecond()),nonce=UUID.randomUUID().toString();return new Signed(timestamp,nonce,hmac(timestamp+"\n"+nonce+"\n"+raw));}
    public void verify(String raw,String timestamp,String nonce,String signature) {
        requireEnabled();
        try {
            if(timestamp==null||!timestamp.matches("[0-9]{10,13}")||Math.abs(clock.instant().getEpochSecond()-Long.parseLong(timestamp))>300
                    ||nonce==null||!nonce.matches("[A-Za-z0-9_-]{1,64}")||signature==null||!signature.matches("[0-9a-f]{64}"))throw invalid();
            if(!MessageDigest.isEqual(HexFormat.of().parseHex(signature),HexFormat.of().parseHex(hmac(timestamp+"\n"+nonce+"\n"+raw))))throw invalid();
        } catch(NumberFormatException e){throw invalid();}
    }
    private String hmac(String value){try {Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret,"HmacSHA256"));return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));}catch(java.security.GeneralSecurityException e){throw new IllegalStateException(e);}}
    private static ApiException invalid(){return new ApiException(401,1301,"SIGNATURE_INVALID","沙箱签名无效或时间已过期");}
}
