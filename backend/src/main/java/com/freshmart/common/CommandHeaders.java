package com.freshmart.common;
import jakarta.servlet.http.HttpServletRequest;import java.util.UUID;
public final class CommandHeaders {
 private CommandHeaders(){}
 public static String requireIdempotencyKey(HttpServletRequest request){String key=request.getHeader("Idempotency-Key");try{if(key==null||!UUID.fromString(key).toString().equalsIgnoreCase(key))throw new IllegalArgumentException();return key;}catch(IllegalArgumentException e){throw ApiException.invalid("Idempotency-Key必须为UUID");}}
}
