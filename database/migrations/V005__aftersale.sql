-- Cash-only aftersale budgets. Physical stock is never changed by this module.
CREATE TABLE fm_aftersale (
 aftersale_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL, member_id VARCHAR(64) NOT NULL,
 case_type VARCHAR(16) NOT NULL, reason VARCHAR(1000) NOT NULL,
 status VARCHAR(16) NOT NULL, requested_amount BIGINT NOT NULL, approved_amount BIGINT NOT NULL DEFAULT 0,
 assignee_id VARCHAR(64), reviewer_id VARCHAR(64), review_comment VARCHAR(1000),
 applied_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id), FOREIGN KEY(member_id) REFERENCES fm_user(user_id),
 CHECK(case_type IN ('QUALITY','SHORTAGE','LATE')),
 CHECK(status IN ('APPLIED','APPROVED','REJECTED','REFUNDING','COMPLETED','CANCELED')),
 CHECK(requested_amount>0 AND approved_amount>=0 AND approved_amount<=requested_amount),
 CHECK(version>=0), CHECK(reviewer_id IS NULL OR reviewer_id<>member_id),
 CHECK(assignee_id IS NULL OR assignee_id<>member_id)
);
CREATE INDEX idx_aftersale_member ON fm_aftersale(member_id,applied_at);
CREATE INDEX idx_aftersale_queue ON fm_aftersale(assignee_id,status,applied_at);
CREATE INDEX idx_aftersale_order ON fm_aftersale(order_id,assignee_id);
CREATE TABLE fm_aftersale_line (
 aftersale_id VARCHAR(64) NOT NULL, order_item_id VARCHAR(64) NOT NULL,
 quantity BIGINT NOT NULL, requested_amount BIGINT NOT NULL,
 approved_amount BIGINT NOT NULL DEFAULT 0, refunded_amount BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(aftersale_id,order_item_id), FOREIGN KEY(aftersale_id) REFERENCES fm_aftersale(aftersale_id),
 CHECK(quantity>0 AND requested_amount>0 AND approved_amount>=0 AND approved_amount<=requested_amount),
 CHECK(refunded_amount>=0 AND refunded_amount<=approved_amount)
);
-- One in-progress aftersale per order item, also enforced across concurrent application transactions.
CREATE TABLE fm_aftersale_active_line (
 order_item_id VARCHAR(64) PRIMARY KEY, aftersale_id VARCHAR(64) NOT NULL,
 FOREIGN KEY(aftersale_id) REFERENCES fm_aftersale(aftersale_id)
);
CREATE INDEX idx_aftersale_active_case ON fm_aftersale_active_line(aftersale_id);
