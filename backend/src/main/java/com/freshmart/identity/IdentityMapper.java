package com.freshmart.identity;
import org.apache.ibatis.annotations.*;
import java.time.Instant;import java.util.List;
@Mapper
public interface IdentityMapper {
 @Select("SELECT * FROM fm_user WHERE user_id=#{id}") UserRow userById(String id);
 @Select("SELECT * FROM fm_user WHERE user_id=#{id} FOR UPDATE") UserRow lockUser(String id);
 @Select("SELECT * FROM fm_user WHERE phone=#{phone}") UserRow userByPhone(String phone);
 @Select("SELECT role_code FROM fm_user_role WHERE user_id=#{id} ORDER BY role_code") List<String> roles(String id);
 @Insert("INSERT INTO fm_user(user_id,phone,password_hash,display_name,status,must_change_password,version,created_at,updated_at) VALUES(#{userId},#{phone},#{passwordHash},#{displayName},#{status},#{mustChangePassword},#{version},#{createdAt},#{updatedAt})") int insertUser(UserRow row);
 @Insert("INSERT INTO fm_user_role(user_id,role_code) VALUES(#{userId},#{role})") int insertRole(@Param("userId")String userId,@Param("role")String role);
 @Update("UPDATE fm_user SET password_hash=#{hash},must_change_password=false,version=version+1,updated_at=#{now} WHERE user_id=#{id}") int changePassword(@Param("id")String id,@Param("hash")String hash,@Param("now")Instant now);
 @Insert("INSERT INTO fm_auth_session(session_id,family_id,user_id,access_hash,refresh_hash,status,access_expires_at,refresh_expires_at,created_at,rotated_at) VALUES(#{sessionId},#{familyId},#{userId},#{accessHash},#{refreshHash},#{status},#{accessExpiresAt},#{refreshExpiresAt},#{createdAt},#{rotatedAt})") int insertSession(SessionRow row);
 @Select("SELECT * FROM fm_auth_session WHERE access_hash=#{hash}") SessionRow sessionByAccessHash(String hash);
 @Select("SELECT * FROM fm_auth_session WHERE refresh_hash=#{hash}") SessionRow sessionByRefreshHash(String hash);
 @Select("SELECT * FROM fm_auth_session WHERE refresh_hash=#{hash} FOR UPDATE") SessionRow lockSessionByRefreshHash(String hash);
 @Select("SELECT * FROM fm_auth_session WHERE session_id=#{id}") SessionRow sessionById(String id);
 @Update("UPDATE fm_auth_session SET status='ROTATED',rotated_at=#{now} WHERE session_id=#{id} AND status='ACTIVE'") int rotate(@Param("id")String id,@Param("now")Instant now);
 @Update("UPDATE fm_auth_session SET status='REVOKED' WHERE family_id=#{familyId}") int revokeFamily(String familyId);
 @Update("UPDATE fm_auth_session SET status='REVOKED' WHERE user_id=#{userId}") int revokeUser(String userId);
 @Insert("INSERT INTO fm_csrf_context(context_hash,token_hash,expires_at,created_at) VALUES(#{contextHash},#{tokenHash},#{expiresAt},#{createdAt})") int insertCsrf(CsrfRow row);
 @Select("SELECT * FROM fm_csrf_context WHERE context_hash=#{hash}") CsrfRow csrfByHash(String hash);
 @Insert("INSERT IGNORE INTO fm_login_throttle(subject_hash,failed_count,window_started_at,blocked_until) VALUES(#{hash},0,#{now},NULL)") int initializeThrottle(@Param("hash")String hash,@Param("now")Instant now);
 @Select("SELECT * FROM fm_login_throttle WHERE subject_hash=#{hash} FOR UPDATE") ThrottleRow lockThrottle(String hash);
 @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,before_summary,after_summary,trace_id,created_at) VALUES(#{eventId},#{actorId},#{operation},'IDENTITY',#{resourceId},#{reason},NULL,NULL,#{traceId},#{createdAt})") int audit(IdentityAuditRow row);
 @Update("UPDATE fm_login_throttle SET failed_count=#{count},window_started_at=#{start},blocked_until=#{blocked} WHERE subject_hash=#{hash}") int updateThrottle(@Param("hash")String hash,@Param("count")int count,@Param("start")Instant start,@Param("blocked")Instant blocked);
}
