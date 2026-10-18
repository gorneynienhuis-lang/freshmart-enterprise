package com.freshmart.identity;

import com.freshmart.common.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.*;
import static com.freshmart.identity.EmployeeModels.*;

@Service
public class EmployeeService {
 private static final List<String> ROLES=List.of("MEMBER","PICKER","COURIER","OPERATOR","SERVICE","FINANCE","ADMIN");
 private static final Map<String,String> NAMES=Map.of("MEMBER","社区会员","PICKER","拣货员","COURIER","配送员","OPERATOR","门店运营","SERVICE","客服","FINANCE","财务","ADMIN","系统管理员");
 private static final Map<String,String> DESCRIPTIONS=Map.of("MEMBER","本人购物、订单与售后；员工须显式兼任会员。","PICKER","本店仓储、拣货与配送交接。","COURIER","仅处理指派给本人的配送任务。","OPERATOR","本店商品经营与脱敏业务概览。","SERVICE","售后工单领取与审核；不执行人工退款。","FINANCE","财务查询与已审核退款执行；不得审核执行同笔退款。","ADMIN","员工账户、显式角色与身份治理；不继承其他业务岗位权限。");
 private final EmployeeMapper employees;private final IdentityMapper users;private final PermissionRegistry permissions;private final PasswordHasher passwords;private final EmployeeDenialAudit denials;private final Clock clock;
 public EmployeeService(EmployeeMapper employees,IdentityMapper users,PermissionRegistry permissions,PasswordHasher passwords,EmployeeDenialAudit denials,Clock clock){this.employees=employees;this.users=users;this.permissions=permissions;this.passwords=passwords;this.denials=denials;this.clock=clock;}

 public PageResult<Employee> list(RequestActor actor,int page,int size){actor.requirePermission("employee.read");if(page<1||size<1||size>100)throw ApiException.invalid("分页参数无效");return new PageResult<>(page,size,employees.count(),employees.list((long)(page-1)*size,size).stream().map(this::view).toList());}
 public RoleList roles(RequestActor actor){actor.requirePermission("role.read");return new RoleList(ROLES.stream().map(r->new Role(r,NAMES.get(r),DESCRIPTIONS.get(r),permissions.permissions(Set.of(r)).stream().sorted().toList())).toList());}

 @Transactional public Employee create(RequestActor actor,Create body){
  lockActor(actor,"employee.create");List<String> roles=validateRoles(body.roles());
  if(users.userByPhone(body.phone())!=null)throw reject(actor,"new","PHONE_ALREADY_EXISTS",ApiException.conflict("该登录手机号已存在，不能接管已有账号"));
  String id=UUID.randomUUID().toString();var now=clock.instant();
  var user=new UserRow(id,body.phone(),passwords.encode(body.temporaryPassword()),body.displayName().trim(),"ACTIVE",true,0,now,now);
  try{users.insertUser(user);employees.insert(id,now);for(String role:roles)users.insertRole(id,role);}catch(DuplicateKeyException e){throw reject(actor,"new","PHONE_ALREADY_EXISTS",ApiException.conflict("该登录手机号已存在，不能接管已有账号"));}
  var result=view(user);audit(actor,"employee.create",result,"创建员工，首次登录须改密",null);return result;
 }
 @Transactional public Employee setRoles(RequestActor actor,String employeeId,Roles body){
  lockActor(actor,"employee.roles");List<String> assigned=validateRoles(body.roles());UserRow target=target(actor,employeeId,body.version());
  if(actor.userId().equals(target.userId()))throw reject(actor,employeeId,"SELF_ROLE_CHANGE",ApiException.forbidden());
  var before=view(target);if(before.roles().contains("ADMIN")&&!assigned.contains("ADMIN")&&"ACTIVE".equals(target.status())&&employees.activeAdmins()<=1)throw reject(actor,employeeId,"LAST_ACTIVE_ADMIN",ApiException.conflict("必须保留至少一名启用的系统管理员"));
  if(employees.increment(target.userId(),body.version(),clock.instant())!=1)throw reject(actor,employeeId,"STALE_VERSION",ApiException.conflict("账号版本已变化，请刷新后重试"));
  employees.deleteRoles(target.userId());for(String role:assigned)users.insertRole(target.userId(),role);users.revokeUser(target.userId());
  var result=view(users.userById(target.userId()));audit(actor,"employee.roles",result,body.reason().trim(),before);return result;
 }
 @Transactional public Employee setStatus(RequestActor actor,String employeeId,Status body){
  lockActor(actor,"employee.status");UserRow target=target(actor,employeeId,body.version());
  if(actor.userId().equals(target.userId()))throw reject(actor,employeeId,"SELF_STATUS_CHANGE",ApiException.forbidden());
  var before=view(target);if(before.roles().contains("ADMIN")&&"ACTIVE".equals(target.status())&&"DISABLED".equals(body.status())&&employees.activeAdmins()<=1)throw reject(actor,employeeId,"LAST_ACTIVE_ADMIN",ApiException.conflict("必须保留至少一名启用的系统管理员"));
  if(employees.status(target.userId(),body.status(),body.version(),clock.instant())!=1)throw reject(actor,employeeId,"STALE_VERSION",ApiException.conflict("账号版本已变化，请刷新后重试"));
  users.revokeUser(target.userId());var result=view(users.userById(target.userId()));audit(actor,"employee.status",result,body.reason().trim(),before);return result;
 }
 private void lockActor(RequestActor actor,String permission){
  actor.requirePermission(permission);employees.lockGovernance();
  UserRow current=users.lockUser(actor.userId());SessionRow session=users.sessionById(actor.sessionId());
  if(current==null||!"ACTIVE".equals(current.status())||current.mustChangePassword()||session==null||!"ACTIVE".equals(session.status())||!session.userId().equals(actor.userId())||!session.accessExpiresAt().isAfter(clock.instant()))throw reject(actor,"governance","ACTOR_SESSION_REVOKED",ApiException.unauthorized());
  if(!users.roles(actor.userId()).contains("ADMIN"))throw reject(actor,"governance","ACTOR_ADMIN_REVOKED",ApiException.forbidden());
 }
 private UserRow target(RequestActor actor,String employeeId,long version){String userId=employees.userId(employeeId);if(userId==null)throw reject(actor,employeeId,"EMPLOYEE_NOT_FOUND",ApiException.notFound());UserRow row=users.lockUser(userId);if(row==null)throw ApiException.notFound();if(row.version()!=version)throw reject(actor,employeeId,"STALE_VERSION",ApiException.conflict("账号版本已变化，请刷新后重试"));return row;}
 private List<String> validateRoles(List<String> roles){if(roles==null||roles.isEmpty()||roles.size()>8||roles.stream().anyMatch(r->!ROLES.contains(r))||new HashSet<>(roles).size()!=roles.size())throw ApiException.invalid("角色列表无效或重复");return roles.stream().sorted().toList();}
 private Employee view(UserRow row){String phone=row.phone();String masked=phone.length()>=7?phone.substring(0,3)+"****"+phone.substring(phone.length()-4):"***";return new Employee(row.mustChangePassword(),row.userId(),row.userId(),row.displayName(),masked,users.roles(row.userId()),row.status(),row.version());}
 private ApiException reject(RequestActor actor,String target,String code,ApiException error){denials.rejected(actor.userId(),safeTarget(target),code);return error;}
 private String safeTarget(String target){return target!=null&&target.matches("[A-Za-z0-9_-]{1,64}")?target:"unknown";}
 private void audit(RequestActor actor,String operation,Employee after,String reason,Employee before){employees.audit(UUID.randomUUID().toString(),actor.userId(),operation,after.employeeId(),reason,summary(before),summary(after),TraceContext.id(),clock.instant());}
 private String summary(Employee employee){return employee==null?null:"status="+employee.status()+";roles="+String.join(",",employee.roles())+";version="+employee.version()+";mustChangePassword="+employee.mustChangePassword();}
}
