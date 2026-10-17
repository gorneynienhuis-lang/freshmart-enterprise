-- Portable baseline for MySQL 8.4 and isolated H2 MySQL-mode tests.
-- Production connections must use UTC; API timestamps carry an explicit offset.
CREATE TABLE fm_user (
 user_id VARCHAR(64) PRIMARY KEY,
 phone VARCHAR(20) NOT NULL UNIQUE,
 password_hash VARCHAR(100) NOT NULL,
 display_name VARCHAR(60) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
 must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
 version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP(6) NOT NULL,
 updated_at TIMESTAMP(6) NOT NULL,
 CONSTRAINT ck_user_status CHECK (status IN ('ACTIVE','DISABLED')),
 CONSTRAINT ck_user_version CHECK (version >= 0)
);
CREATE TABLE fm_user_role (
 user_id VARCHAR(64) NOT NULL,
 role_code VARCHAR(20) NOT NULL,
 PRIMARY KEY (user_id,role_code),
 FOREIGN KEY (user_id) REFERENCES fm_user(user_id),
 CONSTRAINT ck_user_role CHECK (role_code IN ('MEMBER','PICKER','COURIER','OPERATOR','SERVICE','FINANCE','ADMIN'))
);
CREATE TABLE fm_auth_session (
 session_id VARCHAR(64) PRIMARY KEY,
 family_id VARCHAR(64) NOT NULL,
 user_id VARCHAR(64) NOT NULL,
 access_hash CHAR(64) NOT NULL UNIQUE,
 refresh_hash CHAR(64) NOT NULL UNIQUE,
 status VARCHAR(16) NOT NULL,
 access_expires_at TIMESTAMP(6) NOT NULL,
 refresh_expires_at TIMESTAMP(6) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 rotated_at TIMESTAMP(6),
 FOREIGN KEY (user_id) REFERENCES fm_user(user_id),
 CONSTRAINT ck_session_status CHECK (status IN ('ACTIVE','ROTATED','REVOKED'))
);
CREATE INDEX idx_session_family ON fm_auth_session(family_id);
CREATE INDEX idx_session_user ON fm_auth_session(user_id,status);
CREATE TABLE fm_csrf_context (
 context_hash CHAR(64) PRIMARY KEY,
 token_hash CHAR(64) NOT NULL,
 expires_at TIMESTAMP(6) NOT NULL,
 created_at TIMESTAMP(6) NOT NULL
);
CREATE TABLE fm_category (
 category_id VARCHAR(64) PRIMARY KEY,
 code VARCHAR(64) NOT NULL UNIQUE,
 name VARCHAR(40) NOT NULL,
 short_name VARCHAR(20) NOT NULL,
 image_url VARCHAR(2048) NOT NULL,
 sort_order INT NOT NULL DEFAULT 0,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT ck_category_sort CHECK (sort_order >= 0)
);
CREATE TABLE fm_product (
 product_id VARCHAR(64) PRIMARY KEY,
 spu_code VARCHAR(64) NOT NULL UNIQUE,
 category_id VARCHAR(64) NOT NULL,
 name VARCHAR(120) NOT NULL,
 description VARCHAR(4000) NOT NULL,
 origin VARCHAR(100) NOT NULL,
 storage VARCHAR(16) NOT NULL,
 image_url VARCHAR(2048) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
 version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (category_id) REFERENCES fm_category(category_id),
 CONSTRAINT ck_product_status CHECK (status IN ('DRAFT','ON_SALE','OFF_SALE')),
 CONSTRAINT ck_product_storage CHECK (storage IN ('AMBIENT','COLD','FROZEN','LIVE')),
 CONSTRAINT ck_product_version CHECK (version >= 0)
);
CREATE INDEX idx_product_listing ON fm_product(status,category_id,product_id);
CREATE TABLE fm_sku (
 sku_id VARCHAR(64) PRIMARY KEY,
 sku_code VARCHAR(64) NOT NULL UNIQUE,
 product_id VARCHAR(64) NOT NULL,
 name VARCHAR(120) NOT NULL,
 unit_label VARCHAR(60) NOT NULL,
 base_unit VARCHAR(10) NOT NULL,
 price_mode VARCHAR(16) NOT NULL,
 price_unit_gram BIGINT,
 price BIGINT NOT NULL,
 member_price BIGINT NOT NULL,
 image_url VARCHAR(2048) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
 version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (product_id) REFERENCES fm_product(product_id),
 CONSTRAINT ck_sku_price CHECK (price >= 0 AND price <= 9007199254740991 AND member_price >= 0 AND member_price <= price),
 CONSTRAINT ck_sku_unit CHECK ((price_mode='BY_PIECE' AND base_unit='PIECE' AND price_unit_gram IS NULL) OR (price_mode='BY_WEIGHT' AND base_unit='GRAM' AND price_unit_gram IS NOT NULL AND price_unit_gram > 0 AND price_unit_gram <= 9007199254740991)),
 CONSTRAINT ck_sku_status CHECK (status IN ('ACTIVE','DISABLED')),
 CONSTRAINT ck_sku_version CHECK (version >= 0)
);
CREATE INDEX idx_sku_product ON fm_sku(product_id,status);
CREATE TABLE fm_inventory_batch (
 batch_id VARCHAR(64) PRIMARY KEY,
 sku_id VARCHAR(64) NOT NULL,
 batch_no VARCHAR(64) NOT NULL,
 warehouse_id VARCHAR(64) NOT NULL,
 received_at TIMESTAMP(6) NOT NULL,
 expires_at TIMESTAMP(6) NOT NULL,
 lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
 on_hand BIGINT NOT NULL,
 reserved BIGINT NOT NULL DEFAULT 0,
 quarantined BIGINT NOT NULL DEFAULT 0,
 version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (sku_id,batch_no),
 FOREIGN KEY (sku_id) REFERENCES fm_sku(sku_id),
 CONSTRAINT ck_batch_lifecycle CHECK (lifecycle_status IN ('NORMAL','QUARANTINED','DISPOSED')),
 CONSTRAINT ck_batch_quantity CHECK (on_hand >= 0 AND on_hand <= 9007199254740991 AND reserved >= 0 AND quarantined >= 0 AND reserved <= on_hand AND quarantined <= on_hand - reserved),
 CONSTRAINT ck_batch_lifecycle_balance CHECK ((lifecycle_status='NORMAL') OR (lifecycle_status='QUARANTINED' AND reserved=0 AND quarantined=on_hand) OR (lifecycle_status='DISPOSED' AND on_hand=0 AND reserved=0 AND quarantined=0)),
 CONSTRAINT ck_batch_dates CHECK (expires_at > received_at),
 CONSTRAINT ck_batch_version CHECK (version >= 0)
);
CREATE INDEX idx_batch_fefo ON fm_inventory_batch(sku_id,lifecycle_status,expires_at,batch_id);
CREATE TABLE fm_login_throttle (
 subject_hash CHAR(64) PRIMARY KEY,
 failed_count INT NOT NULL DEFAULT 0,
 window_started_at TIMESTAMP(6) NOT NULL,
 blocked_until TIMESTAMP(6),
 CONSTRAINT ck_login_failures CHECK (failed_count >= 0)
);
