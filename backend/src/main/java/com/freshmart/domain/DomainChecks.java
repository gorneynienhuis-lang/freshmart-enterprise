package com.freshmart.domain;

import java.math.BigInteger;
import static com.freshmart.domain.DomainException.Reason.*;

/** Domain quantities remain exactly representable in the public JSON contract. */
public final class DomainChecks {
    public static final long MAX_EXACT_INTEGER = 9_007_199_254_740_991L;
    private DomainChecks() {}

    public static void require(boolean condition, DomainException.Reason reason, String message) {
        if (!condition) throw new DomainException(reason, message);
    }
    public static String id(String value, String field) {
        require(value != null && !value.isBlank(), VALIDATION_ERROR, field + " is required");
        return value;
    }
    public static long nonnegative(long value, String field) {
        require(value >= 0 && value <= MAX_EXACT_INTEGER, VALIDATION_ERROR, field + " is out of range");
        return value;
    }
    public static long positive(long value, String field) {
        nonnegative(value, field);
        require(value > 0, VALIDATION_ERROR, field + " must be positive");
        return value;
    }
    public static long bounded(BigInteger value) {
        require(value.signum() >= 0 && value.compareTo(BigInteger.valueOf(MAX_EXACT_INTEGER)) <= 0,
                AMOUNT_OVERFLOW, "computed amount or quantity exceeds the exact integer range");
        return value.longValueExact();
    }
    public static long add(long left, long right) {
        return bounded(BigInteger.valueOf(left).add(BigInteger.valueOf(right)));
    }
    public static long multiply(long left, long right) {
        return bounded(BigInteger.valueOf(left).multiply(BigInteger.valueOf(right)));
    }
}
