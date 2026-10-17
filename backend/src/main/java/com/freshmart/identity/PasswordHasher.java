package com.freshmart.identity;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKeyFactory;import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;import java.security.SecureRandom;import java.util.Base64;
@Component
public class PasswordHasher {
 private static final int ITERATIONS=600_000;private final SecureRandom random=new SecureRandom();
 public String encode(String password){byte[]salt=new byte[16];random.nextBytes(salt);return "pbkdf2-sha256$"+ITERATIONS+"$"+Base64.getEncoder().encodeToString(salt)+"$"+Base64.getEncoder().encodeToString(derive(password,salt,ITERATIONS));}
 public boolean matches(String password,String encoded){try{String[]p=encoded.split("\\$");if(p.length!=4||!p[0].equals("pbkdf2-sha256"))return false;int iterations=Integer.parseInt(p[1]);if(iterations<600_000||iterations>2_000_000)return false;return MessageDigest.isEqual(Base64.getDecoder().decode(p[3]),derive(password,Base64.getDecoder().decode(p[2]),iterations));}catch(Exception e){return false;}}
 private static byte[] derive(String password,byte[] salt,int iterations){PBEKeySpec spec=new PBEKeySpec(password.toCharArray(),salt,iterations,256);try{return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();}catch(Exception e){throw new IllegalStateException(e);}finally{spec.clearPassword();}}
}
