package com.freshmart.checkout;

import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import static com.freshmart.checkout.CheckoutModels.*;

@Mapper
public interface CheckoutMapper {
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select("SELECT user_id FROM fm_user WHERE user_id=#{userId} FOR UPDATE") String lockUser(String userId);
 @Select("SELECT * FROM fm_address WHERE user_id=#{userId} AND deleted=FALSE ORDER BY is_default DESC,created_at,address_id") List<AddressRow> addresses(String userId);
 @Select("SELECT * FROM fm_address WHERE address_id=#{id} AND user_id=#{user} AND deleted=FALSE") AddressRow address(@Param("id") String id,@Param("user") String user);
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select("SELECT * FROM fm_address WHERE address_id=#{id} AND user_id=#{user} AND deleted=FALSE FOR UPDATE") AddressRow lockAddress(@Param("id") String id,@Param("user") String user);
 @Insert("INSERT INTO fm_address(address_id,user_id,recipient_name,phone,province,city,district,detail,is_default,serviceable,deleted,version,created_at,updated_at) VALUES(#{addressId},#{userId},#{recipientName},#{phone},#{province},#{city},#{district},#{detail},#{isDefault},#{serviceable},FALSE,#{version},#{createdAt},#{updatedAt})") void insertAddress(AddressRow row);
 @Update("UPDATE fm_address SET is_default=FALSE,version=version+1,updated_at=#{now} WHERE user_id=#{user} AND is_default=TRUE AND deleted=FALSE AND address_id<>#{except}") void clearDefault(@Param("user") String user,@Param("except") String except,@Param("now") Instant now);
 @Update("UPDATE fm_address SET recipient_name=#{recipientName},phone=#{phone},province=#{province},city=#{city},district=#{district},detail=#{detail},is_default=#{isDefault},serviceable=#{serviceable},version=version+1,updated_at=#{updatedAt} WHERE address_id=#{addressId} AND user_id=#{userId} AND version=#{version} AND deleted=FALSE") int updateAddress(AddressRow row);
 @Update("UPDATE fm_address SET deleted=TRUE,is_default=FALSE,version=version+1,updated_at=#{now} WHERE address_id=#{id} AND user_id=#{user} AND version=#{version} AND deleted=FALSE") int deleteAddress(@Param("id") String id,@Param("user") String user,@Param("version") long version,@Param("now") Instant now);
 @Update("UPDATE fm_address SET is_default=TRUE,version=version+1,updated_at=#{now} WHERE address_id=#{id} AND user_id=#{user} AND deleted=FALSE") void makeDefault(@Param("id") String id,@Param("user") String user,@Param("now") Instant now);
 @Insert("INSERT INTO fm_cart(user_id,version) VALUES(#{user},0) ON DUPLICATE KEY UPDATE user_id=user_id") void ensureCart(String user);
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select("SELECT * FROM fm_cart WHERE user_id=#{user} FOR UPDATE") CartRow lockCart(String user);
 @Select("SELECT * FROM fm_cart WHERE user_id=#{user}") CartRow cart(String user);
 @Update("UPDATE fm_cart SET version=version+1 WHERE user_id=#{user}") void bumpCart(String user);
 @Select("SELECT * FROM fm_cart_item WHERE user_id=#{user} ORDER BY sku_id") List<CartItemRow> cartItems(String user);
 @Select("SELECT * FROM fm_cart_item WHERE cart_item_id=#{id} AND user_id=#{user}") CartItemRow cartItem(@Param("id") String id,@Param("user") String user);
 @Select("SELECT * FROM fm_cart_item WHERE sku_id=#{sku} AND user_id=#{user}") CartItemRow cartSku(@Param("sku") String sku,@Param("user") String user);
 @Insert("INSERT INTO fm_cart_item(cart_item_id,user_id,sku_id,quantity,selected,version) VALUES(#{cartItemId},#{userId},#{skuId},#{quantity},#{selected},#{version})") void insertCartItem(CartItemRow row);
 @Update("UPDATE fm_cart_item SET quantity=#{quantity},selected=#{selected},version=version+1 WHERE cart_item_id=#{cartItemId} AND user_id=#{userId} AND version=#{version}") int updateCartItem(CartItemRow row);
 @Delete("DELETE FROM fm_cart_item WHERE cart_item_id=#{id} AND user_id=#{user} AND version=#{version}") int deleteCartItem(@Param("id") String id,@Param("user") String user,@Param("version") long version);
 String SKU_SQL="SELECT s.sku_id,s.product_id,p.name AS product_name,s.unit_label,s.base_unit,s.price_mode,s.price_unit_gram,s.price,s.member_price,s.image_url,s.status,p.status AS product_status,c.enabled AS category_enabled,s.version,s.estimated_gram_per_unit FROM fm_sku s JOIN fm_product p ON p.product_id=s.product_id JOIN fm_category c ON c.category_id=p.category_id WHERE s.sku_id=#{id}";
 @Select(SKU_SQL) SkuRow sku(String id);
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select(SKU_SQL+" FOR UPDATE") SkuRow lockSku(String id);
 @Select("<script>SELECT batch_id,sku_id,on_hand,reserved,quarantined,expires_at,version FROM fm_inventory_batch WHERE sku_id=#{sku} AND lifecycle_status='NORMAL' AND expires_at&gt;#{end} AND received_at&lt;=#{now} AND on_hand-reserved-quarantined&gt;0 <if test='nearOnly'>AND expires_at&lt;=#{nearAt}</if> ORDER BY expires_at,batch_id <if test='lock'>FOR UPDATE</if></script>") List<BatchRow> availableBatchesAt(@Param("sku") String sku,@Param("end") Instant end,@Param("nearAt") Instant nearAt,@Param("nearOnly") boolean nearOnly,@Param("lock") boolean lock,@Param("now") Instant now);
 default List<BatchRow> availableBatches(String sku,Instant end,Instant nearAt,boolean nearOnly,boolean lock){return availableBatchesAt(sku,end,nearAt,nearOnly,lock,Instant.now());}
 @Select("SELECT * FROM fm_delivery_slot WHERE slot_date=#{date} ORDER BY start_at") List<SlotRow> slots(LocalDate date);
 @Select("SELECT * FROM fm_delivery_slot WHERE slot_id=#{id}") SlotRow slot(String id);
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select("SELECT * FROM fm_delivery_slot WHERE slot_id=#{id} FOR UPDATE") SlotRow lockSlot(String id);
 @Insert("INSERT INTO fm_delivery_slot(slot_id,slot_date,label,start_at,end_at,cutoff_at,capacity,used,enabled,version) VALUES(#{slotId},#{slotDate},#{label},#{startAt},#{endAt},#{cutoffAt},#{capacity},0,TRUE,0) ON DUPLICATE KEY UPDATE slot_id=slot_id") void insertSlot(SlotRow row);
 @Select("SELECT * FROM fm_coupon_campaign WHERE campaign_id='NEW_MEMBER_V1'") CampaignRow newcomerCampaign();
 @Select("SELECT * FROM fm_coupon WHERE user_id=#{user} ORDER BY expires_at,coupon_id") List<CouponRow> coupons(String user);
 @Select("SELECT * FROM fm_coupon WHERE coupon_id=#{id} AND user_id=#{user}") CouponRow coupon(@Param("id") String id,@Param("user") String user);
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select("SELECT * FROM fm_coupon WHERE coupon_id=#{id} AND user_id=#{user} FOR UPDATE") CouponRow lockCoupon(@Param("id") String id,@Param("user") String user);
 @Select("SELECT COUNT(*) FROM fm_coupon WHERE campaign_id=#{campaign} AND user_id=#{user}") long couponCount(@Param("campaign") String campaign,@Param("user") String user);
 @Insert("INSERT INTO fm_coupon(coupon_id,user_id,campaign_id,name,discount_amount,min_goods_amount,status,expires_at,locked_order_id,version,created_at) VALUES(#{couponId},#{userId},#{campaignId},#{name},#{discountAmount},#{minGoodsAmount},#{status},#{expiresAt},#{lockedOrderId},#{version},#{createdAt})") void insertCoupon(CouponRow row);
 @Insert("INSERT INTO fm_checkout_quote(quote_id,user_id,token_hash,address_id,address_version,slot_id,coupon_id,coupon_version,status,expires_at,version,snapshot_json,policy_fingerprint,created_at) VALUES(#{quoteId},#{userId},#{tokenHash},#{addressId},#{addressVersion},#{slotId},#{couponId},#{couponVersion},#{status},#{expiresAt},#{version},#{snapshotJson},#{policyFingerprint},#{createdAt})") void insertQuote(QuoteRow row);
 @Insert("INSERT INTO fm_checkout_quote_line(quote_id,sku_id,product_id,product_name,base_unit,price_mode,quantity,estimated_gram,price_unit_gram,unit_price,reference_unit_price,member_unit_price,near_expiry_unit_price,coupon_allocation_amount,line_payable_amount,sku_version,near_expiry_only,near_expiry_cutoff_at) VALUES(#{quoteId},#{skuId},#{productId},#{productName},#{baseUnit},#{priceMode},#{quantity},#{estimatedGram},#{priceUnitGram},#{unitPrice},#{referenceUnitPrice},#{memberUnitPrice},#{nearExpiryUnitPrice},#{couponAllocationAmount},#{linePayableAmount},#{skuVersion},#{nearExpiryOnly},#{nearExpiryCutoffAt})") void insertQuoteLine(QuoteLineRow row);
 @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
 @Select("SELECT * FROM fm_checkout_quote WHERE quote_id=#{id} AND user_id=#{user} FOR UPDATE") QuoteRow lockQuote(@Param("id") String id,@Param("user") String user);
 @Select("SELECT * FROM fm_checkout_quote_line WHERE quote_id=#{id} ORDER BY sku_id") List<QuoteLineRow> quoteLines(String id);
 @Update("UPDATE fm_checkout_quote SET status='CONSUMED',version=version+1 WHERE quote_id=#{id} AND status='OPEN' AND version=#{version}") int consumeQuote(@Param("id") String id,@Param("version") long version);
 @Select("SELECT role_code FROM fm_user_role WHERE user_id=#{actor} ORDER BY role_code") List<String> auditActorRoles(String actor);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,before_summary,after_summary,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{event},#{actor},#{operation},#{type},#{resource},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},NULL,NULL,#{trace},#{now},#{roles},'SUCCESS')") void audit(@Param("event") String event,@Param("actor") String actor,@Param("operation") String operation,@Param("type") String type,@Param("resource") String resource,@Param("reason") String reason,@Param("trace") String trace,@Param("now") Instant now,@Param("roles") String roles);
}
