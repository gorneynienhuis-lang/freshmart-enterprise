package com.freshmart.identity;
import java.time.Instant;
public record ThrottleRow(String subjectHash,int failedCount,Instant windowStartedAt,Instant blockedUntil){}
