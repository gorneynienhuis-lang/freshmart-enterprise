package com.freshmart.commerce;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.Duration;

@Component
public record RefundRecoveryPolicy(int maxAttempts,long retryBaseSeconds,long retryMaxSeconds,long leaseSeconds) {
 public RefundRecoveryPolicy(@Value("${app.refund-max-attempts:5}")int maxAttempts,
                             @Value("${app.refund-retry-base-seconds:10}")long retryBaseSeconds,
                             @Value("${app.refund-retry-max-seconds:300}")long retryMaxSeconds,
                             @Value("${app.refund-lease-seconds:30}")long leaseSeconds){
  if(maxAttempts<1||maxAttempts>20||retryBaseSeconds<1||retryBaseSeconds>300||retryMaxSeconds<retryBaseSeconds||retryMaxSeconds>3600||leaseSeconds<1||leaseSeconds>300)throw new IllegalStateException("Invalid bounded refund recovery policy");
  this.maxAttempts=maxAttempts;this.retryBaseSeconds=retryBaseSeconds;this.retryMaxSeconds=retryMaxSeconds;this.leaseSeconds=leaseSeconds;
 }
 public Duration backoff(int attempt){if(attempt<1||attempt>maxAttempts)throw new IllegalArgumentException("Invalid refund attempt");return Duration.ofSeconds(Math.min(retryMaxSeconds,retryBaseSeconds*(1L<<(attempt-1))));}
}
