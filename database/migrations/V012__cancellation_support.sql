-- Explicit member-initiated cancellation assistance; no store-wide SERVICE order access.
CREATE TABLE fm_support_assignment_guard (
 guard_id VARCHAR(32) PRIMARY KEY
);
INSERT INTO fm_support_assignment_guard(guard_id) VALUES('cancellation-support');

CREATE TABLE fm_cancellation_request (
 request_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL,
 active_order_id VARCHAR(64) UNIQUE,
 member_id VARCHAR(64) NOT NULL,
 assignee_id VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 requested_at TIMESTAMP(6) NOT NULL,
 resolved_at TIMESTAMP(6),
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id),
 FOREIGN KEY(member_id) REFERENCES fm_user(user_id),
 FOREIGN KEY(assignee_id) REFERENCES fm_user(user_id),
 CONSTRAINT ck_cancellation_support_status CHECK(status IN ('OPEN','RESOLVED')),
 CONSTRAINT ck_cancellation_support_independent CHECK(member_id<>assignee_id),
 CONSTRAINT ck_cancellation_support_active CHECK(
  (status='OPEN' AND active_order_id IS NOT NULL AND active_order_id=order_id AND resolved_at IS NULL)
  OR (status='RESOLVED' AND active_order_id IS NULL AND resolved_at IS NOT NULL)
 )
);
CREATE INDEX idx_cancellation_support_assignee ON fm_cancellation_request(assignee_id,status,requested_at);
CREATE INDEX idx_cancellation_support_order ON fm_cancellation_request(order_id,requested_at,request_id);
