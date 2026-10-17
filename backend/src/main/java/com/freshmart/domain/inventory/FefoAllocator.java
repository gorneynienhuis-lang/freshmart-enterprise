package com.freshmart.domain.inventory;

import java.time.Instant;
import java.util.*;
import static com.freshmart.domain.DomainChecks.*;
import static com.freshmart.domain.DomainException.Reason.*;

/** Plans one SKU allocation against a transaction-consistent snapshot; never mutates supplied stock. */
public final class FefoAllocator {
    public record Batch(String batchId, String skuId, BaseUnit baseUnit, BatchLifecycle lifecycle,
                        Instant expiresAt, Instant receivedAt, InventoryBalance balance) {
        public Batch {
            id(batchId, "batchId"); id(skuId, "skuId");
            require(baseUnit != null && lifecycle != null && expiresAt != null && receivedAt != null && balance != null,
                    VALIDATION_ERROR, "complete batch metadata required");
            if (lifecycle == BatchLifecycle.QUARANTINED) {
                require(balance.reserved() == 0 && balance.quarantined() == balance.onHand(), INVENTORY_INVARIANT,
                        "whole-batch quarantine must have no reservations and isolate all on-hand stock");
            }
            if (lifecycle == BatchLifecycle.DISPOSED) {
                require(balance.onHand() == 0, INVENTORY_INVARIANT, "disposed batch must have no stock");
            }
        }
    }
    public record BatchAllocation(String batchId, long quantity, long expectedVersion, InventoryBalance afterReservation) {}
    public record AllocationPlan(String skuId, BaseUnit baseUnit, long requestedQuantity, List<BatchAllocation> allocations) {
        public AllocationPlan { allocations = List.copyOf(allocations); }
    }

    /**
     * Only expiresAt strictly after deliveryEnd is acceptable: equality expires at the window end.
     * The application must first check SKU sale status and that the delivery slot is bookable.
     * It must persist ALL proposed reservations/allocations with version checks or roll back ALL.
     */
    public AllocationPlan allocate(String skuId, BaseUnit baseUnit, long quantity, Instant now,
                                   Instant deliveryEnd, List<Batch> batches) {
        id(skuId, "skuId"); positive(quantity, "quantity");
        require(baseUnit != null && now != null && deliveryEnd != null && batches != null,
                VALIDATION_ERROR, "allocation context is required");
        require(deliveryEnd.isAfter(now), VALIDATION_ERROR, "delivery window must end in the future");
        Set<String> ids = new HashSet<>();
        List<Batch> eligible = new ArrayList<>();
        for (Batch batch : batches) {
            require(batch != null && ids.add(batch.batchId()), VALIDATION_ERROR, "duplicate/null batch snapshot");
            if (!batch.skuId().equals(skuId)) continue;
            require(batch.baseUnit() == baseUnit, INVENTORY_INVARIANT, "SKU batches use different base units");
            if (batch.lifecycle() == BatchLifecycle.NORMAL && batch.expiresAt().isAfter(now)
                    && batch.expiresAt().isAfter(deliveryEnd) && !batch.receivedAt().isAfter(now)
                    && batch.balance().available() > 0) eligible.add(batch);
        }
        eligible.sort(Comparator.comparing(Batch::expiresAt).thenComparing(Batch::receivedAt).thenComparing(Batch::batchId));
        List<BatchAllocation> allocations = new ArrayList<>();
        long remaining = quantity;
        for (Batch batch : eligible) {
            if (remaining == 0) break;
            long taken = Math.min(remaining, batch.balance().available());
            allocations.add(new BatchAllocation(batch.batchId(), taken, batch.balance().version(), batch.balance().reserve(taken)));
            remaining -= taken;
        }
        require(remaining == 0, INSUFFICIENT_STOCK, "eligible FEFO batches cannot fulfill the entire request");
        return new AllocationPlan(skuId, baseUnit, quantity, allocations);
    }
}
