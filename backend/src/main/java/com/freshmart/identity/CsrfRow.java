package com.freshmart.identity;
import java.time.Instant;
public record CsrfRow(String contextHash,String tokenHash,Instant expiresAt,Instant createdAt){}
