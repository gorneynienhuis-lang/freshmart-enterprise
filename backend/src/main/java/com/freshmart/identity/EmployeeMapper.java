package com.freshmart.identity;

import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;

@Mapper
public interface EmployeeMapper {
 @Select("SELECT lock_id FROM fm_employee_governance_lock WHERE lock_id=1 FOR UPDATE") int lockGovernance();
 @Select("SELECT COUNT(*) FROM fm_employee") long count();
 @Select("SELECT u.* FROM fm_employee e JOIN fm_user u ON e.user_id=u.user_id ORDER BY u.created_at,u.user_id LIMIT #{size} OFFSET #{offset}") List<UserRow> list(@Param("offset") long offset,@Param("size") int size);
 @Select("SELECT user_id FROM fm_employee WHERE employee_id=#{id}") String userId(String id);
 @Insert("INSERT INTO fm_employee(employee_id,user_id,created_at) VALUES(#{id},#{id},#{now})") int insert(@Param("id") String id,@Param("now") Instant now);
 @Delete("DELETE FROM fm_user_role WHERE user_id=#{id}") int deleteRoles(String id);
 @Update("UPDATE fm_user SET version=version+1,updated_at=#{now} WHERE user_id=#{id} AND version=#{version}") int increment(@Param("id") String id,@Param("version") long version,@Param("now") Instant now);
 @Update("UPDATE fm_user SET status=#{status},version=version+1,updated_at=#{now} WHERE user_id=#{id} AND version=#{version}") int status(@Param("id") String id,@Param("status") String status,@Param("version") long version,@Param("now") Instant now);
 @Select("SELECT COUNT(*) FROM fm_user u JOIN fm_user_role r ON r.user_id=u.user_id WHERE u.status='ACTIVE' AND r.role_code='ADMIN'") long activeAdmins();
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,before_summary,after_summary,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{eventId},#{actor},#{operation},'EMPLOYEE',#{target},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{before},#{after},#{trace},#{now},COALESCE((SELECT GROUP_CONCAT(role_code ORDER BY role_code SEPARATOR ',') FROM fm_user_role WHERE user_id=#{actor}),''),CASE WHEN #{operation} LIKE '%.denied' OR #{operation}='auth.refresh.replay' THEN 'DENIED' WHEN #{operation} LIKE '%.failed' THEN 'FAILED' ELSE 'SUCCESS' END)")
 int audit(@Param("eventId") String eventId,@Param("actor") String actor,@Param("operation") String operation,@Param("target") String target,@Param("reason") String reason,@Param("before") String before,@Param("after") String after,@Param("trace") String trace,@Param("now") Instant now);
}
