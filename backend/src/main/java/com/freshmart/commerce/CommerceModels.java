package com.freshmart.commerce;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

/** Persistence rows are internal; public views are explicitly assembled to avoid leaking contact/proof data. */
public final class CommerceModels {
    private CommerceModels() {}
    public static class OrderRow {
        public String orderId, orderNo, userId, quoteId, slotId, couponId, status, snapshotJson;
        public long payableAmount, paidAmount, refundedAmount, adjustmentDelta, version;
        public String acceptedPaymentId, adjustmentId, adjustmentStatus, topupPaymentId, adjustmentJson;
        public String pickTaskId, pickerId, pickStatus, deliveryTaskId, courierId, deliveryStatus, receiptCode;
        public boolean slotHeld;
        public Instant createdAt, updatedAt, paymentExpiresAt, paidAt, dispatchedAt, finishedAt, adjustmentExpiresAt;
    }
    public static class AllocationRow {
        public String allocationId, orderId, orderItemId, skuId, batchId, batchNo, baseUnit;
        public long reservedQuantity, pickedQuantity, returnedQuantity, version;
    }
    public static class PaymentRow {
        public String paymentId, orderId, userId, adjustmentId, purpose, status, channelTradeNo;
        public long amount, refundedAmount, refundReserved, version;
        public boolean accepted;
        public Instant expiresAt, createdAt, paidAt;
    }
    public static class RefundRow {
        public String refundId, orderId, paymentId, businessKey, aftersaleId, adjustmentId, type, status, reason;
        public String reviewerId, executorId, lastError;
        public long amount, version;
        public Instant createdAt, completedAt;
    }
    public record BatchRow(String batchId,String skuId,String batchNo,String lifecycleStatus,
                           long onHand,long reserved,long quarantined,Instant receivedAt,Instant expiresAt,long version) {}
    public record EventRow(String eventId,String paymentId,String nonce,String requestHash,boolean accepted,Instant createdAt) {}
    public record CreateOrder(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String quoteId,
                              @NotBlank @Size(min=16,max=2048) String quoteToken,@Size(min=1,max=300) String buyerNote) {}
    public record Version(@NotNull @Min(0) Long version) {}
    public record ReasonVersion(@NotBlank @Size(max=500) String reason,@NotNull @Min(0) Long version) {}
    public record Prepay(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String orderId,
                        @NotBlank @Pattern(regexp="ORDER|TOP_UP") String purpose,
                        @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String adjustmentId) {}
    public record Simulate(@NotBlank @Pattern(regexp="SUCCESS|FAILED") String outcome,@NotNull @Min(0) Long version) {}
    public record Callback(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String eventId,
                           @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String paymentId,
                           @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String channelTradeNo,
                           @NotBlank @Pattern(regexp="SUCCESS|FAILED") String status,
                           @NotNull @Min(0) @Max(9007199254740991L) Long amount,
                           @NotBlank @Pattern(regexp="CNY") String currency,@NotNull Instant occurredAt) {}
    public record PickLine(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String allocationId,
                           @NotNull @Min(0) @Max(9007199254740991L) Long actualQuantity,
                           @NotBlank @Pattern(regexp="NORMAL|SHORTAGE|WEIGHT_VARIANCE") String reasonCode,
                           @NotBlank @Size(max=500) String reason) {}
    public record PickConfirm(@NotEmpty @Size(max=200) List<@Valid PickLine> allocations,@NotNull @Min(0) Long version) {}
    public record Dispatch(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String courierId,@NotNull @Min(0) Long version) {}
    public record Complete(@NotBlank @Pattern(regexp="[0-9]{6}") String proofCode,
                           @Size(min=1,max=300) String note,@NotNull @Min(0) Long version) {}
    public record ReturnLine(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String allocationId,
                             @NotNull @Min(0) @Max(9007199254740991L) Long passedQuantity,
                             @NotNull @Min(0) @Max(9007199254740991L) Long quarantinedQuantity) {}
    public record ReturnReceive(@NotEmpty @Size(max=200) List<@Valid ReturnLine> allocations,
                                @NotBlank @Size(max=500) String inspectionNote,@NotNull @Min(0) Long version) {}
}
