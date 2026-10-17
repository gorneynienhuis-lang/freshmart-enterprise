/**
 * Framework-free domain rules for the v0.1 contract. Values and plans are immutable.
 *
 * <p>The application must authorize actors, load authoritative snapshots, enforce idempotency,
 * validate payment signatures/bindings/currency, and commit state + stock + coupon + slot +
 * financial ledger + outbox in one database transaction. A plan does not acquire a lock or
 * prove a commit. Apply expected versions with a conditional database update and reject/retry
 * the whole transaction if any version changed. Global lock order: idempotency, order,
 * payment/refund, coupon, delivery slot, then stable SKU/batch IDs.
 *
 * <p>No class here performs external I/O, stores mutable global stock, or simulates a database
 * transaction. Concurrent calls against the same snapshot may produce the same valid plan;
 * only the application's database lock/CAS and unique constraints choose the winner.
 */
package com.freshmart.domain;
