package com.freshmart.domain.pricing;

import com.freshmart.domain.DomainChecks;
import java.math.BigInteger;
import java.util.*;
import static com.freshmart.domain.DomainChecks.*;
import static com.freshmart.domain.DomainException.Reason.*;

/** Integer-fen pricing. Inputs must be server-selected prices, never client-trusted money. */
public final class PricingCalculator {
    public enum ReasonCode { NORMAL, SHORTAGE, WEIGHT_VARIANCE }

    /** estimatedGram is the whole line's estimate; piece lines use zero gram fields. */
    public record LineInput(String skuId, PriceMode priceMode, long unitPrice, long quantity,
                            long estimatedGram, long priceUnitGram, boolean couponEligible) {
        public LineInput {
            id(skuId, "skuId");
            require(priceMode != null, VALIDATION_ERROR, "priceMode is required");
            nonnegative(unitPrice, "unitPrice"); positive(quantity, "quantity");
            if (priceMode == PriceMode.BY_WEIGHT) {
                positive(estimatedGram, "estimatedGram"); positive(priceUnitGram, "priceUnitGram");
            } else {
                require(estimatedGram == 0 && priceUnitGram == 0, VALIDATION_ERROR,
                        "piece lines must not carry gram pricing fields");
            }
        }
    }
    public record Coupon(long faceAmount, long minGoodsAmount) {
        public Coupon { positive(faceAmount, "faceAmount"); nonnegative(minGoodsAmount, "minGoodsAmount"); }
    }
    public record FreightPolicy(long freeShippingThreshold, long standardFreight) {
        public FreightPolicy {
            nonnegative(freeShippingThreshold, "freeShippingThreshold"); nonnegative(standardFreight, "standardFreight");
        }
        public static FreightPolicy defaults() { return new FreightPolicy(9900, 600); }
    }
    public record QuotedLine(LineInput input, long goodsAmount, long couponAllocationAmount,
                             long payableAmount) {
        public QuotedLine {
            require(input != null, VALIDATION_ERROR, "line input is required");
            require(goodsAmount == lineAmount(input, estimatedBaseQuantity(input)), VALIDATION_ERROR,
                    "quote goods amount does not match its price snapshot");
            nonnegative(couponAllocationAmount, "couponAllocationAmount");
            require(couponAllocationAmount <= goodsAmount && payableAmount == goodsAmount - couponAllocationAmount,
                    VALIDATION_ERROR, "invalid coupon/net amount snapshot");
            require(input.couponEligible() || couponAllocationAmount == 0, VALIDATION_ERROR,
                    "coupon assigned to ineligible line");
        }
    }
    public record Quote(List<QuotedLine> lines, long goodsAmount, long couponDiscountAmount,
                        long goodsPayableAmount, long freightAmount, long payableAmount) {
        public Quote {
            require(lines != null && !lines.isEmpty(), VALIDATION_ERROR, "quote lines are required");
            lines = List.copyOf(lines);
            Set<String> ids = new HashSet<>();
            long goods = 0, discounts = 0, net = 0;
            for (QuotedLine line : lines) {
                require(line != null && ids.add(line.input().skuId()), VALIDATION_ERROR, "duplicate quote SKU");
                goods = add(goods, line.goodsAmount()); discounts = add(discounts, line.couponAllocationAmount());
                net = add(net, line.payableAmount());
            }
            nonnegative(freightAmount, "freightAmount");
            require(goods == goodsAmount && discounts == couponDiscountAmount && net == goodsPayableAmount
                    && add(net, freightAmount) == payableAmount, VALIDATION_ERROR, "quote totals are inconsistent");
        }
    }
    /** actualQuantity is PIECE count or GRAM mass, according to the quoted priceMode. */
    public record ActualLine(String skuId, long actualQuantity, ReasonCode reasonCode) {
        public ActualLine {
            id(skuId, "skuId"); nonnegative(actualQuantity, "actualQuantity");
            require(reasonCode != null, VALIDATION_ERROR, "reasonCode is required");
        }
    }
    public record RepricedLine(String skuId, PriceMode priceMode, long actualQuantity, long goodsAmount,
                               long couponAllocationAmount, long originalPayableAmount, long payableAmount,
                               long deltaAmount) {
        public RepricedLine {
            id(skuId, "skuId");
            require(priceMode != null, VALIDATION_ERROR, "priceMode is required");
            nonnegative(actualQuantity, "actualQuantity"); nonnegative(goodsAmount, "goodsAmount");
            nonnegative(couponAllocationAmount, "couponAllocationAmount");
            nonnegative(originalPayableAmount, "originalPayableAmount");
            require(couponAllocationAmount <= goodsAmount && payableAmount == goodsAmount - couponAllocationAmount
                    && deltaAmount == payableAmount - originalPayableAmount, VALIDATION_ERROR, "invalid repriced line");
        }
    }
    public record RepricingResult(List<RepricedLine> lines, long originalPayableAmount,
                                  long goodsPayableAmount, long freightAmount, long payableAmount,
                                  long deltaAmount, boolean cancelOrder) {
        public RepricingResult {
            require(lines != null && !lines.isEmpty(), VALIDATION_ERROR, "repriced lines are required");
            lines = List.copyOf(lines);
            nonnegative(originalPayableAmount, "originalPayableAmount");
            nonnegative(goodsPayableAmount, "goodsPayableAmount"); nonnegative(freightAmount, "freightAmount");
            long summedNet = 0, originalNet = 0;
            Set<String> ids = new HashSet<>();
            for (RepricedLine line : lines) {
                require(ids.add(line.skuId()), VALIDATION_ERROR, "duplicate repriced SKU");
                summedNet = add(summedNet, line.payableAmount());
                originalNet = add(originalNet, line.originalPayableAmount());
            }
            require(summedNet == goodsPayableAmount && originalNet <= originalPayableAmount,
                    VALIDATION_ERROR, "repriced line amounts do not match totals");
            require(payableAmount == add(goodsPayableAmount, freightAmount)
                    && deltaAmount == payableAmount - originalPayableAmount, VALIDATION_ERROR, "invalid repricing totals");
            require(cancelOrder == lines.stream().allMatch(l -> l.actualQuantity() == 0)
                            && (!cancelOrder || payableAmount == 0),
                    VALIDATION_ERROR, "full-shortage cancellation requires zero physical goods and charge");
        }
    }

    /** Merges repeated SKUs only when their authoritative pricing attributes agree. */
    public Quote quote(List<LineInput> inputs, Optional<Coupon> coupon, FreightPolicy freight) {
        require(inputs != null && !inputs.isEmpty() && coupon != null && freight != null,
                VALIDATION_ERROR, "pricing inputs are required");
        Map<String, LineInput> merged = new TreeMap<>();
        for (LineInput input : inputs) {
            require(input != null, VALIDATION_ERROR, "null price line");
            merged.merge(input.skuId(), input, (a, b) -> {
                require(a.priceMode() == b.priceMode() && a.unitPrice() == b.unitPrice()
                        && a.priceUnitGram() == b.priceUnitGram() && a.couponEligible() == b.couponEligible(),
                        VALIDATION_ERROR, "conflicting snapshots for the same SKU");
                return new LineInput(a.skuId(), a.priceMode(), a.unitPrice(), add(a.quantity(), b.quantity()),
                        add(a.estimatedGram(), b.estimatedGram()), a.priceUnitGram(), a.couponEligible());
            });
        }
        Map<String, Long> goods = new TreeMap<>(), allocations = new HashMap<>();
        long total = 0, eligible = 0;
        for (LineInput line : merged.values()) {
            long amount = lineAmount(line, estimatedBaseQuantity(line));
            goods.put(line.skuId(), amount); total = add(total, amount);
            if (line.couponEligible()) eligible = add(eligible, amount);
        }
        long discount = 0;
        if (coupon.isPresent()) {
            Coupon selected = coupon.get();
            require(eligible >= selected.minGoodsAmount(), VALIDATION_ERROR, "coupon threshold is not met");
            discount = Math.min(selected.faceAmount(), eligible);
        }
        if (discount > 0) {
            record Remainder(String skuId, BigInteger remainder) {}
            List<Remainder> remainders = new ArrayList<>();
            long assigned = 0;
            for (LineInput line : merged.values()) {
                if (!line.couponEligible()) continue;
                BigInteger[] division = BigInteger.valueOf(discount).multiply(BigInteger.valueOf(goods.get(line.skuId())))
                        .divideAndRemainder(BigInteger.valueOf(eligible));
                long floor = division[0].longValueExact();
                allocations.put(line.skuId(), floor); assigned += floor;
                remainders.add(new Remainder(line.skuId(), division[1]));
            }
            remainders.sort(Comparator.comparing(Remainder::remainder).reversed().thenComparing(Remainder::skuId));
            for (int i = 0; i < discount - assigned; i++) {
                String sku = remainders.get(i).skuId(); allocations.put(sku, allocations.get(sku) + 1);
            }
        }
        List<QuotedLine> result = new ArrayList<>();
        for (LineInput line : merged.values()) {
            long amount = goods.get(line.skuId()), allocated = allocations.getOrDefault(line.skuId(), 0L);
            result.add(new QuotedLine(line, amount, allocated, amount - allocated));
        }
        long net = total - discount;
        long shipping = net >= freight.freeShippingThreshold() ? 0 : freight.standardFreight();
        return new Quote(result, total, discount, net, shipping, add(net, shipping));
    }

    /** Keeps original coupon allocations, caps them by each new line amount, and never re-prices freight. */
    public RepricingResult recalculate(Quote original, List<ActualLine> actualLines) {
        require(original != null && actualLines != null, VALIDATION_ERROR, "quote and actual lines required");
        Map<String, ActualLine> actual = new HashMap<>();
        for (ActualLine line : actualLines) {
            require(line != null && actual.putIfAbsent(line.skuId(), line) == null, VALIDATION_ERROR, "duplicate actual SKU");
        }
        require(actual.size() == original.lines().size(), VALIDATION_ERROR, "all quoted SKUs must be supplied once");
        List<RepricedLine> result = new ArrayList<>();
        long net = 0;
        boolean allZero = true;
        for (QuotedLine quoted : original.lines()) {
            LineInput input = quoted.input();
            ActualLine line = actual.get(input.skuId());
            require(line != null, VALIDATION_ERROR, "actual SKU does not belong to quote");
            long count = line.actualQuantity(), estimate = estimatedBaseQuantity(input);
            if (input.priceMode() == PriceMode.BY_WEIGHT) {
                BigInteger maximum = BigInteger.valueOf(estimate).multiply(BigInteger.valueOf(11)).divide(BigInteger.TEN);
                require(BigInteger.valueOf(count).compareTo(maximum) <= 0, WEIGHT_LIMIT, "actual weight exceeds 110% estimate");
            } else {
                require(count <= estimate, VALIDATION_ERROR, "piece quantity cannot exceed the original order");
            }
            require(count != 0 || line.reasonCode() == ReasonCode.SHORTAGE, VALIDATION_ERROR, "zero quantity requires SHORTAGE");
            require(input.priceMode() != PriceMode.BY_PIECE || count == estimate || line.reasonCode() == ReasonCode.SHORTAGE,
                    VALIDATION_ERROR, "partial piece shortage requires SHORTAGE");
            require(count == estimate || line.reasonCode() != ReasonCode.NORMAL, VALIDATION_ERROR, "changed quantity requires a reason");
            long goods = lineAmount(input, count), allocated = Math.min(quoted.couponAllocationAmount(), goods);
            long payable = goods - allocated;
            result.add(new RepricedLine(input.skuId(), input.priceMode(), count, goods, allocated,
                    quoted.payableAmount(), payable, payable - quoted.payableAmount()));
            net = add(net, payable); allZero &= count == 0;
        }
        long shipping = allZero ? 0 : original.freightAmount();
        long payable = add(net, shipping);
        return new RepricingResult(result, original.payableAmount(), net, shipping, payable,
                payable - original.payableAmount(), allZero);
    }

    public static long weightedAmount(long unitPrice, long grams, long priceUnitGram) {
        nonnegative(unitPrice, "unitPrice"); nonnegative(grams, "grams"); positive(priceUnitGram, "priceUnitGram");
        BigInteger[] qr = BigInteger.valueOf(unitPrice).multiply(BigInteger.valueOf(grams))
                .divideAndRemainder(BigInteger.valueOf(priceUnitGram));
        if (qr[1].multiply(BigInteger.TWO).compareTo(BigInteger.valueOf(priceUnitGram)) >= 0) qr[0] = qr[0].add(BigInteger.ONE);
        return DomainChecks.bounded(qr[0]);
    }
    private static long estimatedBaseQuantity(LineInput line) {
        return line.priceMode() == PriceMode.BY_WEIGHT ? line.estimatedGram() : line.quantity();
    }
    private static long lineAmount(LineInput line, long quantity) {
        return line.priceMode() == PriceMode.BY_WEIGHT ? weightedAmount(line.unitPrice(), quantity, line.priceUnitGram())
                : multiply(line.unitPrice(), quantity);
    }
}
