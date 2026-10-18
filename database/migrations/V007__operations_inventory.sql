-- Warehouse receipts/adjustments have no order or allocation. Keep them in the same immutable ledger.
ALTER TABLE fm_inventory_movement MODIFY COLUMN order_id VARCHAR(64) NULL;
ALTER TABLE fm_inventory_movement MODIFY COLUMN allocation_id VARCHAR(64) NULL;
ALTER TABLE fm_inventory_batch ADD COLUMN produced_at TIMESTAMP(6) NULL;
-- Historic course batches did not retain production time; preserve their known receipt timestamp.
UPDATE fm_inventory_batch SET produced_at=received_at WHERE produced_at IS NULL;
-- Legacy seed/test insert statements omit this field; new receipt commands always supply it.
ALTER TABLE fm_inventory_batch ADD CONSTRAINT ck_batch_production CHECK (produced_at IS NULL OR (produced_at <= received_at AND produced_at < expires_at));
CREATE INDEX idx_inventory_movement_created ON fm_inventory_movement(created_at,movement_id);
CREATE INDEX idx_inventory_movement_batch ON fm_inventory_movement(batch_id,created_at,movement_id);
CREATE TABLE fm_business_policy (
 policy_id VARCHAR(32) PRIMARY KEY,
 freight_amount BIGINT NOT NULL,
 free_shipping_threshold_amount BIGINT NOT NULL,
 near_expiry_days INT NOT NULL,
 near_expiry_discount_basis_points INT NOT NULL,
 newcomer_coupon_amount BIGINT NOT NULL,
 newcomer_coupon_min_goods_amount BIGINT NOT NULL,
 version BIGINT NOT NULL DEFAULT 0,
 effective_at TIMESTAMP(6) NOT NULL,
 CHECK(freight_amount >= 0 AND freight_amount <= 9007199254740991),
 CHECK(free_shipping_threshold_amount >= 0 AND free_shipping_threshold_amount <= 9007199254740991),
 CHECK(near_expiry_days BETWEEN 1 AND 30),
 CHECK(near_expiry_discount_basis_points BETWEEN 1 AND 10000),
 CHECK(newcomer_coupon_amount >= 0 AND newcomer_coupon_amount <= 9007199254740991),
 CHECK(newcomer_coupon_min_goods_amount >= 0 AND newcomer_coupon_min_goods_amount <= 9007199254740991),
 CHECK(version >= 0)
);
INSERT INTO fm_business_policy(policy_id,freight_amount,free_shipping_threshold_amount,near_expiry_days,near_expiry_discount_basis_points,newcomer_coupon_amount,newcomer_coupon_min_goods_amount,version,effective_at)
 VALUES('STORE',600,9900,3,9000,500,3000,0,CURRENT_TIMESTAMP(6));
