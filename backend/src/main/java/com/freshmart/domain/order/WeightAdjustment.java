package com.freshmart.domain.order;

import java.time.Instant;
import java.time.Duration;
import static com.freshmart.domain.DomainChecks.*;
import static com.freshmart.domain.DomainException.Reason.*;

/** Frozen net adjustment, separate from fulfillment and the underlying refund/payment ledger. */
public record WeightAdjustment(long deltaAmount, Status status, Instant expiresAt, String acceptedPaymentId) {
    public enum Status { NONE, REFUND_PENDING, REFUNDED, TOP_UP_PENDING, SETTLED, CANCELED }
    public WeightAdjustment {
        require(deltaAmount >= -MAX_EXACT_INTEGER && deltaAmount <= MAX_EXACT_INTEGER && status != null,
                VALIDATION_ERROR, "invalid adjustment amount/status");
        if (status == Status.NONE) require(deltaAmount == 0, VALIDATION_ERROR, "NONE must have zero delta");
        if (status == Status.REFUND_PENDING || status == Status.REFUNDED)
            require(deltaAmount < 0, VALIDATION_ERROR, "refund adjustment must be negative");
        if (status == Status.TOP_UP_PENDING || status == Status.SETTLED)
            require(deltaAmount > 0 && expiresAt != null, VALIDATION_ERROR, "top-up requires positive delta and deadline");
        require(deltaAmount > 0 || expiresAt == null, VALIDATION_ERROR, "non-top-up must not have a payment deadline");
        if (status == Status.SETTLED) id(acceptedPaymentId, "acceptedPaymentId");
        if (acceptedPaymentId != null) {
            id(acceptedPaymentId, "acceptedPaymentId");
            require(status == Status.SETTLED || status == Status.CANCELED, VALIDATION_ERROR,
                    "only settled/canceled adjustment may reference an accepted top-up");
        }
    }
    public static WeightAdjustment open(long deltaAmount, Instant now, Instant slotStartsAt) {
        require(now != null && slotStartsAt != null, VALIDATION_ERROR, "time context is required");
        if (deltaAmount == 0) return new WeightAdjustment(0, Status.NONE, null, null);
        if (deltaAmount < 0) return new WeightAdjustment(deltaAmount, Status.REFUND_PENDING, null, null);
        Instant tenMinutes = now.plus(Duration.ofMinutes(10));
        Instant deadline = tenMinutes.isBefore(slotStartsAt) ? tenMinutes : slotStartsAt;
        require(deadline.isAfter(now), TOP_UP_DEADLINE, "no remaining time to collect a top-up before delivery starts");
        return new WeightAdjustment(deltaAmount, Status.TOP_UP_PENDING, deadline, null);
    }
    public boolean allowsShipping() {
        return status == Status.NONE || status == Status.REFUNDED || status == Status.SETTLED;
    }
    /** Called only after all linked, verified refunds sum to the exact expected net refund. */
    public WeightAdjustment refunded(long aggregateSucceededAmount) {
        require(status == Status.REFUND_PENDING || status == Status.REFUNDED, INVALID_STATE, "adjustment is not refundable");
        require(aggregateSucceededAmount == -deltaAmount, PAYMENT_MISMATCH, "refund aggregate does not match adjustment");
        return status == Status.REFUNDED ? this : new WeightAdjustment(deltaAmount, Status.REFUNDED, null, null);
    }
    public WeightAdjustment settle(String paymentId, long amount, Instant now) {
        id(paymentId, "paymentId");
        require(status == Status.TOP_UP_PENDING, INVALID_STATE, "adjustment does not await a top-up");
        require(amount == deltaAmount, PAYMENT_MISMATCH, "top-up amount mismatch");
        require(now != null && now.isBefore(expiresAt), TOP_UP_DEADLINE, "top-up deadline reached");
        return new WeightAdjustment(deltaAmount, Status.SETTLED, expiresAt, paymentId);
    }
    public WeightAdjustment cancel() {
        return status == Status.CANCELED ? this : new WeightAdjustment(deltaAmount, Status.CANCELED, expiresAt, acceptedPaymentId);
    }
}
