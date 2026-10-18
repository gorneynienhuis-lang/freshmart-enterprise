package com.freshmart.checkout;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Public projections and internal database rows are separate; never expose rows directly. */
public final class CheckoutModels {
 private CheckoutModels() {}
 public static final long MAX=9007199254740991L;
 public record AddressInput(@NotBlank @Size(max=60) String recipientName,@NotBlank @Pattern(regexp="^1[3-9][0-9]{9}$") String phone,@NotBlank @Size(max=30) String province,@NotBlank @Size(max=30) String city,@NotBlank @Size(max=30) String district,@NotBlank @Size(max=200) String detail,@NotNull Boolean isDefault) {}
 public record AddressUpdateRequest(@NotBlank @Size(max=60) String recipientName,@NotBlank @Pattern(regexp="^1[3-9][0-9]{9}$") String phone,@NotBlank @Size(max=30) String province,@NotBlank @Size(max=30) String city,@NotBlank @Size(max=30) String district,@NotBlank @Size(max=200) String detail,@NotNull Boolean isDefault,@NotNull @Min(0) @Max(MAX) Long version) {
  public AddressInput input(){return new AddressInput(recipientName,phone,province,city,district,detail,isDefault);}
 }
 public record AddressView(String addressId,String recipientName,String phone,String province,String city,String district,String detail,boolean isDefault,boolean serviceable,long version) {}
 public record VersionRequest(@NotNull @Min(0) @Max(MAX) Long version) {}
 public record CartAddRequest(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String skuId,@NotNull @Min(1) @Max(MAX) Long quantity,@NotNull Boolean selected) {}
 public record CartUpdateRequest(@NotNull @Min(1) @Max(MAX) Long quantity,@NotNull Boolean selected,@NotNull @Min(0) @Max(MAX) Long version) {}
 public record CartItemView(String cartItemId,String skuId,String productId,String productName,String unitLabel,String baseUnit,long quantity,long unitPrice,long lineAmount,boolean selected,String stockStatus,String imageUrl,long version) {}
 public record CartView(List<CartItemView> items,long selectedItemCount,long estimatedGoodsAmount,long version) {}
 public record SlotView(String slotId,String date,String label,String startAt,String endAt,String cutoffAt,long remaining,boolean available,String unavailableReason,long version) {}
 public record CouponView(String couponId,String name,long discountAmount,long minGoodsAmount,String status,String expiresAt,long version) {}
 public record PurchaseItem(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String skuId,@NotNull @Min(1) @Max(MAX) Long quantity) {}
 public record QuoteRequest(@NotNull @Size(min=1,max=100) List<@Valid PurchaseItem> items,@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String addressId,@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String slotId,@Pattern(regexp="[A-Za-z0-9_-]{1,64}") String couponId) {}
 public record QuoteLineView(String skuId,String productId,String productName,String baseUnit,String priceMode,long quantity,Long estimatedGram,Long priceUnitGram,long unitPrice,long couponAllocationAmount,long linePayableAmount,long referenceUnitPrice,long memberUnitPrice,Long nearExpiryUnitPrice) {}
 public record PriceSummary(long referenceGoodsAmount,long memberGoodsAmount,long nearExpiryDiscountAmount,long couponDiscountAmount,long goodsPayableAmount,long freightAmount,long payableAmount,long freeShippingThresholdAmount,long freeShippingGapAmount) {}
 public record QuoteView(String quoteId,String quoteToken,String expiresAt,List<QuoteLineView> lines,PriceSummary price,SlotView slot,AddressView address,long version) {}
 public record CommandResult(boolean accepted,String resourceId,long version,String message) {}
 public record AddressRow(String addressId,String userId,String recipientName,String phone,String province,String city,String district,String detail,boolean isDefault,boolean serviceable,boolean deleted,long version,Instant createdAt,Instant updatedAt) {}
 public record CartRow(String userId,long version) {}
 public record CartItemRow(String cartItemId,String userId,String skuId,long quantity,boolean selected,long version) {}
 public record SlotRow(String slotId,LocalDate slotDate,String label,Instant startAt,Instant endAt,Instant cutoffAt,long capacity,long used,boolean enabled,long version) {}
 public record CampaignRow(String campaignId,String name,long discountAmount,long minGoodsAmount,int validityDays,boolean enabled,long version) {}
 public record CouponRow(String couponId,String userId,String campaignId,String name,long discountAmount,long minGoodsAmount,String status,Instant expiresAt,String lockedOrderId,long version,Instant createdAt) {}
 public record SkuRow(String skuId,String productId,String productName,String unitLabel,String baseUnit,String priceMode,Long priceUnitGram,long price,long memberPrice,String imageUrl,String status,String productStatus,boolean categoryEnabled,long version,long estimatedGramPerUnit) {}
 public record BatchRow(String batchId,String skuId,long onHand,long reserved,long quarantined,Instant expiresAt,long version) {public long available(){return onHand-reserved-quarantined;}}
 public record QuoteRow(String quoteId,String userId,String tokenHash,String addressId,long addressVersion,String slotId,String couponId,Long couponVersion,String status,Instant expiresAt,long version,String snapshotJson,String policyFingerprint,Instant createdAt) {}
 public record QuoteLineRow(String quoteId,String skuId,String productId,String productName,String baseUnit,String priceMode,long quantity,Long estimatedGram,Long priceUnitGram,long unitPrice,long referenceUnitPrice,long memberUnitPrice,Long nearExpiryUnitPrice,long couponAllocationAmount,long linePayableAmount,long skuVersion,boolean nearExpiryOnly,Instant nearExpiryCutoffAt) {}
 public record QuoteSnapshot(QuoteRow row,QuoteView view,List<QuoteLineRow> lines) {}
}
