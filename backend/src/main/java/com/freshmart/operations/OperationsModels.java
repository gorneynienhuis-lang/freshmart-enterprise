package com.freshmart.operations;

import com.freshmart.catalog.CatalogService.SkuView;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class OperationsModels {
 private OperationsModels() {}
 public static final long MAX=9007199254740991L;
 public record ProductWrite(@NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]+") String categoryId,
  @NotBlank @Size(max=120) String name,@NotBlank @Size(max=4000) String description,@NotBlank @Size(max=100) String origin,
  @NotBlank @Pattern(regexp="AMBIENT|COLD|FROZEN|LIVE") String storage,@NotBlank @Size(max=2048) String imageUrl) {}
 public record ProductStatus(@NotBlank @Pattern(regexp="ON_SALE|OFF_SALE") String status,@NotNull @Min(0) @Max(MAX) Long version) {}
 public record SkuWrite(@NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]+") String skuCode,
  @NotBlank @Size(max=120) String name,@NotBlank @Size(max=60) String unitLabel,
  @NotBlank @Pattern(regexp="PIECE|GRAM") String baseUnit,@NotBlank @Pattern(regexp="BY_PIECE|BY_WEIGHT") String priceMode,
  @JsonProperty(required=true) @Min(1) @Max(MAX) Long priceUnitGram,@NotNull @Min(0) @Max(MAX) Long price,
  @NotNull @Min(0) @Max(MAX) Long memberPrice,@NotBlank @Size(max=2048) String imageUrl) {}
 public record BatchCreate(@NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]+") String batchNo,
  @NotBlank @Size(max=64) @Pattern(regexp="[A-Za-z0-9_-]+") String skuId,@NotNull @Min(1) @Max(MAX) Long receivedQuantity,
  @NotNull Instant producedAt,@NotNull Instant expiresAt,@NotBlank @Size(max=500) String reason) {}
 public record Adjustment(@NotNull @Min(-MAX) @Max(MAX) Long quantityDelta,
  @NotBlank @Pattern(regexp="COUNT_CORRECTION|DAMAGE|EXPIRED_DISPOSAL") String reasonCode,
  @NotBlank @Size(max=500) String reason,@NotNull @Min(0) @Max(MAX) Long version) {}
 public record Lifecycle(@NotBlank @Pattern(regexp="NORMAL|QUARANTINED|DISPOSED") String lifecycle,
  @NotBlank @Size(max=500) String reason,@NotNull @Min(0) @Max(MAX) Long version) {}
 public record SlotUpdate(@NotNull @Min(1) @Max(500) Long capacity,@NotNull Instant cutoffAt,@NotNull Boolean enabled,
  @NotNull @Min(0) @Max(MAX) Long version) {}
 public record Policies(@NotNull @Min(0) @Max(MAX) Long freightAmount,@NotNull @Min(0) @Max(MAX) Long freeShippingThresholdAmount,
  @NotNull @Min(1) @Max(30) Integer nearExpiryDays,@NotNull @Min(1) @Max(10000) Integer nearExpiryDiscountBasisPoints,
  @NotNull @Min(0) @Max(MAX) Long newcomerCouponAmount,@NotNull @Min(0) @Max(MAX) Long newcomerCouponMinGoodsAmount,
  @NotNull @Min(0) @Max(MAX) Long version) {}
 public record AdminProduct(String productId,String spuCode,String categoryId,String name,String description,String origin,
  String storage,String imageUrl,long price,long memberPrice,long salePrice,String priceMode,String unitLabel,String stockStatus,
  boolean nearExpiry,List<SkuView> skus,long version,String status,String arrivedAt,String freshness,Long shelfLifeRemainingDays) {}
 public record Batch(String batchId,String batchNo,String skuId,String baseUnit,long onHand,long reserved,long quarantined,
  long available,String lifecycle,String freshness,String producedAt,String expiresAt,String receivedAt,long version) {}
 public record BatchRow(String batchId,String batchNo,String skuId,String baseUnit,long onHand,long reserved,long quarantined,
  String lifecycle,Instant producedAt,Instant expiresAt,Instant receivedAt,long version) {}
 public record Movement(String movementId,String batchId,String skuId,String orderId,String type,long onHandDelta,
  long reservedDelta,long quarantinedDelta,String reason,String actorId,String createdAt) {}
}
