package com.freshmart.support;

import java.time.Instant;

public final class CancellationSupportModels {
 private CancellationSupportModels() {}
 public record RequestRow(String requestId,String orderId,String activeOrderId,String memberId,String assigneeId,
                          String status,String reason,Instant requestedAt,Instant resolvedAt) {}
 public record CancellationSupport(String requestId,String orderId,String status,String reason,Instant requestedAt,Instant resolvedAt) {}
}
