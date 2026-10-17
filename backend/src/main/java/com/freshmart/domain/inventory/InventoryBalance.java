package com.freshmart.domain.inventory;

import static com.freshmart.domain.DomainChecks.*;
import static com.freshmart.domain.DomainException.Reason.*;

/**
 * Immutable physical balance. Versions are proposals; callers must atomically persist with
 * expected old version and verify allocation ownership. No operation here locks a database.
 */
public record InventoryBalance(long onHand, long reserved, long quarantined, long version) {
    public InventoryBalance {
        nonnegative(onHand, "onHand"); nonnegative(reserved, "reserved");
        nonnegative(quarantined, "quarantined"); nonnegative(version, "version");
        require(reserved <= onHand && quarantined <= onHand - reserved, INVENTORY_INVARIANT,
                "reserved and quarantined must be disjoint subsets of onHand");
    }
    public long available() { return onHand - reserved - quarantined; }
    public InventoryBalance reserve(long quantity) {
        nonnegative(quantity, "quantity");
        require(quantity <= available(), INSUFFICIENT_STOCK, "insufficient unreserved non-quarantined stock");
        return quantity == 0 ? this : changed(onHand, add(reserved, quantity), quarantined);
    }
    /** The application must prove this quantity belongs to the canceling order's active allocations. */
    public InventoryBalance release(long ownReserved) {
        nonnegative(ownReserved, "ownReserved");
        require(ownReserved <= reserved, INVENTORY_INVARIANT, "release exceeds total reserved stock");
        return ownReserved == 0 ? this : changed(onHand, reserved - ownReserved, quarantined);
    }
    /**
     * Atomically confirms an allocation's actual pick. Other orders' reservations and quarantine
     * remain protected; overage consumes only currently available stock. Net reserved change is
     * -ownReserved, including the temporary extra reservation needed when actual > ownReserved.
     */
    public InventoryBalance pick(long ownReserved, long actualQuantity) {
        nonnegative(ownReserved, "ownReserved"); nonnegative(actualQuantity, "actualQuantity");
        require(ownReserved <= reserved, INVENTORY_INVARIANT, "pick reservation is not present");
        long otherReserved = reserved - ownReserved;
        require(actualQuantity <= onHand - quarantined - otherReserved, INSUFFICIENT_STOCK,
                "actual pick would consume quarantine or another order's reservation");
        return ownReserved == 0 && actualQuantity == 0 ? this
                : changed(onHand - actualQuantity, otherReserved, quarantined);
    }
    /** Physical receipt is required; cancellation/refund alone must never call this operation. */
    public InventoryBalance returnToQuarantine(long physicallyReceived) {
        positive(physicallyReceived, "physicallyReceived");
        return changed(add(onHand, physicallyReceived), reserved, add(quarantined, physicallyReceived));
    }
    /** Caller additionally validates inspection evidence, batch lifecycle, and non-expiry. */
    public InventoryBalance releaseQuarantine(long inspectedGood) {
        positive(inspectedGood, "inspectedGood");
        require(inspectedGood <= quarantined, INVENTORY_INVARIANT, "inspection quantity exceeds quarantine");
        return changed(onHand, reserved, quarantined - inspectedGood);
    }
    public InventoryBalance quarantine(long quantity) {
        positive(quantity, "quantity");
        require(quantity <= available(), INSUFFICIENT_STOCK, "cannot quarantine reserved stock");
        return changed(onHand, reserved, add(quarantined, quantity));
    }
    public InventoryBalance dispose(long physicallyDisposed) {
        positive(physicallyDisposed, "physicallyDisposed");
        require(physicallyDisposed <= quarantined, INVENTORY_INVARIANT, "disposal requires existing quarantine");
        return changed(onHand - physicallyDisposed, reserved, quarantined - physicallyDisposed);
    }
    private InventoryBalance changed(long stock, long locks, long quarantine) {
        return new InventoryBalance(stock, locks, quarantine, add(version, 1));
    }
}
