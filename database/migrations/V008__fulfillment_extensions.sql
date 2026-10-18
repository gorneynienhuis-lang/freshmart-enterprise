-- Retire replaced reservations without deleting historical allocations or stock movements.
ALTER TABLE fm_order_allocation ADD COLUMN retired BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_allocation_active ON fm_order_allocation(order_id,retired,sku_id,batch_id);

CREATE TABLE fm_delivery_exception (
 exception_id VARCHAR(64) PRIMARY KEY,
 order_id VARCHAR(64) NOT NULL,
 task_id VARCHAR(64) NOT NULL,
 active_order_id VARCHAR(64) UNIQUE,
 type VARCHAR(32) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 courier_id VARCHAR(64) NOT NULL,
 assignee_id VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL,
 resolution_reason VARCHAR(500),
 resolved_by VARCHAR(64),
 created_at TIMESTAMP(6) NOT NULL,
 resolved_at TIMESTAMP(6),
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id),
 FOREIGN KEY(courier_id) REFERENCES fm_user(user_id),
 FOREIGN KEY(assignee_id) REFERENCES fm_user(user_id),
 FOREIGN KEY(resolved_by) REFERENCES fm_user(user_id),
 CONSTRAINT ck_delivery_exception_status CHECK(status IN ('OPEN','RESOLVED')),
 CONSTRAINT ck_delivery_exception_type CHECK(type IN ('RECIPIENT_UNREACHABLE','DAMAGED','DELAYED','OTHER')),
 CONSTRAINT ck_delivery_exception_active CHECK((status='OPEN' AND active_order_id IS NOT NULL AND active_order_id=order_id) OR (status='RESOLVED' AND active_order_id IS NULL))
);
CREATE INDEX idx_delivery_exception_assignee ON fm_delivery_exception(assignee_id,status,created_at);
CREATE INDEX idx_delivery_exception_order ON fm_delivery_exception(order_id,created_at);
