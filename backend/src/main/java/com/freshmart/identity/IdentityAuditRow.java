package com.freshmart.identity;
import java.time.Instant;
/** Whitelisted identity audit: no password, token, cookie, hash or phone fields. */
public record IdentityAuditRow(String eventId,String actorId,String operation,String resourceId,String reason,String traceId,Instant createdAt){}
