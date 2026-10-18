package com.freshmart.aftersale;
import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;
import com.freshmart.commerce.CommerceModels.RefundRow;
import static com.freshmart.aftersale.AfterSaleModels.*;
@Mapper
public interface AfterSaleMapper {
 @Select("SELECT * FROM fm_aftersale WHERE aftersale_id=#{id}") CaseRow find(String id);
 @Select("SELECT * FROM fm_aftersale WHERE aftersale_id=#{id} FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) CaseRow lock(String id);
 @Select("SELECT * FROM fm_aftersale_line WHERE aftersale_id=#{id} ORDER BY order_item_id") List<LineRow> lines(String id);
 @Select("SELECT * FROM fm_aftersale_line WHERE aftersale_id=#{id} ORDER BY order_item_id FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) List<LineRow> lockRefundLines(String id);
 @Insert("INSERT INTO fm_aftersale_evidence(aftersale_id,media_id) VALUES(#{aftersale},#{media})") void addEvidence(@Param("aftersale")String aftersale,@Param("media")String media);
 @Select("SELECT media_id FROM fm_aftersale_evidence WHERE aftersale_id=#{id} ORDER BY media_id") List<String> evidence(String id);
 @Select("SELECT COUNT(*) FROM fm_aftersale_active_line WHERE order_item_id=#{id}") long activeCount(String id);
 @Select("SELECT COALESCE(SUM(l.approved_amount),0) FROM fm_aftersale_line l JOIN fm_aftersale a ON a.aftersale_id=l.aftersale_id WHERE l.order_item_id=#{item} AND a.status IN ('APPROVED','REFUNDING','COMPLETED') AND a.aftersale_id<>#{exclude}") long reservedForItem(@Param("item") String item,@Param("exclude") String exclude);
 @Select("SELECT COALESCE(SUM(picked_quantity),0) FROM fm_order_allocation WHERE order_id=#{order} AND order_item_id=#{item}") long pickedQuantity(@Param("order") String order,@Param("item") String item);
 String CASE_FILTER="<choose><when test='admin'>member_id&lt;&gt;#{actor} AND ((assignee_id IS NULL AND status='APPLIED') OR assignee_id=#{actor})</when><otherwise>member_id=#{actor}</otherwise></choose><if test='status!=null'> AND status=#{status}</if>";
 @Select("<script>SELECT * FROM fm_aftersale WHERE "+CASE_FILTER+" ORDER BY applied_at DESC,aftersale_id LIMIT #{size} OFFSET #{offset}</script>") List<CaseRow> cases(@Param("actor") String actor,@Param("admin") boolean admin,@Param("status") String status,@Param("size") int size,@Param("offset") long offset);
 @Select("<script>SELECT COUNT(*) FROM fm_aftersale WHERE "+CASE_FILTER+"</script>") long countCases(@Param("actor") String actor,@Param("admin") boolean admin,@Param("status") String status);
 @Insert("INSERT INTO fm_aftersale(aftersale_id,order_id,member_id,case_type,reason,status,requested_amount,approved_amount,assignee_id,reviewer_id,review_comment,applied_at,updated_at,version) VALUES(#{aftersaleId},#{orderId},#{memberId},#{caseType},#{reason},#{status},#{requestedAmount},#{approvedAmount},#{assigneeId},#{reviewerId},#{reviewComment},#{appliedAt},#{updatedAt},#{version})") void insertCase(CaseRow row);
 @Update("UPDATE fm_aftersale SET status=#{status},approved_amount=#{approvedAmount},assignee_id=#{assigneeId},reviewer_id=#{reviewerId},review_comment=#{reviewComment},updated_at=#{updatedAt},version=#{version} WHERE aftersale_id=#{aftersaleId}") void updateCase(CaseRow row);
 @Insert("INSERT INTO fm_aftersale_line(aftersale_id,order_item_id,quantity,requested_amount,approved_amount,refunded_amount) VALUES(#{aftersaleId},#{orderItemId},#{quantity},#{requestedAmount},0,0)") void insertLine(LineRow row);
 @Update("UPDATE fm_aftersale_line SET approved_amount=#{approvedAmount},refunded_amount=#{refundedAmount} WHERE aftersale_id=#{aftersaleId} AND order_item_id=#{orderItemId}") void updateLine(LineRow row);
 @Insert("INSERT INTO fm_aftersale_active_line(order_item_id,aftersale_id) VALUES(#{item},#{id})") void activate(@Param("item") String item,@Param("id") String id);
 @Delete("DELETE FROM fm_aftersale_active_line WHERE aftersale_id=#{id}") void release(String id);
 @Select("SELECT * FROM fm_refund WHERE aftersale_id=#{id} ORDER BY refund_id") List<RefundRow> caseRefunds(String id);
 @Select("SELECT * FROM fm_refund WHERE aftersale_id=#{id} ORDER BY refund_id FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) List<RefundRow> lockCaseRefunds(String id);
 String REFUND_FILTER="1=1 <if test='status!=null'>AND status=#{status}</if><if test='order!=null'>AND order_id=#{order}</if>";
 @Select("<script>SELECT * FROM fm_refund WHERE "+REFUND_FILTER+" ORDER BY created_at DESC,refund_id LIMIT #{size} OFFSET #{offset}</script>") List<RefundRow> refunds(@Param("status") String status,@Param("order") String order,@Param("size") int size,@Param("offset") long offset);
 @Select("<script>SELECT COUNT(*) FROM fm_refund WHERE "+REFUND_FILTER+"</script>") long countRefunds(@Param("status") String status,@Param("order") String order);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{event},#{actor},#{operation},'AFTERSALE',#{resource},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{trace},#{now},#{roles},#{outcome})") void audit(@Param("event") String event,@Param("actor") String actor,@Param("operation") String operation,@Param("resource") String resource,@Param("reason") String reason,@Param("trace") String trace,@Param("now") Instant now,@Param("roles")String roles,@Param("outcome")String outcome);
}
