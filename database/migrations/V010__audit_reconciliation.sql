-- Historical audit records remain unknown; do not invent past actor roles/results.
ALTER TABLE fm_audit_event ADD COLUMN actor_roles_snapshot VARCHAR(128);
ALTER TABLE fm_audit_event ADD COLUMN outcome VARCHAR(16);
ALTER TABLE fm_audit_event ADD CONSTRAINT ck_audit_outcome CHECK(outcome IS NULL OR outcome IN ('SUCCESS','DENIED','FAILED','UNKNOWN'));

-- Independent normalized evidence from verified sandbox channel events.
CREATE TABLE fm_sandbox_payment_receipt (
 event_id VARCHAR(64) PRIMARY KEY,
 payment_id VARCHAR(64) NOT NULL,
 channel_trade_no VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL,
 amount BIGINT NOT NULL,
 occurred_at TIMESTAMP(6) NOT NULL,
 recorded_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(payment_id) REFERENCES fm_payment(payment_id),
 CONSTRAINT ck_channel_payment_status CHECK(status IN ('SUCCESS','FAILED')),
 CONSTRAINT ck_channel_payment_amount CHECK(amount > 0)
);
CREATE INDEX idx_channel_payment_day ON fm_sandbox_payment_receipt(recorded_at,payment_id);
CREATE INDEX idx_channel_payment_trade ON fm_sandbox_payment_receipt(channel_trade_no,status);

CREATE TABLE fm_reconciliation (
 reconciliation_id VARCHAR(64) PRIMARY KEY,
 business_date DATE NOT NULL,
 created_by VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL,
 payment_count BIGINT NOT NULL,
 payment_amount BIGINT NOT NULL,
 refund_count BIGINT NOT NULL,
 refund_amount BIGINT NOT NULL,
 difference_amount BIGINT NOT NULL,
 difference_count BIGINT NOT NULL,
 details_json MEDIUMTEXT NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 completed_at TIMESTAMP(6),
 CONSTRAINT ck_reconciliation_status CHECK(status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
 CONSTRAINT ck_reconciliation_counts CHECK(payment_count>=0 AND refund_count>=0 AND difference_count>=0 AND payment_amount>=0 AND refund_amount>=0)
);
CREATE INDEX idx_reconciliation_day ON fm_reconciliation(business_date,created_at,reconciliation_id);
