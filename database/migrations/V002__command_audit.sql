CREATE TABLE fm_idempotency (
 actor_id VARCHAR(64) NOT NULL,
 route VARCHAR(256) NOT NULL,
 idempotency_key VARCHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 result_json TEXT,
 status VARCHAR(16) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 expires_at TIMESTAMP(6) NOT NULL,
 PRIMARY KEY(actor_id,route,idempotency_key),
 CONSTRAINT ck_idempotency_status CHECK(status IN ('PENDING','COMPLETED'))
);
CREATE INDEX idx_idempotency_expiry ON fm_idempotency(expires_at);
CREATE TABLE fm_audit_event (
 event_id VARCHAR(64) PRIMARY KEY,
 actor_id VARCHAR(64) NOT NULL,
 operation VARCHAR(128) NOT NULL,
 resource_type VARCHAR(64) NOT NULL,
 resource_id VARCHAR(64) NOT NULL,
 reason VARCHAR(500),
 before_summary TEXT,
 after_summary TEXT,
 trace_id VARCHAR(64) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_audit_resource ON fm_audit_event(resource_type,resource_id,created_at);
CREATE INDEX idx_audit_actor ON fm_audit_event(actor_id,created_at);
CREATE TABLE fm_outbox (
 event_id VARCHAR(64) PRIMARY KEY,
 business_key VARCHAR(200) NOT NULL UNIQUE,
 event_type VARCHAR(64) NOT NULL,
 aggregate_id VARCHAR(64) NOT NULL,
 payload TEXT NOT NULL,
 status VARCHAR(16) NOT NULL,
 attempt_count INT NOT NULL DEFAULT 0,
 available_at TIMESTAMP(6) NOT NULL,
 lease_until TIMESTAMP(6),
 last_error_code VARCHAR(64),
 created_at TIMESTAMP(6) NOT NULL,
 completed_at TIMESTAMP(6),
 CONSTRAINT ck_outbox_status CHECK(status IN ('PENDING','PROCESSING','COMPLETED','DEAD')),
 CONSTRAINT ck_outbox_attempt CHECK(attempt_count >= 0)
);
CREATE INDEX idx_outbox_poll ON fm_outbox(status,available_at,event_id);
