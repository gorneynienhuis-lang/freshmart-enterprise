package com.freshmart.identity;
import java.time.Instant;
public record SessionRow(String sessionId,String familyId,String userId,String accessHash,String refreshHash,String status,Instant accessExpiresAt,Instant refreshExpiresAt,Instant createdAt,Instant rotatedAt){}
