-- Fenced, bounded refund recovery. No historical financial facts are rewritten.
ALTER TABLE fm_outbox ADD COLUMN lease_token VARCHAR(36);
ALTER TABLE fm_outbox ADD COLUMN lease_generation BIGINT NOT NULL DEFAULT 0;
ALTER TABLE fm_outbox ADD COLUMN cycle_attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE fm_outbox ADD COLUMN failed_at TIMESTAMP(6);
CREATE INDEX idx_refund_outbox_aggregate ON fm_outbox(event_type,aggregate_id);

-- Private test/demo configuration, never an HTTP endpoint. Not a fabricated refund status.
CREATE TABLE fm_sandbox_refund_fault (
 refund_id VARCHAR(64) PRIMARY KEY,
 mode VARCHAR(40) NOT NULL,
 remaining_failures INT NOT NULL,
 triggered_count INT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(refund_id) REFERENCES fm_refund(refund_id),
 CONSTRAINT ck_refund_fault_mode CHECK(mode IN ('TRANSIENT_BEFORE_COMMIT','REJECT_BEFORE_COMMIT','ACK_LOST_AFTER_COMMIT')),
 CONSTRAINT ck_refund_fault_remaining CHECK(remaining_failures>=0 AND remaining_failures<=100),
 CONSTRAINT ck_refund_fault_triggered CHECK(triggered_count>=0)
);
