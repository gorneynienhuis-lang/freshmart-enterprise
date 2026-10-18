package com.freshmart.support;

import com.freshmart.audit.AuditRecorder;
import com.freshmart.commerce.CommerceMapper;
import com.freshmart.commerce.CommerceModels.ReasonVersion;
import com.freshmart.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import static com.freshmart.support.CancellationSupportModels.*;

/** Order lock precedes the durable assignment guard; requests never move stock or money. */
@Service
public class CancellationSupportService {
 private final CancellationSupportMapper db;private final CommerceMapper commerce;private final Clock clock;private final AuditRecorder audit;
 public CancellationSupportService(CancellationSupportMapper db,CommerceMapper commerce,Clock clock,AuditRecorder audit){this.db=db;this.commerce=commerce;this.clock=clock;this.audit=audit;}
 @Transactional
 public CancellationSupport request(RequestActor actor,String orderId,ReasonVersion input){
  try {
   actor.requireRole("MEMBER");
   var order=commerce.lockOrder(orderId);if(order==null)throw ApiException.notFound();actor.requireOwner(order.userId);
   if(input.version()==null||input.version()<0||input.version()>9007199254740991L||input.reason()==null||input.reason().isBlank()||input.reason().length()>500)throw ApiException.invalid("请填写有效原因与版本");
   if(order.version!=input.version())throw ApiException.conflict("订单已变化，请刷新后重试");
   if(!Set.of("PENDING_PAY","PAID","PICKING","READY_TO_SHIP").contains(order.status))throw ApiException.conflict("仅发货前订单可请求取消协助");
   if(order.version>=9007199254740991L)throw ApiException.conflict("订单版本已到安全上限");
   if(db.lockOpen(orderId)!=null)throw ApiException.conflict("该订单已有待处理取消请求，请等待受派客服处理");
   if(db.lockAssignments()==null)throw new IllegalStateException("Cancellation assignment guard missing");
   String assignee=db.chooseSupport(actor.userId());
   if(assignee==null)throw ApiException.conflict("暂无可用独立客服，订单未改变；可稍后重试或直接取消");
   commerce.lockUser(assignee);
   if(commerce.activeRole(assignee,"SERVICE")!=1)throw ApiException.conflict("客服岗位已变化，未创建请求，请稍后重试");
   var row=new RequestRow(UUID.randomUUID().toString(),orderId,orderId,actor.userId(),assignee,"OPEN",input.reason().trim(),clock.instant(),null);
   db.insert(row);order.version++;order.updatedAt=clock.instant();commerce.updateOrder(order);
   audit.record(actor,"order.cancellation.request","ORDER",orderId,"SUCCESS",input.reason().trim());
   db.audit(UUID.randomUUID().toString(),"SYSTEM","","cancellation.assign",row.requestId(),"rule=LEAST_OPEN_SUPPORT_WORKLOAD_THEN_USER_ID;assigneeId="+assignee,TraceContext.id(),clock.instant());
   return view(row);
  } catch(ApiException e) {audit.denied(actor,"order.cancellation.request.denied",orderId,e.errorKey());throw e;}
 }
 @Transactional(readOnly=true)
 public CancellationSupport latest(String orderId){var row=db.latest(orderId);return row==null?null:view(row);}
 /** Called in the existing order-locked cancellation/dispatch transaction; no additional version increment. */
 @Transactional
 public void resolveOpen(String orderId,String actor,String reason){
  var row=db.lockOpen(orderId);if(row==null)return;
  if(db.resolve(row.requestId(),clock.instant())!=1)throw new IllegalStateException("Cancellation request resolution lost");
  String roles="SYSTEM".equals(actor)?"":String.join(",",commerce.actorRoles(actor));
  db.audit(UUID.randomUUID().toString(),actor,roles,"cancellation.resolve",row.requestId(),reason,TraceContext.id(),clock.instant());
 }
 private static CancellationSupport view(RequestRow row){return new CancellationSupport(row.requestId(),row.orderId(),row.status(),row.reason(),row.requestedAt(),row.resolvedAt());}
}
