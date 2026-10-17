package com.freshmart.domain;

import com.freshmart.domain.pricing.PriceMode;
import com.freshmart.domain.pricing.PricingCalculator;
import com.freshmart.domain.pricing.PricingCalculator.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.freshmart.domain.DomainException.Reason.*;

class PricingCalculatorTest {
    private final PricingCalculator calculator = new PricingCalculator();
    private static LineInput piece(String sku, long price, long quantity, boolean eligible) {
        return new LineInput(sku, PriceMode.BY_PIECE, price, quantity, 0, 0, eligible);
    }
    private static LineInput weight(long price, long estimate) {
        return new LineInput("W", PriceMode.BY_WEIGHT, price, 1, estimate, 500, true);
    }
    private Quote quote(List<LineInput> lines, Coupon coupon) {
        return calculator.quote(lines, Optional.ofNullable(coupon), FreightPolicy.defaults());
    }
    private static void reason(DomainException.Reason expected, Runnable work) {
        assertEquals(expected, assertThrows(DomainException.class, work::run).reason());
    }

    @Test void calculatesIntegerFenWithHalfUpAndExplicitPriceDenominator() {
        assertEquals(616, PricingCalculator.weightedAmount(925, 333, 500));
        assertEquals(648, PricingCalculator.weightedAmount(925, 350, 500));
        assertEquals(950, PricingCalculator.weightedAmount(990, 480, 500));
        assertEquals(0, PricingCalculator.weightedAmount(990, 0, 500));
    }
    @Test void preservesIntegerPrecisionBeyondIntermediateLongMultiplication() {
        long max = DomainChecks.MAX_EXACT_INTEGER;
        assertEquals(max, PricingCalculator.weightedAmount(max, max, max));
        reason(AMOUNT_OVERFLOW, () -> PricingCalculator.weightedAmount(max, 2, 1));
        reason(VALIDATION_ERROR, () -> PricingCalculator.weightedAmount(990, 500, 0));
    }
    @Test void chargesFreightOnlyAfterCouponAndUsesInclusiveThreshold() {
        Quote discounted = quote(List.of(piece("A", 9900, 1, true)), new Coupon(1000, 9900));
        assertEquals(8900, discounted.goodsPayableAmount());
        assertEquals(600, discounted.freightAmount());
        assertEquals(9500, discounted.payableAmount());
        assertEquals(0, quote(List.of(piece("A", 9900, 1, true)), null).freightAmount());
    }
    @Test void allocatesCouponByLargestRemainderWithStableSkuTieNotInputOrder() {
        Quote result = quote(List.of(piece("C", 100, 1, true), piece("A", 100, 1, true), piece("B", 100, 1, true)), new Coupon(2, 0));
        assertEquals(List.of("A", "B", "C"), result.lines().stream().map(x -> x.input().skuId()).toList());
        assertEquals(List.of(1L, 1L, 0L), result.lines().stream().map(QuotedLine::couponAllocationAmount).toList());
        assertEquals(2, result.couponDiscountAmount());
    }
    @Test void couponEligibilityAndThresholdUseOnlyEligibleGoods() {
        reason(VALIDATION_ERROR, () -> quote(List.of(piece("A", 500, 1, true), piece("B", 10000, 1, false)), new Coupon(100, 1000)));
        Quote result = quote(List.of(piece("A", 500, 1, true), piece("B", 10000, 1, false)), new Coupon(1000, 500));
        assertEquals(500, result.couponDiscountAmount());
        assertEquals(0, result.lines().get(1).couponAllocationAmount());
    }
    @Test void mergesSameSkuBeforeRoundingAndRejectsConflictingSnapshots() {
        Quote result = quote(List.of(piece("A", 99, 1, true), piece("A", 99, 2, true)), null);
        assertEquals(1, result.lines().size());
        assertEquals(3, result.lines().getFirst().input().quantity());
        assertEquals(297, result.goodsAmount());
        reason(VALIDATION_ERROR, () -> quote(List.of(piece("A", 99, 1, true), piece("A", 100, 1, true)), null));
    }
    @Test void refundExampleRetainsOriginalCouponAllocationAndFreight() {
        Quote original = quote(List.of(weight(990, 1000)), new Coupon(396, 0));
        RepricingResult result = calculator.recalculate(original, List.of(new ActualLine("W", 960, ReasonCode.WEIGHT_VARIANCE)));
        assertEquals(2184, original.payableAmount());
        assertEquals(1901, result.lines().getFirst().goodsAmount());
        assertEquals(396, result.lines().getFirst().couponAllocationAmount());
        assertEquals(600, result.freightAmount());
        assertEquals(2105, result.payableAmount());
        assertEquals(-79, result.deltaAmount());
    }
    @Test void topUpExampleAndIntegerFloorOverweightBoundary() {
        Quote original = quote(List.of(weight(990, 1000)), new Coupon(396, 0));
        assertEquals(158, calculator.recalculate(original, List.of(new ActualLine("W", 1080, ReasonCode.WEIGHT_VARIANCE))).deltaAmount());
        assertDoesNotThrow(() -> calculator.recalculate(original, List.of(new ActualLine("W", 1100, ReasonCode.WEIGHT_VARIANCE))));
        reason(WEIGHT_LIMIT, () -> calculator.recalculate(original, List.of(new ActualLine("W", 1101, ReasonCode.WEIGHT_VARIANCE))));
        Quote odd = quote(List.of(weight(925, 333)), null);
        assertDoesNotThrow(() -> calculator.recalculate(odd, List.of(new ActualLine("W", 366, ReasonCode.WEIGHT_VARIANCE))));
        reason(WEIGHT_LIMIT, () -> calculator.recalculate(odd, List.of(new ActualLine("W", 367, ReasonCode.WEIGHT_VARIANCE))));
    }
    @Test void couponDoesNotBecomeCashOrMoveToAnotherLineAfterShortage() {
        Quote original = quote(List.of(piece("A", 100, 2, true), piece("B", 100, 2, true)), new Coupon(300, 0));
        RepricingResult result = calculator.recalculate(original,
                List.of(new ActualLine("A", 1, ReasonCode.SHORTAGE), new ActualLine("B", 2, ReasonCode.NORMAL)));
        assertEquals(100, result.lines().getFirst().couponAllocationAmount());
        assertEquals(0, result.lines().getFirst().payableAmount());
        assertEquals(150, result.lines().get(1).couponAllocationAmount());
        assertEquals(50, result.goodsPayableAmount());
        assertEquals(-50, result.deltaAmount());
    }
    @Test void allZeroCancelsAndRefundsFreightButPartialZeroKeepsFreight() {
        Quote original = quote(List.of(piece("A", 100, 1, true), weight(990, 500)), null);
        RepricingResult all = calculator.recalculate(original, List.of(new ActualLine("A", 0, ReasonCode.SHORTAGE), new ActualLine("W", 0, ReasonCode.SHORTAGE)));
        assertTrue(all.cancelOrder()); assertEquals(0, all.payableAmount()); assertEquals(-original.payableAmount(), all.deltaAmount());
        RepricingResult partial = calculator.recalculate(original, List.of(new ActualLine("A", 0, ReasonCode.SHORTAGE), new ActualLine("W", 500, ReasonCode.NORMAL)));
        assertFalse(partial.cancelOrder()); assertEquals(600, partial.freightAmount()); assertEquals(-100, partial.deltaAmount());
    }
    @Test void requiresCompleteUniqueActualLinesAndShortageReasons() {
        Quote original = quote(List.of(piece("A", 100, 2, true)), null);
        reason(VALIDATION_ERROR, () -> calculator.recalculate(original, List.of()));
        reason(VALIDATION_ERROR, () -> calculator.recalculate(original, List.of(new ActualLine("B", 1, ReasonCode.NORMAL))));
        reason(VALIDATION_ERROR, () -> calculator.recalculate(original, List.of(new ActualLine("A", 0, ReasonCode.NORMAL))));
        reason(VALIDATION_ERROR, () -> calculator.recalculate(original, List.of(new ActualLine("A", 3, ReasonCode.NORMAL))));
    }
    @Test void zeroPricedEligibleGoodsDoNotDivideByZeroAndResultsAreImmutable() {
        Quote result = quote(List.of(piece("A", 0, 1, true)), new Coupon(100, 0));
        assertEquals(0, result.couponDiscountAmount());
        assertThrows(UnsupportedOperationException.class, () -> result.lines().clear());
    }
    @Test void couponConservationAcrossManyDeterministicBaskets() {
        Random random = new Random(72531);
        for (int test = 0; test < 100; test++) {
            List<LineInput> lines = new ArrayList<>();
            long sum = 0;
            for (int i = 0; i < 7; i++) { long price = random.nextInt(1000); sum += price; lines.add(piece("S" + i, price, 1, true)); }
            long face = 1 + random.nextInt(8000);
            Quote result = quote(lines, new Coupon(face, 0));
            assertEquals(Math.min(sum, face), result.lines().stream().mapToLong(QuotedLine::couponAllocationAmount).sum());
            assertTrue(result.lines().stream().allMatch(l -> l.payableAmount() >= 0));
            assertEquals(result.goodsAmount() - result.couponDiscountAmount(), result.goodsPayableAmount());
        }
    }
}
