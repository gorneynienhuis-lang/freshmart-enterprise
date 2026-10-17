package com.freshmart.domain.order;

import com.freshmart.domain.pricing.PricingCalculator.RepricingResult;
import java.time.Instant;
import java.time.Duration;
import static com.freshmart.domain.DomainChecks.*;
import static com.freshmart.domain.DomainException.Reason.*;

/**
 * Immutable order decision model. Persist each returned value and its effects atomically using
 * this snapshot's version. Payment callbacks must already be authenticated and bound to this
 * order; persist verified channel SUCCESS even when the decision requires a refund.
 */
public record OrderLifecycle(OrderStatus status, long payableAmount, Instant paymentExpiresAt,
                             String acceptedPaymentId, WeightAdjustment adjustment, long version) {
    public enum InventoryAction { NONE, RELEASE_RESERVED, PICK_OUT, RETURN_REQUIRED }
    public enum PaymentDisposition { ACCEPTED, DUPLICATE_EVENT, REFUND_LATE_PAYMENT, REFUND_DUPLICATE_PAYMENT }
    public record PaymentDecision(OrderLifecycle order, PaymentDisposition disposition, InventoryAction inventoryAction,
                                  boolean refundExistingCapturedFunds) {
        public PaymentDecision(OrderLifecycle order, PaymentDisposition disposition, InventoryAction inventoryAction) {
            this(order, disposition, inventoryAction, false);
        }
    }
    public record CancellationDecision(OrderLifecycle order, InventoryAction inventoryAction, boolean refundCapturedFunds) {}
    public record PickingDecision(OrderLifecycle order, InventoryAction inventoryAction, boolean refundCapturedFunds) {}
    public record ExpiryDecision(OrderLifecycle order, InventoryAction inventoryAction, boolean changed,
                                 boolean refundCapturedFunds) {
        public ExpiryDecision(OrderLifecycle order, InventoryAction inventoryAction, boolean changed) {
            this(order, inventoryAction, changed, false);
        }
    }

    public OrderLifecycle {
        require(status != null && paymentExpiresAt != null, VALIDATION_ERROR, "order status and deadline required");
        nonnegative(payableAmount, "payableAmount"); nonnegative(version, "version");
        if (acceptedPaymentId != null) id(acceptedPaymentId, "acceptedPaymentId");
        if (status == OrderStatus.PENDING_PAY || status == OrderStatus.CLOSED)
            require(acceptedPaymentId == null && adjustment == null, VALIDATION_ERROR, "unpaid order cannot hold accepted money or a pick adjustment");
        if (status == OrderStatus.PAID || status == OrderStatus.PICKING || status == OrderStatus.READY_TO_SHIP
                || status == OrderStatus.DELIVERING || status == OrderStatus.FINISHED)
            require(payableAmount == 0 || acceptedPaymentId != null, VALIDATION_ERROR, "paid fulfillment needs accepted prepayment");
        if (status == OrderStatus.PAID || status == OrderStatus.PICKING)
            require(adjustment == null, VALIDATION_ERROR, "pre-pick order cannot hold a final adjustment");
        if (status == OrderStatus.READY_TO_SHIP || status == OrderStatus.DELIVERING || status == OrderStatus.FINISHED)
            require(adjustment != null, VALIDATION_ERROR, "picked order must have a frozen adjustment");
        if (status == OrderStatus.DELIVERING || status == OrderStatus.FINISHED)
            require(adjustment.allowsShipping(), VALIDATION_ERROR, "shipped order must be financially settled");
        if (status == OrderStatus.CANCELED && adjustment != null)
            require(adjustment.status() == WeightAdjustment.Status.CANCELED, VALIDATION_ERROR, "canceled order must terminate its adjustment");
    }
    public static OrderLifecycle pending(Instant createdAt, long payableAmount) {
        require(createdAt != null, VALIDATION_ERROR, "createdAt required");
        return new OrderLifecycle(OrderStatus.PENDING_PAY, payableAmount, createdAt.plus(Duration.ofMinutes(15)), null, null, 0);
    }
    public PaymentDecision onPrepaymentSuccess(String paymentId, long amount, Instant now) {
        id(paymentId, "paymentId"); require(now != null, VALIDATION_ERROR, "now required");
        require(payableAmount > 0 && amount == payableAmount, PAYMENT_MISMATCH, "prepayment amount mismatch or zero-charge order");
        if (paymentId.equals(acceptedPaymentId))
            return new PaymentDecision(this, PaymentDisposition.DUPLICATE_EVENT, InventoryAction.NONE);
        if (acceptedPaymentId != null)
            return new PaymentDecision(this, PaymentDisposition.REFUND_DUPLICATE_PAYMENT, InventoryAction.NONE);
        if (status == OrderStatus.PENDING_PAY && now.isBefore(paymentExpiresAt)) {
            return new PaymentDecision(changed(OrderStatus.PAID, paymentId, null), PaymentDisposition.ACCEPTED, InventoryAction.NONE);
        }
        if (status == OrderStatus.PENDING_PAY) {
            return new PaymentDecision(changed(OrderStatus.CLOSED, null, null), PaymentDisposition.REFUND_LATE_PAYMENT,
                    InventoryAction.RELEASE_RESERVED);
        }
        return new PaymentDecision(this, PaymentDisposition.REFUND_LATE_PAYMENT, InventoryAction.NONE);
    }
    public OrderLifecycle settleZeroAmount(Instant now) {
        require(status == OrderStatus.PENDING_PAY && payableAmount == 0, INVALID_STATE, "only zero pending order can be settled internally");
        require(now != null && now.isBefore(paymentExpiresAt), INVALID_STATE, "zero-charge order expired");
        return changed(OrderStatus.PAID, null, null);
    }
    public OrderLifecycle claimPicking() {
        require(status == OrderStatus.PAID, INVALID_STATE, "only paid order can be claimed");
        return changed(OrderStatus.PICKING, acceptedPaymentId, null);
    }
    public PickingDecision confirmPicking(RepricingResult repricing, Instant now, Instant slotStartsAt) {
        require(status == OrderStatus.PICKING, INVALID_STATE, "only picking order can confirm actual quantities");
        require(repricing != null && repricing.originalPayableAmount() == payableAmount,
                VALIDATION_ERROR, "repricing does not match original order charge");
        if (repricing.cancelOrder()) {
            CancellationDecision canceled = cancel();
            return new PickingDecision(canceled.order(), canceled.inventoryAction(), canceled.refundCapturedFunds());
        }
        WeightAdjustment result = WeightAdjustment.open(repricing.deltaAmount(), now, slotStartsAt);
        return new PickingDecision(changed(OrderStatus.READY_TO_SHIP, acceptedPaymentId, result), InventoryAction.PICK_OUT, false);
    }
    /** Authorization/ownership and SERVICE scope are checked by the application before invoking. */
    public CancellationDecision cancel() {
        if (status == OrderStatus.CANCELED)
            return new CancellationDecision(this, InventoryAction.NONE, false);
        require(status == OrderStatus.PENDING_PAY || status == OrderStatus.PAID || status == OrderStatus.PICKING
                || status == OrderStatus.READY_TO_SHIP, INVALID_STATE, "ordinary cancellation is forbidden after dispatch or closure");
        InventoryAction action = status == OrderStatus.READY_TO_SHIP ? InventoryAction.RETURN_REQUIRED : InventoryAction.RELEASE_RESERVED;
        WeightAdjustment canceled = adjustment == null ? null : adjustment.cancel();
        boolean captured = acceptedPaymentId != null || (adjustment != null && adjustment.acceptedPaymentId() != null);
        return new CancellationDecision(changed(OrderStatus.CANCELED, acceptedPaymentId, canceled), action, captured);
    }
    /** Safe for stale timeout tasks: a paid/canceled order is a no-op, never closed by the timer. */
    public ExpiryDecision expireUnpaid(Instant now) {
        require(now != null, VALIDATION_ERROR, "now required");
        if (status != OrderStatus.PENDING_PAY || now.isBefore(paymentExpiresAt))
            return new ExpiryDecision(this, InventoryAction.NONE, false);
        return new ExpiryDecision(changed(OrderStatus.CLOSED, null, null), InventoryAction.RELEASE_RESERVED, true);
    }
    public OrderLifecycle confirmWeightRefund(long aggregateSucceededAmount) {
        require(status == OrderStatus.READY_TO_SHIP && adjustment != null, INVALID_STATE, "order does not await pre-dispatch refund completion");
        WeightAdjustment result = adjustment.refunded(aggregateSucceededAmount);
        return result == adjustment ? this : changed(status, acceptedPaymentId, result);
    }
    public PaymentDecision onTopUpSuccess(String paymentId, long amount, Instant now) {
        id(paymentId, "paymentId"); require(now != null, VALIDATION_ERROR, "now required");
        require(adjustment != null && adjustment.deltaAmount() > 0 && amount == adjustment.deltaAmount(),
                PAYMENT_MISMATCH, "top-up does not match a positive adjustment");
        if (paymentId.equals(adjustment.acceptedPaymentId()))
            return new PaymentDecision(this, PaymentDisposition.DUPLICATE_EVENT, InventoryAction.NONE);
        if (adjustment.acceptedPaymentId() != null)
            return new PaymentDecision(this, PaymentDisposition.REFUND_DUPLICATE_PAYMENT, InventoryAction.NONE);
        if (status == OrderStatus.READY_TO_SHIP && adjustment.status() == WeightAdjustment.Status.TOP_UP_PENDING) {
            if (now.isBefore(adjustment.expiresAt()))
                return new PaymentDecision(changed(status, acceptedPaymentId, adjustment.settle(paymentId, amount, now)),
                        PaymentDisposition.ACCEPTED, InventoryAction.NONE);
            CancellationDecision canceled = cancel();
            return new PaymentDecision(canceled.order(), PaymentDisposition.REFUND_LATE_PAYMENT,
                    canceled.inventoryAction(), canceled.refundCapturedFunds());
        }
        return new PaymentDecision(this, PaymentDisposition.REFUND_LATE_PAYMENT, InventoryAction.NONE);
    }
    public ExpiryDecision expireTopUp(Instant now) {
        require(now != null, VALIDATION_ERROR, "now required");
        if (status != OrderStatus.READY_TO_SHIP || adjustment.status() != WeightAdjustment.Status.TOP_UP_PENDING
                || now.isBefore(adjustment.expiresAt())) return new ExpiryDecision(this, InventoryAction.NONE, false);
        CancellationDecision canceled = cancel();
        return new ExpiryDecision(canceled.order(), canceled.inventoryAction(), true, canceled.refundCapturedFunds());
    }
    public OrderLifecycle ship(boolean handoverRecorded, boolean hasUnresolvedException) {
        require(status == OrderStatus.READY_TO_SHIP, INVALID_STATE, "only ready order can ship");
        require(adjustment.allowsShipping(), UNSETTLED_ADJUSTMENT, "top-up or refund remains unsettled");
        require(handoverRecorded && !hasUnresolvedException, INVALID_STATE, "verified handover and resolved fulfillment are required");
        return changed(OrderStatus.DELIVERING, acceptedPaymentId, adjustment);
    }
    /** The application loads the assigned task in the same transaction and supplies its exception state. */
    public OrderLifecycle completeDelivery(boolean proofVerified, boolean hasUnresolvedException) {
        require(status == OrderStatus.DELIVERING && proofVerified && !hasUnresolvedException,
                INVALID_STATE, "delivery completion requires verified proof, dispatched state, and no unresolved exception");
        return changed(OrderStatus.FINISHED, acceptedPaymentId, adjustment);
    }
    private OrderLifecycle changed(OrderStatus target, String paymentId, WeightAdjustment nextAdjustment) {
        return new OrderLifecycle(target, payableAmount, paymentExpiresAt, paymentId, nextAdjustment, add(version, 1));
    }
}
