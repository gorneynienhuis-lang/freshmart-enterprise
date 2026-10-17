package com.freshmart.domain;

import com.freshmart.domain.inventory.*;
import com.freshmart.domain.inventory.FefoAllocator.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static com.freshmart.domain.DomainException.Reason.*;

class InventoryDomainTest {
    private static final Instant NOW = Instant.parse("2026-10-18T05:00:00Z");
    private static final Instant END = NOW.plusSeconds(7200);
    private final FefoAllocator allocator = new FefoAllocator();
    private static Batch batch(String id, long stock, long reserved, long quarantine, long expiryOffset) {
        return new Batch(id, "S", BaseUnit.PIECE, BatchLifecycle.NORMAL, END.plusSeconds(expiryOffset), NOW.minusSeconds(1),
                new InventoryBalance(stock, reserved, quarantine, 4));
    }
    private static void reason(DomainException.Reason expected, Runnable work) {
        assertEquals(expected, assertThrows(DomainException.class, work::run).reason());
    }
    @Test void protectsPhysicalInvariantAndExcludesReservedAndQuarantine() {
        InventoryBalance stock = new InventoryBalance(100, 20, 30, 0);
        assertEquals(50, stock.available());
        reason(INVENTORY_INVARIANT, () -> new InventoryBalance(100, 80, 21, 0));
        reason(INSUFFICIENT_STOCK, () -> stock.reserve(51));
        assertEquals(100, stock.onHand());
    }
    @Test void reservationAndUnpickedCancellationNeverChangePhysicalStock() {
        InventoryBalance initial = new InventoryBalance(10, 0, 1, 0);
        InventoryBalance reserved = initial.reserve(3);
        assertEquals(new InventoryBalance(10, 3, 1, 1), reserved);
        assertEquals(new InventoryBalance(10, 0, 1, 2), reserved.release(3));
        assertEquals(new InventoryBalance(10, 0, 1, 0), initial);
    }
    @Test void actualOverageProtectsOtherReservationsAndQuarantine() {
        InventoryBalance stock = new InventoryBalance(2000, 1500, 200, 0);
        assertEquals(new InventoryBalance(920, 500, 200, 1), stock.pick(1000, 1080));
        reason(INSUFFICIENT_STOCK, () -> stock.pick(1000, 1301));
        reason(INVENTORY_INVARIANT, () -> stock.pick(1501, 1));
    }
    @Test void zeroPickOnlyReleasesAndShortPickReleasesUnusedRemainder() {
        InventoryBalance stock = new InventoryBalance(10, 6, 0, 0);
        assertEquals(new InventoryBalance(10, 2, 0, 1), stock.pick(4, 0));
        assertEquals(new InventoryBalance(7, 2, 0, 1), stock.pick(4, 3));
    }
    @Test void issuedCancellationDoesNotBecomeSellableBeforePhysicalReturnAndInspection() {
        InventoryBalance picked = new InventoryBalance(10, 3, 0, 0).pick(3, 3);
        assertEquals(7, picked.available());
        InventoryBalance returned = picked.returnToQuarantine(3);
        assertEquals(10, returned.onHand()); assertEquals(7, returned.available());
        assertEquals(10, returned.releaseQuarantine(3).available());
    }
    @Test void quarantineAndDisposalCannotConsumeOtherOrdersReservations() {
        InventoryBalance stock = new InventoryBalance(10, 8, 0, 0);
        reason(INSUFFICIENT_STOCK, () -> stock.quarantine(3));
        InventoryBalance isolated = stock.quarantine(2);
        assertEquals(new InventoryBalance(8, 8, 0, 2), isolated.dispose(2));
        reason(INVENTORY_INVARIANT, () -> stock.dispose(1));
    }
    @Test void fefoSplitsAcrossBatchesAndIncludesExpectedVersions() {
        Batch later = batch("B", 10, 1, 1, 200);
        Batch earlier = batch("A", 5, 1, 1, 100);
        AllocationPlan plan = allocator.allocate("S", BaseUnit.PIECE, 6, NOW, END, List.of(later, earlier));
        assertEquals(List.of("A", "B"), plan.allocations().stream().map(BatchAllocation::batchId).toList());
        assertEquals(List.of(3L, 3L), plan.allocations().stream().map(BatchAllocation::quantity).toList());
        assertEquals(4, plan.allocations().getFirst().expectedVersion());
        assertEquals(5, plan.allocations().getFirst().afterReservation().version());
        assertEquals(1, earlier.balance().reserved());
    }
    @Test void expiryAtDeliveryEndIsRejectedAlongsideExpiredAndTooEarlyBatches() {
        List<Batch> invalid = List.of(batch("expired", 10, 0, 0, -8000), batch("early", 10, 0, 0, -1), batch("equal", 10, 0, 0, 0));
        reason(INSUFFICIENT_STOCK, () -> allocator.allocate("S", BaseUnit.PIECE, 1, NOW, END, invalid));
        assertEquals(1, allocator.allocate("S", BaseUnit.PIECE, 1, NOW, END, List.of(batch("valid", 1, 0, 0, 1))).allocations().size());
    }
    @Test void sameExpiryUsesReceiptTimeThenIdDeterministically() {
        Batch b = batch("B", 1, 0, 0, 100), a = batch("A", 1, 0, 0, 100);
        assertEquals("A", allocator.allocate("S", BaseUnit.PIECE, 1, NOW, END, List.of(b, a)).allocations().getFirst().batchId());
    }
    @Test void insufficientPlanDoesNotPartiallyMutateAndDuplicateBatchCannotDoubleCount() {
        Batch batch = batch("A", 1, 0, 0, 100);
        reason(INSUFFICIENT_STOCK, () -> allocator.allocate("S", BaseUnit.PIECE, 2, NOW, END, List.of(batch)));
        assertEquals(0, batch.balance().reserved());
        reason(VALIDATION_ERROR, () -> allocator.allocate("S", BaseUnit.PIECE, 2, NOW, END, List.of(batch, batch)));
        reason(INVENTORY_INVARIANT, () -> allocator.allocate("S", BaseUnit.GRAM, 1, NOW, END, List.of(batch)));
    }
    @Test void isolatedLifecycleIsNotEligible() {
        Batch isolated = new Batch("Q", "S", BaseUnit.PIECE, BatchLifecycle.QUARANTINED, END.plusSeconds(10), NOW,
                new InventoryBalance(10, 0, 10, 0));
        reason(INSUFFICIENT_STOCK, () -> allocator.allocate("S", BaseUnit.PIECE, 1, NOW, END, List.of(isolated)));
    }
    @Test void repeatedPlanningExposesSameExpectedVersionAndDoesNotPretendToSerializeDatabase() {
        Batch initial = batch("A", 1, 0, 0, 10);
        AllocationPlan one = allocator.allocate("S", BaseUnit.PIECE, 1, NOW, END, List.of(initial));
        AllocationPlan two = allocator.allocate("S", BaseUnit.PIECE, 1, NOW, END, List.of(initial));
        assertEquals(one, two); // Database CAS must accept only one version-4 -> version-5 write.
        assertEquals(4, two.allocations().getFirst().expectedVersion());
    }
}
