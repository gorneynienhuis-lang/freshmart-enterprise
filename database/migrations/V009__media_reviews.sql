-- Sanitized raster originals remain outside the web root. Only explicit public scopes are downloadable anonymously.
CREATE TABLE fm_media (
 media_id VARCHAR(64) PRIMARY KEY, owner_id VARCHAR(64) NOT NULL,
 order_id VARCHAR(64), product_id VARCHAR(64), purpose VARCHAR(16) NOT NULL,
 mime_type VARCHAR(40) NOT NULL, size_bytes BIGINT NOT NULL, width_px INT NOT NULL, height_px INT NOT NULL,
 content_sha256 CHAR(64) NOT NULL, storage_key VARCHAR(160) NOT NULL UNIQUE,
 public_key VARCHAR(160) UNIQUE, status VARCHAR(16) NOT NULL, created_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(owner_id) REFERENCES fm_user(user_id), FOREIGN KEY(order_id) REFERENCES fm_order(order_id),
 FOREIGN KEY(product_id) REFERENCES fm_product(product_id),
 CHECK(purpose IN ('AFTERSALE','REVIEW','PRODUCT')), CHECK(status IN ('READY','REJECTED')),
 CHECK(size_bytes>0 AND size_bytes<=6291456), CHECK(width_px>0 AND height_px>0),
 CHECK((purpose='PRODUCT' AND order_id IS NULL) OR (purpose IN ('AFTERSALE','REVIEW') AND order_id IS NOT NULL))
);
CREATE INDEX idx_media_owner_order ON fm_media(owner_id,order_id,purpose,created_at);
CREATE TABLE fm_aftersale_evidence (
 aftersale_id VARCHAR(64) NOT NULL, media_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(aftersale_id,media_id), FOREIGN KEY(aftersale_id) REFERENCES fm_aftersale(aftersale_id),
 FOREIGN KEY(media_id) REFERENCES fm_media(media_id)
);
CREATE INDEX idx_aftersale_evidence_media ON fm_aftersale_evidence(media_id,aftersale_id);
CREATE TABLE fm_review (
 review_id VARCHAR(64) PRIMARY KEY, order_item_id VARCHAR(64) NOT NULL UNIQUE,
 order_id VARCHAR(64) NOT NULL, product_id VARCHAR(64) NOT NULL, member_id VARCHAR(64) NOT NULL,
 rating INT NOT NULL, content VARCHAR(1000) NOT NULL, anonymous BOOLEAN NOT NULL,
 display_name VARCHAR(60) NOT NULL, created_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES fm_order(order_id), FOREIGN KEY(product_id) REFERENCES fm_product(product_id),
 FOREIGN KEY(member_id) REFERENCES fm_user(user_id), CHECK(rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_review_product ON fm_review(product_id,created_at,review_id);
CREATE TABLE fm_review_media (
 review_id VARCHAR(64) NOT NULL, media_id VARCHAR(64) NOT NULL UNIQUE,
 PRIMARY KEY(review_id,media_id), FOREIGN KEY(review_id) REFERENCES fm_review(review_id),
 FOREIGN KEY(media_id) REFERENCES fm_media(media_id)
);
