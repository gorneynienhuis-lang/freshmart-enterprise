package com.freshmart.domain;

/** Stable business failure, independent of HTTP, persistence, and framework exceptions. */
public final class DomainException extends RuntimeException {
    public enum Reason {
        VALIDATION_ERROR, AMOUNT_OVERFLOW, WEIGHT_LIMIT, INSUFFICIENT_STOCK,
        INVENTORY_INVARIANT, INVALID_STATE, PAYMENT_MISMATCH,
        TOP_UP_DEADLINE, UNSETTLED_ADJUSTMENT
    }

    private final Reason reason;

    public DomainException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason reason() { return reason; }
}
