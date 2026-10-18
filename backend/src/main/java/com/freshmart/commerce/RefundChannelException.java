package com.freshmart.commerce;

/** Safe fixed error codes; never retain a provider response, request, password or PII. */
public class RefundChannelException extends RuntimeException {
 private final String code;private final boolean permanent;
 public RefundChannelException(String code,boolean permanent){super(code);this.code=code;this.permanent=permanent;}
 public String code(){return code;}public boolean permanent(){return permanent;}
}
