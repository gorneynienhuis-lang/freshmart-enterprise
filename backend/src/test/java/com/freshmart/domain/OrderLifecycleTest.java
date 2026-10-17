package com.freshmart.domain;

import com.freshmart.domain.order.*;
import com.freshmart.domain.order.OrderLifecycle.*;
import com.freshmart.domain.pricing.PriceMode;
import com.freshmart.domain.pricing.PricingCalculator;
import com.freshmart.domain.pricing.PricingCalculator.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.freshmart.domain.DomainException.Reason.*;

class OrderLifecycleTest {
    private static final Instant NOW = Instant.parse("2026-10-18T05:00:00Z");
    private final PricingCalculator pricing = new PricingCalculator();
    private Quote quote() {
        return pricing.quote(List.of(new LineInput("W", PriceMode.BY_WEIGHT, 990, 1, 1000, 500, true)),
                Optional.of(new Coupon(396, 0)), FreightPolicy.defaults());
    }
    private RepricingResult actual(long grams) {
        return pricing.recalculate(quote(), List.of(new ActualLine("W", grams,
                grams == 0 ? ReasonCode.SHORTAGE : grams == 1000 ? ReasonCode.NORMAL : ReasonCode.WEIGHT_VARIANCE)));
    }
    private OrderLifecycle pending() { return OrderLifecycle.pending(NOW, quote().payableAmount()); }
    private OrderLifecycle paid() { return pending().onPrepaymentSuccess("pay-1", 2184, NOW.plusSeconds(1)).order(); }
    private OrderLifecycle ready(long grams) {
        return paid().claimPicking().confirmPicking(actual(grams), NOW.plusSeconds(60), NOW.plusSeconds(3600)).order();
    }
    private static void reason(DomainException.Reason expected, Runnable work) {
        assertEquals(expected, assertThrows(DomainException.class, work::run).reason());
    }
    @Test void paymentBeforeDeadlineAcceptsFundsWithoutInventoryEffect() {
        OrderLifecycle pending = pending();
        PaymentDecision result = pending.onPrepaymentSuccess("pay-1", 2184, NOW.plusSeconds(899));
        assertEquals(OrderStatus.PAID, result.order().status());
        assertEquals(PaymentDisposition.ACCEPTED, result.disposition());
        assertEquals(InventoryAction.NONE, result.inventoryAction());
        assertEquals(OrderStatus.PENDING_PAY, pending.status());
        assertFalse(result.order().expireUnpaid(NOW.plusSeconds(1000)).changed());
    }
    @Test void paymentExactlyAtDeadlineClosesReleasesAndRequiresRefund() {
        PaymentDecision result = pending().onPrepaymentSuccess("late", 2184, NOW.plusSeconds(900));
        assertEquals(OrderStatus.CLOSED, result.order().status());
        assertEquals(PaymentDisposition.REFUND_LATE_PAYMENT, result.disposition());
        assertEquals(InventoryAction.RELEASE_RESERVED, result.inventoryAction());
        assertNull(result.order().acceptedPaymentId());
        assertFalse(result.order().expireUnpaid(NOW.plusSeconds(901)).changed());
    }
    @Test void latePaymentCannotReviveCanceledOrClosedOrder() {
        OrderLifecycle canceled = pending().cancel().order();
        assertEquals(OrderStatus.CANCELED, canceled.onPrepaymentSuccess("late", 2184, NOW.plusSeconds(3)).order().status());
        OrderLifecycle closed = pending().expireUnpaid(NOW.plusSeconds(900)).order();
        PaymentDecision late = closed.onPrepaymentSuccess("late", 2184, NOW.plusSeconds(901));
        assertEquals(OrderStatus.CLOSED, late.order().status()); assertEquals(InventoryAction.NONE, late.inventoryAction());
    }
    @Test void duplicateOriginalPaymentIsNoopInLaterFulfillmentStateButSecondAttemptRefunds() {
        OrderLifecycle picking = paid().claimPicking();
        PaymentDecision replay = picking.onPrepaymentSuccess("pay-1", 2184, NOW.plusSeconds(20));
        assertSame(picking, replay.order()); assertEquals(PaymentDisposition.DUPLICATE_EVENT, replay.disposition());
        PaymentDecision second = picking.onPrepaymentSuccess("pay-2", 2184, NOW.plusSeconds(20));
        assertEquals(PaymentDisposition.REFUND_DUPLICATE_PAYMENT, second.disposition());
        assertSame(picking, second.order());
    }
    @Test void rejectsAmountMismatchWithoutProducingAChangedOrder() {
        OrderLifecycle pending = pending();
        reason(PAYMENT_MISMATCH, () -> pending.onPrepaymentSuccess("bad", 2183, NOW));
        assertEquals(OrderStatus.PENDING_PAY, pending.status());
    }
    @Test void followsReachableHappyPathWithZeroAdjustmentAndVerifiedDelivery() {
        OrderLifecycle ready = ready(1000);
        assertEquals(WeightAdjustment.Status.NONE, ready.adjustment().status());
        OrderLifecycle delivered = ready.ship(true, false).completeDelivery(true, false);
        assertEquals(OrderStatus.FINISHED, delivered.status());
        assertTrue(delivered.version() > ready.version());
    }
    @Test void refundPendingBlocksDispatchUntilFullVerifiedRefundAggregateArrives() {
        OrderLifecycle ready = ready(960);
        assertEquals(-79, ready.adjustment().deltaAmount());
        reason(UNSETTLED_ADJUSTMENT, () -> ready.ship(true, false));
        reason(PAYMENT_MISMATCH, () -> ready.confirmWeightRefund(78));
        OrderLifecycle settled = ready.confirmWeightRefund(79);
        assertEquals(WeightAdjustment.Status.REFUNDED, settled.adjustment().status());
        assertSame(settled, settled.confirmWeightRefund(79));
        assertEquals(OrderStatus.DELIVERING, settled.ship(true, false).status());
    }
    @Test void topUpDeadlineIsTenMinutesOrSlotStartWhicheverComesFirst() {
        OrderLifecycle picking = paid().claimPicking();
        OrderLifecycle first = picking.confirmPicking(actual(1080), NOW.plusSeconds(60), NOW.plusSeconds(3600)).order();
        assertEquals(NOW.plusSeconds(660), first.adjustment().expiresAt());
        OrderLifecycle clipped = picking.confirmPicking(actual(1080), NOW.plusSeconds(60), NOW.plusSeconds(100)).order();
        assertEquals(NOW.plusSeconds(100), clipped.adjustment().expiresAt());
        reason(TOP_UP_DEADLINE, () -> picking.confirmPicking(actual(1080), NOW.plusSeconds(60), NOW.plusSeconds(60)));
    }
    @Test void successfulTopUpUnlocksShippingAndStaleTimerCannotCancel() {
        OrderLifecycle ready = ready(1080);
        reason(UNSETTLED_ADJUSTMENT, () -> ready.ship(true, false));
        PaymentDecision result = ready.onTopUpSuccess("top-1", 158, NOW.plusSeconds(100));
        assertEquals(WeightAdjustment.Status.SETTLED, result.order().adjustment().status());
        assertFalse(result.order().expireTopUp(NOW.plusSeconds(900)).changed());
        OrderLifecycle shipped = result.order().ship(true, false);
        assertEquals(PaymentDisposition.DUPLICATE_EVENT, shipped.onTopUpSuccess("top-1", 158, NOW.plusSeconds(1000)).disposition());
        assertEquals(PaymentDisposition.REFUND_DUPLICATE_PAYMENT, shipped.onTopUpSuccess("top-2", 158, NOW.plusSeconds(1000)).disposition());
    }
    @Test void topUpAtDeadlineCancelsAndRequiresBothNewPaymentRefundAndOriginalFundsRefund() {
        OrderLifecycle ready = ready(1080);
        PaymentDecision late = ready.onTopUpSuccess("top-late", 158, ready.adjustment().expiresAt());
        assertEquals(OrderStatus.CANCELED, late.order().status());
        assertEquals(WeightAdjustment.Status.CANCELED, late.order().adjustment().status());
        assertEquals(PaymentDisposition.REFUND_LATE_PAYMENT, late.disposition());
        assertTrue(late.refundExistingCapturedFunds());
        assertEquals(InventoryAction.RETURN_REQUIRED, late.inventoryAction());
        assertEquals(InventoryAction.NONE, late.order().onTopUpSuccess("top-late", 158, NOW.plusSeconds(1000)).inventoryAction());
    }
    @Test void topUpTimerReturnsExplicitRefundAndPhysicalReturnEffects() {
        OrderLifecycle ready = ready(1080);
        ExpiryDecision result = ready.expireTopUp(ready.adjustment().expiresAt());
        assertTrue(result.changed()); assertTrue(result.refundCapturedFunds());
        assertEquals(InventoryAction.RETURN_REQUIRED, result.inventoryAction());
        assertFalse(result.order().expireTopUp(NOW.plusSeconds(1000)).changed());
    }
    @Test void cancellationEffectDistinguishesUnpickedReservationFromIssuedPhysicalGoods() {
        CancellationDecision before = paid().cancel();
        assertEquals(InventoryAction.RELEASE_RESERVED, before.inventoryAction()); assertTrue(before.refundCapturedFunds());
        CancellationDecision after = ready(1000).cancel();
        assertEquals(InventoryAction.RETURN_REQUIRED, after.inventoryAction());
        assertEquals(WeightAdjustment.Status.CANCELED, after.order().adjustment().status());
        assertEquals(InventoryAction.NONE, after.order().cancel().inventoryAction());
    }
    @Test void allZeroConfirmationCancelsWithoutIssuingAnyStockAndRefundsFreight() {
        RepricingResult allZero = actual(0);
        assertEquals(-2184, allZero.deltaAmount());
        PickingDecision result = paid().claimPicking().confirmPicking(allZero, NOW.plusSeconds(1), NOW.plusSeconds(3600));
        assertEquals(OrderStatus.CANCELED, result.order().status());
        assertEquals(InventoryAction.RELEASE_RESERVED, result.inventoryAction());
        assertTrue(result.refundCapturedFunds());
    }
    @Test void noUnauthorizedStateJumpMissingProofOrOrdinaryPostDispatchCancellation() {
        reason(INVALID_STATE, () -> pending().claimPicking());
        reason(INVALID_STATE, () -> paid().ship(true, false));
        OrderLifecycle ready = ready(1000);
        reason(INVALID_STATE, () -> ready.ship(false, false));
        reason(INVALID_STATE, () -> ready.ship(true, true));
        OrderLifecycle dispatched = ready.ship(true, false);
        reason(INVALID_STATE, dispatched::cancel);
        reason(INVALID_STATE, () -> dispatched.completeDelivery(false, false));
        reason(INVALID_STATE, () -> ready.confirmPicking(actual(1000), NOW, NOW.plusSeconds(3600)));
    }
    @Test void unresolvedDeliveryExceptionBlocksEvenVerifiedProofUntilTaskIsResolved() {
        OrderLifecycle dispatched = ready(1000).ship(true, false);
        long versionBefore = dispatched.version();
        reason(INVALID_STATE, () -> dispatched.completeDelivery(true, true));
        assertEquals(OrderStatus.DELIVERING, dispatched.status());
        assertEquals(versionBefore, dispatched.version());
        OrderLifecycle finished = dispatched.completeDelivery(true, false);
        assertEquals(OrderStatus.FINISHED, finished.status());
        assertEquals(versionBefore + 1, finished.version());
        reason(INVALID_STATE, () -> finished.completeDelivery(true, false));
    }
    @Test void zeroChargeUsesInternalSettlementWithoutInventingChannelPayment() {
        OrderLifecycle zero = OrderLifecycle.pending(NOW, 0).settleZeroAmount(NOW.plusSeconds(1));
        assertEquals(OrderStatus.PAID, zero.status()); assertNull(zero.acceptedPaymentId());
        assertFalse(zero.cancel().refundCapturedFunds());
        reason(PAYMENT_MISMATCH, () -> OrderLifecycle.pending(NOW, 0).onPrepaymentSuccess("fake-zero", 0, NOW));
    }
    @Test void persistedInvalidCombinationsAreRejectedAtRehydration() {
        reason(VALIDATION_ERROR, () -> new OrderLifecycle(OrderStatus.PAID, 100, NOW, null, null, 0));
        reason(VALIDATION_ERROR, () -> new WeightAdjustment(0, WeightAdjustment.Status.TOP_UP_PENDING, NOW, null));
    }
}
