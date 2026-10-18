package com.freshmart.media;
import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;
@Mapper public interface MediaMapper {
 @Select("SELECT * FROM fm_media WHERE media_id=#{id}") MediaRow find(String id);
 @Select("SELECT * FROM fm_media WHERE media_id=#{id} FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) MediaRow lock(String id);
 @Insert("INSERT INTO fm_media(media_id,owner_id,order_id,product_id,purpose,mime_type,size_bytes,width_px,height_px,content_sha256,storage_key,public_key,status,created_at) VALUES(#{mediaId},#{ownerId},#{orderId},#{productId},#{purpose},#{mimeType},#{sizeBytes},#{widthPx},#{heightPx},#{contentSha256},#{storageKey},#{publicKey},#{status},#{createdAt})") void insert(MediaRow row);
 @Update("UPDATE fm_media SET public_key=#{key} WHERE media_id=#{id} AND public_key IS NULL") int publish(@Param("id") String id,@Param("key") String key);
 @Select("SELECT COUNT(*) FROM fm_media WHERE owner_id=#{owner} AND order_id=#{order} AND purpose=#{purpose}") long orderCount(@Param("owner") String owner,@Param("order") String order,@Param("purpose") String purpose);
 @Select("SELECT COUNT(*) FROM fm_media WHERE owner_id=#{owner} AND created_at>=#{since}") long dayCount(@Param("owner") String owner,@Param("since") Instant since);
 @Select("SELECT COUNT(*) FROM fm_product WHERE product_id=#{id}") long productCount(String id);
 @Select("SELECT COUNT(*) FROM fm_aftersale_evidence e JOIN fm_aftersale a ON a.aftersale_id=e.aftersale_id WHERE e.media_id=#{media} AND a.assignee_id=#{actor} AND a.member_id<>#{actor}") long assignedEvidence(@Param("media") String media,@Param("actor") String actor);
 @Select("SELECT COUNT(*) FROM fm_review_media WHERE media_id=#{id}") long publishedReview(String id);
 @Select("SELECT media_id FROM fm_review_media WHERE review_id=#{id} ORDER BY media_id") List<String> reviewImages(String id);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{id},#{actor},#{operation},'MEDIA',#{media},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{trace},#{now},#{roles},'SUCCESS')") void audit(@Param("id") String id,@Param("actor") String actor,@Param("operation") String operation,@Param("media") String media,@Param("reason") String reason,@Param("trace") String trace,@Param("now") Instant now,@Param("roles")String roles);
 @Select("SELECT user_id FROM fm_user WHERE user_id=#{id} FOR UPDATE") String lockOwner(String id);
}
