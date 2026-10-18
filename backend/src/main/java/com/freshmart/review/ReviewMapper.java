package com.freshmart.review;
import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;
@Mapper public interface ReviewMapper {
 @Select("SELECT DISTINCT order_id FROM fm_order_allocation WHERE order_item_id=#{id} LIMIT 1") String orderId(String id);
 @Select("SELECT COUNT(*) FROM fm_review WHERE order_item_id=#{id}") long exists(String id);
 @Select("SELECT display_name FROM fm_user WHERE user_id=#{id}") String displayName(String id);
 @Select("SELECT COALESCE(SUM(picked_quantity),0) FROM fm_order_allocation WHERE order_id=#{order} AND order_item_id=#{item}") long delivered(@Param("order")String order,@Param("item")String item);
 @Select("SELECT COUNT(*) FROM fm_product p JOIN fm_category c ON c.category_id=p.category_id WHERE p.product_id=#{id} AND p.status='ON_SALE' AND c.enabled=TRUE AND EXISTS(SELECT 1 FROM fm_sku s WHERE s.product_id=p.product_id AND s.status='ACTIVE')") long visibleProduct(String id);
 @Insert("INSERT INTO fm_review(review_id,order_item_id,order_id,product_id,member_id,rating,content,anonymous,display_name,created_at) VALUES(#{reviewId},#{orderItemId},#{orderId},#{productId},#{memberId},#{rating},#{content},#{anonymous},#{displayName},#{createdAt})") void insert(ReviewModels.Row row);
 @Insert("INSERT INTO fm_review_media(review_id,media_id) VALUES(#{review},#{media})") void image(@Param("review")String review,@Param("media")String media);
 @Select("SELECT COUNT(*) FROM fm_review WHERE product_id=#{id}") long count(String id);
 @Select("SELECT * FROM fm_review WHERE product_id=#{product} ORDER BY created_at DESC,review_id DESC LIMIT #{size} OFFSET #{offset}") List<ReviewModels.Row> list(@Param("product")String product,@Param("size")int size,@Param("offset")long offset);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{id},#{actor},'review.create','REVIEW',#{review},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{trace},#{now},#{roles},'SUCCESS')") void audit(@Param("id")String id,@Param("actor")String actor,@Param("review")String review,@Param("trace")String trace,@Param("now")Instant now,@Param("roles")String roles,@Param("reason")String reason);
}
