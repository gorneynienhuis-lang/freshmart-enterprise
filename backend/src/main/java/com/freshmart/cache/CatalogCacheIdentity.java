package com.freshmart.cache;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** The database URL and signing secret never appear in Redis keys or metric labels. */
public final class CatalogCacheIdentity {
    private CatalogCacheIdentity() {}

    public static String namespace(String secret, String databaseUrl, String publicOrigin) {
        if (secret == null || secret.isBlank() || databaseUrl == null || databaseUrl.isBlank()
                || publicOrigin == null || publicOrigin.isBlank()) {
            throw new IllegalArgumentException("Catalog cache identity requires configured application identity");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(("freshmart:catalog-cache:v1\n" + databaseUrl + "\n" + publicOrigin)
                    .getBytes(StandardCharsets.UTF_8));
            return "freshmall:cache:v1:" + HexFormat.of().formatHex(digest);
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException("Catalog cache identity is unavailable", error);
        }
    }
}
