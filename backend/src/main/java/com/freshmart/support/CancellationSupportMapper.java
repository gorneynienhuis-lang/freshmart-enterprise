package com.freshmart.support;

import org.apache.ibatis.annotations.*;
import java.time.Instant;
import static com.freshmart.support.CancellationSupportModels.*;

@Mapper
public interface CancellationSupportMapper {
 @Select("SELECT guard_id FROM fm_support_assignment_guard WHERE guard_id='cancellation-support' FOR UPDATE") String lockAssignments();
 @Select("SELECT * FROM fm_cancellation_request WHERE active_order_id=#{order} AND status='OPEN' FOR UPDATE") RequestRow lockOpen(String order);
 @Select("SELECT * FROM fm_cancellation_request WHERE order_id=#{order} ORDER BY requested_at DESC,request_id DESC LIMIT 1") RequestRow latest(String order);
 @Select("SELECT u.user_id FROM fm_user u JOIN fm_user_role r ON r.user_id=u.user_id WHERE u.status='ACTIVE' AND r.role_code='SERVICE' AND u.user_id<>#{buyer} ORDER BY ((SELECT COUNT(*) FROM fm_cancellation_request c WHERE c.assignee_id=u.user_id AND c.status='OPEN')+(SELECT COUNT(*) FROM fm_delivery_exception e WHERE e.assignee_id=u.user_id AND e.status='OPEN')+(SELECT COUNT(*) FROM fm_aftersale a WHERE a.assignee_id=u.user_id AND a.status='APPLIED')),u.user_id LIMIT 1")
 String chooseSupport(String buyer);
 @Insert("INSERT INTO fm_cancellation_request(request_id,order_id,active_order_id,member_id,assignee_id,status,reason,requested_at) VALUES(#{requestId},#{orderId},#{activeOrderId},#{memberId},#{assigneeId},#{status},#{reason},#{requestedAt})") void insert(RequestRow row);
 @Update("UPDATE fm_cancellation_request SET status='RESOLVED',active_order_id=NULL,resolved_at=#{now} WHERE request_id=#{id} AND status='OPEN'") int resolve(@Param("id")String id,@Param("now")Instant now);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{id},#{actor},#{operation},'CANCELLATION_REQUEST',#{requestId},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{trace},#{now},#{roles},'SUCCESS')")
 void audit(@Param("id")String id,@Param("actor")String actor,@Param("roles")String roles,@Param("operation")String operation,@Param("requestId")String requestId,@Param("reason")String reason,@Param("trace")String trace,@Param("now")Instant now);
}
