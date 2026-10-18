-- Checkout stores authoritative address/cart/coupon/slot and immutable five-minute quote snapshots.
-- quantity is always the SKU base unit; this column only suggests a UI increment.
ALTER TABLE fm_sku ADD COLUMN estimated_gram_per_unit BIGINT NOT NULL DEFAULT 500;
ALTER TABLE fm_sku ADD CONSTRAINT ck_sku_estimate CHECK (estimated_gram_per_unit > 0 AND estimated_gram_per_unit <= 9007199254740991);
CREATE TABLE fm_address (
 address_id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL,
 recipient_name VARCHAR(60) NOT NULL, phone VARCHAR(20) NOT NULL,
 province VARCHAR(30) NOT NULL, city VARCHAR(30) NOT NULL, district VARCHAR(30) NOT NULL,
 detail VARCHAR(200) NOT NULL, is_default BOOLEAN NOT NULL DEFAULT FALSE,
 serviceable BOOLEAN NOT NULL, deleted BOOLEAN NOT NULL DEFAULT FALSE,
 version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES fm_user(user_id), CHECK(version >= 0)
);
CREATE INDEX idx_address_owner ON fm_address(user_id,deleted,is_default);
CREATE TABLE fm_cart (
 user_id VARCHAR(64) PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(user_id) REFERENCES fm_user(user_id), CHECK(version >= 0)
);
CREATE TABLE fm_cart_item (
 cart_item_id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, sku_id VARCHAR(64) NOT NULL,
 quantity BIGINT NOT NULL, selected BOOLEAN NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 UNIQUE(user_id,sku_id), FOREIGN KEY(user_id) REFERENCES fm_cart(user_id), FOREIGN KEY(sku_id) REFERENCES fm_sku(sku_id),
 CHECK(quantity > 0 AND quantity <= 9007199254740991), CHECK(version >= 0)
);
CREATE TABLE fm_delivery_slot (
 slot_id VARCHAR(64) PRIMARY KEY, slot_date DATE NOT NULL, label VARCHAR(40) NOT NULL,
 start_at TIMESTAMP(6) NOT NULL, end_at TIMESTAMP(6) NOT NULL, cutoff_at TIMESTAMP(6) NOT NULL,
 capacity BIGINT NOT NULL DEFAULT 30, used BIGINT NOT NULL DEFAULT 0,
 enabled BOOLEAN NOT NULL DEFAULT TRUE, version BIGINT NOT NULL DEFAULT 0,
 UNIQUE(start_at,end_at), CHECK(capacity >= 0 AND used >= 0 AND used <= capacity),
 CHECK(start_at < end_at AND cutoff_at <= start_at), CHECK(version >= 0)
);
CREATE TABLE fm_coupon_campaign (
 campaign_id VARCHAR(64) PRIMARY KEY, name VARCHAR(60) NOT NULL,
 discount_amount BIGINT NOT NULL, min_goods_amount BIGINT NOT NULL, validity_days INT NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT FALSE, version BIGINT NOT NULL DEFAULT 0,
 CHECK(discount_amount > 0 AND min_goods_amount >= 0 AND validity_days > 0), CHECK(version >= 0)
);
-- Disabled until the environment explicitly enables its demo campaign.
INSERT INTO fm_coupon_campaign(campaign_id,name,discount_amount,min_goods_amount,validity_days,enabled,version)
 VALUES('NEW_MEMBER_V1','新人券',500,3000,14,FALSE,0);
CREATE TABLE fm_coupon (
 coupon_id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, campaign_id VARCHAR(64) NOT NULL,
 name VARCHAR(60) NOT NULL, discount_amount BIGINT NOT NULL, min_goods_amount BIGINT NOT NULL,
 status VARCHAR(16) NOT NULL, expires_at TIMESTAMP(6) NOT NULL, locked_order_id VARCHAR(64),
 version BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMP(6) NOT NULL,
 UNIQUE(user_id,campaign_id), FOREIGN KEY(user_id) REFERENCES fm_user(user_id),
 FOREIGN KEY(campaign_id) REFERENCES fm_coupon_campaign(campaign_id),
 CHECK(discount_amount > 0 AND min_goods_amount >= 0), CHECK(version >= 0),
 CHECK(status IN ('AVAILABLE','LOCKED','USED','EXPIRED'))
);
CREATE INDEX idx_coupon_owner ON fm_coupon(user_id,status);
CREATE TABLE fm_checkout_quote (
 quote_id VARCHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL, token_hash CHAR(64) NOT NULL,
 address_id VARCHAR(64) NOT NULL, address_version BIGINT NOT NULL, slot_id VARCHAR(64) NOT NULL,
 coupon_id VARCHAR(64), coupon_version BIGINT, status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
 expires_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL DEFAULT 0,
 snapshot_json TEXT NOT NULL, policy_fingerprint CHAR(64) NOT NULL, created_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES fm_user(user_id), FOREIGN KEY(address_id) REFERENCES fm_address(address_id),
 FOREIGN KEY(slot_id) REFERENCES fm_delivery_slot(slot_id), FOREIGN KEY(coupon_id) REFERENCES fm_coupon(coupon_id),
 CHECK(status IN ('OPEN','CONSUMED')), CHECK(version >= 0)
);
CREATE INDEX idx_quote_expiry ON fm_checkout_quote(expires_at,status);
CREATE TABLE fm_checkout_quote_line (
 quote_id VARCHAR(64) NOT NULL, sku_id VARCHAR(64) NOT NULL, product_id VARCHAR(64) NOT NULL,
 product_name VARCHAR(120) NOT NULL, base_unit VARCHAR(10) NOT NULL, price_mode VARCHAR(16) NOT NULL,
 quantity BIGINT NOT NULL, estimated_gram BIGINT, price_unit_gram BIGINT,
 unit_price BIGINT NOT NULL, reference_unit_price BIGINT NOT NULL, member_unit_price BIGINT NOT NULL,
 near_expiry_unit_price BIGINT, coupon_allocation_amount BIGINT NOT NULL, line_payable_amount BIGINT NOT NULL,
 sku_version BIGINT NOT NULL, near_expiry_only BOOLEAN NOT NULL, near_expiry_cutoff_at TIMESTAMP(6) NOT NULL,
 PRIMARY KEY(quote_id,sku_id), FOREIGN KEY(quote_id) REFERENCES fm_checkout_quote(quote_id),
 CHECK(quantity > 0 AND unit_price >= 0 AND coupon_allocation_amount >= 0 AND line_payable_amount >= 0)
);
