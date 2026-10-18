-- Transactional order, inventory allocation and sandbox financial ledgers.
CREATE TABLE fm_order (
 order_id VARCHAR(64) PRIMARY KEY,
 order_no VARCHAR(64) NOT NULL UNIQUE,
 user_id VARCHAR(64) NOT NULL,
 quote_id VARCHAR(64) NOT NULL UNIQUE,
 slot_id VARCHAR(64) NOT NULL,
 coupon_id VARCHAR(64),
 status VARCHAR(24) NOT NULL,
 snapshot_json MEDIUMTEXT NOT NULL,
 payable_amount BIGINT NOT NULL,
 paid_amount BIGINT NOT NULL DEFAULT 0,
 refunded_amount BIGINT NOT NULL DEFAULT 0,
 accepted_payment_id VARCHAR(64),
 adjustment_id VARCHAR(64),
 adjustment_status VARCHAR(24) NOT NULL DEFAULT 'NONE',
 adjustment_delta BIGINT NOT NULL DEFAULT 0,
 adjustment_expires_at TIMESTAMP(6),
 topup_payment_id VARCHAR(64),
 adjustment_json MEDIUMTEXT,
 pick_task_id VARCHAR(64) NOT NULL UNIQUE,
 picker_id VARCHAR(64),
 pick_status VARCHAR(24) NOT NULL DEFAULT 'UNASSIGNED',
 delivery_task_id VARCHAR(64) NOT NULL UNIQUE,
 courier_id VARCHAR(64),
 delivery_status VARCHAR(24) NOT NULL DEFAULT 'PENDING_DISPATCH',
 receipt_code VARCHAR(6),
 slot_held BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP(6) NOT NULL,
 updated_at TIMESTAMP(6) NOT NULL,
 payment_expires_at TIMESTAMP(6) NOT NULL,
 paid_at TIMESTAMP(6),
 dispatched_at TIMESTAMP(6),
 finished_at TIMESTAMP(6),
 version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(user_id) REFERENCES fm_user(user_id),
 FOREIGN KEY(quote_id) REFERENCES fm_checkout_quote(quote_id),
 FOREIGN KEY(slot_id) REFERENCES fm_delivery_slot(slot_id),
 FOREIGN KEY(coupon_id) REFERENCES fm_coupon(coupon_id),
 CONSTRAINT ck_order_status CHECK(status IN ('PENDING_PAY','PAID','PICKING','READY_TO_SHIP','DELIVERING','FINISHED','CANCELED','CLOSED')),
 CONSTRAINT ck_order_money CHECK(payable_amount>=0 AND paid_amount>=0 AND refunded_amount>=0 AND refunded_amount<=paid_amount),
 CONSTRAINT ck_order_version CHECK(version>=0),
 CONSTRAINT ck_order_adjustment CHECK(adjustment_status IN ('NONE','REFUND_PENDING','REFUNDED','TOP_UP_PENDING','SETTLED','CANCELED')),
 CONSTRAINT ck_order_pick CHECK(pick_status IN ('UNASSIGNED','CLAIMED','COMPLETED','CANCELED')),
 CONSTRAINT ck_order_delivery CHECK(delivery_status IN ('PENDING_DISPATCH','DELIVERING','COMPLETED','EXCEPTION','CANCELED'))
);
CREATE INDEX idx_order_owner ON fm_order(user_id,created_at,order_id);
CREATE INDEX idx_order_expiry ON fm_order(status,payment_expires_at);
CREATE INDEX idx_order_topup_expiry ON fm_order(adjustment_status,adjustment_expires_at);
CREATE TABLE fm_order_allocation (
 allocation_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL,
 order_item_id VARCHAR(64) NOT NULL,
 sku_id VARCHAR(64) NOT NULL,
 batch_id VARCHAR(64) NOT NULL,
 batch_no VARCHAR(64) NOT NULL,
 base_unit VARCHAR(10) NOT NULL,
 reserved_quantity BIGINT NOT NULL,
 picked_quantity BIGINT NOT NULL DEFAULT 0,
 returned_quantity BIGINT NOT NULL DEFAULT 0,
 version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id),
 FOREIGN KEY(sku_id) REFERENCES fm_sku(sku_id),
 FOREIGN KEY(batch_id) REFERENCES fm_inventory_batch(batch_id),
 CONSTRAINT ck_allocation_balance CHECK(reserved_quantity>=0 AND picked_quantity>=0 AND returned_quantity>=0 AND returned_quantity<=picked_quantity),
 CONSTRAINT ck_allocation_version CHECK(version>=0),
 CONSTRAINT ck_allocation_unit CHECK(base_unit IN ('PIECE','GRAM'))
);
CREATE INDEX idx_allocation_order ON fm_order_allocation(order_id,sku_id,batch_id);
CREATE TABLE fm_inventory_movement (
 movement_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL,
 allocation_id VARCHAR(64) NOT NULL,
 batch_id VARCHAR(64) NOT NULL,
 type VARCHAR(32) NOT NULL,
 on_hand_delta BIGINT NOT NULL,
 reserved_delta BIGINT NOT NULL,
 quarantined_delta BIGINT NOT NULL,
 reason VARCHAR(500) NOT NULL,
 actor_id VARCHAR(64) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL
);
CREATE TABLE fm_payment (
 payment_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL,
 user_id VARCHAR(64) NOT NULL,
 adjustment_id VARCHAR(64),
 purpose VARCHAR(16) NOT NULL,
 status VARCHAR(16) NOT NULL,
 amount BIGINT NOT NULL,
 refunded_amount BIGINT NOT NULL DEFAULT 0,
 refund_reserved BIGINT NOT NULL DEFAULT 0,
 channel_trade_no VARCHAR(64) UNIQUE,
 accepted BOOLEAN NOT NULL DEFAULT FALSE,
 expires_at TIMESTAMP(6) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 paid_at TIMESTAMP(6),
 version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id),
 CONSTRAINT ck_payment_balance CHECK(amount>0 AND amount<=9007199254740991 AND refunded_amount>=0 AND refund_reserved>=0 AND refunded_amount+refund_reserved<=amount),
 CONSTRAINT ck_payment_status CHECK(status IN ('INIT','PENDING','SUCCESS','FAILED','CLOSED')),
 CONSTRAINT ck_payment_purpose CHECK(purpose IN ('ORDER','TOP_UP'))
);
CREATE INDEX idx_payment_order ON fm_payment(order_id,payment_id);
CREATE TABLE fm_payment_event (
 event_id VARCHAR(64) PRIMARY KEY,
 payment_id VARCHAR(64) NOT NULL,
 nonce VARCHAR(64) NOT NULL UNIQUE,
 request_hash CHAR(64) NOT NULL,
 accepted BOOLEAN NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(payment_id) REFERENCES fm_payment(payment_id)
);
CREATE TABLE fm_refund (
 refund_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL,
 payment_id VARCHAR(64) NOT NULL,
 business_key VARCHAR(200) NOT NULL UNIQUE,
 aftersale_id VARCHAR(64),
 adjustment_id VARCHAR(64),
 type VARCHAR(32) NOT NULL,
 amount BIGINT NOT NULL,
 status VARCHAR(16) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 reviewer_id VARCHAR(64),
 executor_id VARCHAR(64),
 last_error VARCHAR(500),
 created_at TIMESTAMP(6) NOT NULL,
 completed_at TIMESTAMP(6),
 version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id),
 FOREIGN KEY(payment_id) REFERENCES fm_payment(payment_id),
 CONSTRAINT ck_refund_amount CHECK(amount>0),
 CONSTRAINT ck_refund_status CHECK(status IN ('PENDING','PROCESSING','SUCCESS','FAILED')),
 CONSTRAINT ck_refund_separation CHECK(reviewer_id IS NULL OR executor_id IS NULL OR reviewer_id<>executor_id)
);
CREATE INDEX idx_refund_order ON fm_refund(order_id,created_at);
CREATE TABLE fm_sandbox_refund_receipt (
 refund_id VARCHAR(64) PRIMARY KEY,
 payment_id VARCHAR(64) NOT NULL,
 amount BIGINT NOT NULL,
 channel_refund_no VARCHAR(64) NOT NULL UNIQUE,
 completed_at TIMESTAMP(6) NOT NULL,
 CONSTRAINT ck_sandbox_refund_amount CHECK(amount>0)
);

ALTER TABLE fm_idempotency MODIFY COLUMN result_json MEDIUMTEXT;
ALTER TABLE fm_checkout_quote MODIFY COLUMN snapshot_json MEDIUMTEXT;
