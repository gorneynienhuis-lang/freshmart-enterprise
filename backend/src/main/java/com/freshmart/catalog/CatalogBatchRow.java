package com.freshmart.catalog;
import java.time.Instant;
/** Read-only projection; never serialized to customer APIs. */
public record CatalogBatchRow(String skuId,long available,Instant receivedAt,Instant expiresAt){}
