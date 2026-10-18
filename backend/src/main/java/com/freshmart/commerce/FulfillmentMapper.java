package com.freshmart.commerce;

import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;
import static com.freshmart.commerce.CommerceModels.*;

@Mapper
public interface FulfillmentMapper {
 @Select("SELECT * FROM fm_order_allocation WHERE order_id=#{order} AND retired=FALSE ORDER BY sku_id,batch_id,allocation_id FOR UPDATE") List<AllocationRow> lockAllocations(String order);
 @Update("UPDATE fm_order_allocation SET reserved_quantity=0,retired=TRUE,version=version+1 WHERE allocation_id=#{id} AND retired=FALSE AND picked_quantity=0 AND returned_quantity=0") int retireAllocation(String id);
 @Select("SELECT u.user_id FROM fm_user u JOIN fm_user_role r ON r.user_id=u.user_id WHERE u.status='ACTIVE' AND r.role_code='SERVICE' AND u.user_id != #{buyer} AND u.user_id != #{courier} ORDER BY (SELECT COUNT(*) FROM fm_delivery_exception e WHERE e.assignee_id=u.user_id AND e.status='OPEN'),u.user_id LIMIT 1")
 String chooseSupport(@Param("buyer") String buyer,@Param("courier") String courier);
 @Insert("INSERT INTO fm_delivery_exception(exception_id,order_id,task_id,active_order_id,type,reason,courier_id,assignee_id,status,created_at) VALUES(#{exceptionId},#{orderId},#{taskId},#{activeOrderId},#{type},#{reason},#{courierId},#{assigneeId},#{status},#{createdAt})") void insertException(DeliveryExceptionRow row);
 @Select("SELECT * FROM fm_delivery_exception WHERE active_order_id=#{order} AND status='OPEN' FOR UPDATE") DeliveryExceptionRow lockOpenException(String order);
 @Select("SELECT COUNT(*) FROM fm_delivery_exception e JOIN fm_order o ON o.order_id=e.order_id WHERE e.order_id=#{order} AND e.assignee_id=#{actor} AND o.user_id != #{actor}")
 int exceptionScope(@Param("order") String order,@Param("actor") String actor);
 @Update("UPDATE fm_delivery_exception SET status='RESOLVED',active_order_id=NULL,resolution_reason=#{reason},resolved_by=#{actor},resolved_at=#{now} WHERE exception_id=#{id} AND status='OPEN'")
 int resolve(@Param("id") String id,@Param("actor") String actor,@Param("reason") String reason,@Param("now") Instant now);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,before_summary,after_summary,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{id},#{actor},#{operation},#{resourceType},#{resource},#{reason},#{before},#{after},#{trace},#{now},#{roles},#{outcome})")
 void audit(@Param("id") String id,@Param("actor") String actor,@Param("operation") String operation,@Param("resourceType") String resourceType,@Param("resource") String resource,@Param("reason") String reason,@Param("before") String before,@Param("after") String after,@Param("trace") String trace,@Param("now") Instant now,@Param("roles") String roles,@Param("outcome") String outcome);
}
