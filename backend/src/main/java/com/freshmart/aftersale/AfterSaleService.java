package com.freshmart.aftersale;

import com.freshmart.common.*;
import com.freshmart.commerce.CommerceMapper;
import com.freshmart.commerce.CommerceModels.OrderRow;
import com.freshmart.commerce.CommerceModels.RefundRow;
import com.freshmart.commerce.RefundProcessor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.time.*;
import java.util.*;
import static com.freshmart.aftersale.AfterSaleModels.*;

@Service @Transactional
public class AfterSaleService {
 private static final Set<String> STATUSES=Set.of("APPLIED","APPROVED","REJECTED","REFUNDING","COMPLETED","CANCELED");
 private final AfterSaleMapper db;private final CommerceMapper commerce;private final ObjectMapper json;private final Clock clock;
 private final AfterSaleDenialAudit denied;private final RefundProcessor processor;private final com.freshmart.media.MediaService media;
 public AfterSaleService(AfterSaleMapper db,CommerceMapper commerce,ObjectMapper json,Clock clock,AfterSaleDenialAudit denied,RefundProcessor processor,com.freshmart.media.MediaService media){this.db=db;this.commerce=commerce;this.json=json;this.clock=clock;this.denied=denied;this.processor=processor;this.media=media;}
 public Map<String,Object> apply(RequestActor actor,ApplyRequest request){
  actor.requireRole("MEMBER");var order=requiredOrder(commerce.lockOrder(request.orderId()));actor.requireOwner(order.userId);
  Instant now=clock.instant();if(!"FINISHED".equals(order.status)||order.finishedAt==null||order.finishedAt.isAfter(now)||!now.isBefore(order.finishedAt.plus(Duration.ofDays(7))))throw invalid("仅完成后7天内的订单可以申请售后");
  if("QUALITY".equals(request.type())&&(request.evidenceMediaIds()==null||request.evidenceMediaIds().isEmpty()))throw ApiException.invalid("品质售后至少需要一张本人订单的真实图片证据");
  var evidence=media.requireEvidence(actor,order.orderId,"AFTERSALE",request.evidenceMediaIds());
  var items=orderItems(order);var unique=new HashSet<String>();long total=0;
  for(var input:request.items()){
   if(!unique.add(input.orderItemId()))throw ApiException.invalid("重复订单明细");var item=findItem(items,input.orderItemId());
   if(input.requestedAmount()<=0)throw ApiException.invalid("退款申请金额必须大于0");
   long delivered=commerceQuantity(order.orderId,input.orderItemId());if(input.quantity()>delivered)throw ApiException.invalid("申请数量不得超过实际送达数量");
   if(db.activeCount(input.orderItemId())>0)throw invalid("该订单明细已有处理中售后");
   long remaining=netAmount(item)-db.reservedForItem(input.orderItemId(),"");if(input.requestedAmount()>remaining)throw invalid("申请金额超过明细剩余可退现金");
   total=add(total,input.requestedAmount());
  }
  var row=new CaseRow();row.aftersaleId=id();row.orderId=order.orderId;row.memberId=actor.userId();row.caseType=request.type();row.reason=request.reason().trim();row.status="APPLIED";row.requestedAmount=total;row.appliedAt=now;row.updatedAt=now;db.insertCase(row);
  for(var image:evidence)db.addEvidence(row.aftersaleId,image.mediaId);
  for(var input:request.items()){var line=new LineRow();line.aftersaleId=row.aftersaleId;line.orderItemId=input.orderItemId();line.quantity=input.quantity();line.requestedAmount=input.requestedAmount();db.insertLine(line);db.activate(line.orderItemId,row.aftersaleId);}
  audit(actor,row.aftersaleId,"aftersale.apply","已校验本人订单、期限及现金上限");return view(row,false);
 }
 @Transactional(readOnly=true) public Map<String,Object> list(RequestActor actor,String status,int page,int size,boolean admin){
  actor.requireRole(admin?"SERVICE":"MEMBER");paging(page,size);if(status!=null&&!STATUSES.contains(status))throw ApiException.invalid("售后状态不合法");
  return map("page",page,"size",size,"total",db.countCases(actor.userId(),admin,status),"items",db.cases(actor.userId(),admin,status,size,(long)(page-1)*size).stream().map(a->view(a,admin)).toList());
 }
 @Transactional(readOnly=true) public Map<String,Object> get(RequestActor actor,String id,boolean admin){actor.requireRole(admin?"SERVICE":"MEMBER");var row=required(db.find(id));scope(actor,row,admin);return view(row,admin);}
 public Map<String,Object> cancel(RequestActor actor,String id,ReasonVersion request){actor.requireRole("MEMBER");var row=lockCase(id);scope(actor,row,false);version(row,request.version());if(!"APPLIED".equals(row.status))throw invalid("审核后不可撤销售后");row.status="CANCELED";touch(row);db.release(id);audit(actor,id,"aftersale.cancel","本人撤销未审核售后");return view(row,false);}
 public Map<String,Object> claim(RequestActor actor,String id,Version request){
  actor.requireRole("SERVICE");var row=lockCase(id);scope(actor,row,true);version(row,request.version());if(!"APPLIED".equals(row.status))throw invalid("只有待审核售后可领取");
  if(row.assigneeId!=null)throw invalid("售后已领取");row.assigneeId=actor.userId();touch(row);audit(actor,id,"aftersale.claim","客服领取工单，尚未审核");return view(row,true);
 }
 public Map<String,Object> reject(RequestActor actor,String id,ReviewRequest request){
  actor.requireRole("SERVICE");var row=lockCase(id);reviewable(actor,row,request.version());row.reviewerId=actor.userId();row.reviewComment=request.comment().trim();row.status="REJECTED";touch(row);db.release(id);audit(actor,id,"aftersale.reject","客服驳回，无资金操作");return view(row,true);
 }
 public Map<String,Object> approve(RequestActor actor,String id,ApproveRequest request){
  actor.requireRole("SERVICE");var row=lockCase(id);reviewable(actor,row,request.version());var order=requiredOrder(commerce.lockOrder(row.orderId));var items=orderItems(order);var lines=db.lines(id);var requested=new HashMap<String,LineRow>();lines.forEach(l->requested.put(l.orderItemId,l));var selected=new HashMap<String,LineInput>();long total=0;
  for(var input:request.approvedItems()){
   if(selected.put(input.orderItemId(),input)!=null)throw ApiException.invalid("重复批准明细");var line=requested.get(input.orderItemId());if(line==null)throw ApiException.notFound();
   if(input.quantity()>line.quantity||input.requestedAmount()<=0||input.requestedAmount()>line.requestedAmount)throw ApiException.invalid("批准范围不得超过申请，零额请驳回");
   var item=findItem(items,line.orderItemId);if(input.requestedAmount()>netAmount(item)-db.reservedForItem(line.orderItemId,id))throw invalid("明细可退现金已被占用");
   total=add(total,input.requestedAmount());
  }
  long remaining=total;
  for(var candidate:commerce.payments(order.orderId)){
   var payment=commerce.lockPayment(candidate.paymentId);if(!payment.accepted||!"SUCCESS".equals(payment.status))continue;
   long available=payment.amount-payment.refundedAmount-payment.refundReserved;if(available<=0)continue;long amount=Math.min(remaining,available);
   var refund=new RefundRow();refund.refundId=id();refund.orderId=order.orderId;refund.paymentId=payment.paymentId;refund.businessKey="aftersale:"+id+":"+payment.paymentId;refund.aftersaleId=id;refund.type="AFTERSALE";refund.amount=amount;refund.status="PENDING";refund.reason="售后审核批准";refund.reviewerId=actor.userId();refund.createdAt=clock.instant();commerce.insertRefund(refund);
   payment.refundReserved=add(payment.refundReserved,amount);payment.version++;commerce.updatePayment(payment);remaining-=amount;if(remaining==0)break;
  }
  if(remaining!=0)throw invalid("原支付可退现金不足");
  for(var line:lines){var approved=selected.get(line.orderItemId);line.approvedAmount=approved==null?0:approved.requestedAmount();db.updateLine(line);}
  row.approvedAmount=total;row.reviewerId=actor.userId();row.reviewComment=request.comment().trim();row.status="APPROVED";touch(row);audit(actor,id,"aftersale.approve","已预留明细与原支付现金，等待独立财务执行");return view(row,true);
 }
 @Transactional(readOnly=true) public Map<String,Object> refunds(RequestActor actor,String status,String orderId,int page,int size){
  actor.requireRole("FINANCE");paging(page,size);if(status!=null&&!Set.of("PENDING","PROCESSING","SUCCESS","FAILED").contains(status))throw ApiException.invalid("退款状态不合法");if(orderId!=null&&!orderId.matches("[A-Za-z0-9_-]{1,64}"))throw ApiException.invalid("订单ID不合法");
  return map("page",page,"size",size,"total",db.countRefunds(status,orderId),"items",db.refunds(status,orderId,size,(long)(page-1)*size).stream().map(r->refundView(r,true)).toList());
 }
 public Map<String,Object> execute(RequestActor actor,String refundId,ReasonVersion request,boolean retry){
  actor.requireRole("FINANCE");var lookup=commerce.refund(refundId);if(lookup==null)throw ApiException.notFound();var order=requiredOrder(commerce.lockOrder(lookup.orderId));commerce.lockPayment(lookup.paymentId);var refund=commerce.lockRefund(refundId);version(refund.version,request.version());
  if(actor.userId().equals(order.userId)||actor.userId().equals(refund.reviewerId)){
   denied.rejected(actor,refundId,"购买人或审核人不得执行同笔退款");throw ApiException.forbidden();
  }
  CaseRow after=null;if(refund.aftersaleId!=null){after=required(db.lock(refund.aftersaleId));if(!Objects.equals(after.reviewerId,refund.reviewerId)||!Set.of("APPROVED","REFUNDING").contains(after.status))throw invalid("售后审批状态不允许执行");}
  if(retry){if(!"FAILED".equals(refund.status)||refund.executorId==null)throw invalid("仅已授权且失败的退款可重试");}
  else if(!"AFTERSALE".equals(refund.type)||after==null||!"PENDING".equals(refund.status)||refund.executorId!=null)throw invalid("只有已审核待授权的人工退款可执行");
  Long receipt=commerce.receiptAmount(refundId);if(receipt!=null&&receipt!=refund.amount)throw invalid("渠道退款金额不符，需人工对账");
  refund.executorId=actor.userId();refund.status="PROCESSING";refund.lastError=null;refund.version++;commerce.updateRefund(refund);
  if(after!=null&&"APPROVED".equals(after.status)){after.status="REFUNDING";touch(after);}
  if(retry){commerce.retryOutbox(refundId,clock.instant());}
  else{commerce.enqueueRefund(id(),"refund:"+refundId,refundId,clock.instant());}
  audit(actor,refundId,retry?"refund.retry":"refund.execute",receipt==null?"核验未见成功回执，授权复用原退款号执行":"已有真实渠道回执，执行对账补记");
  if(receipt!=null)processor.complete(refundId);
  return refundView(commerce.refund(refundId),true);
 }
 private CaseRow lockCase(String id){var lookup=required(db.find(id));requiredOrder(commerce.lockOrder(lookup.orderId));return required(db.lock(id));}
 private void reviewable(RequestActor actor,CaseRow row,long expected){scope(actor,row,true);version(row,expected);if(!"APPLIED".equals(row.status))throw invalid("售后已审核");if(!actor.userId().equals(row.assigneeId)){denied.rejected(actor,row.aftersaleId,"审核前必须独立领取本人处理工单");throw ApiException.forbidden();}}
 private void scope(RequestActor actor,CaseRow row,boolean admin){if(!admin){actor.requireOwner(row.memberId);return;}if(actor.userId().equals(row.memberId)||!(actor.userId().equals(row.assigneeId)||(row.assigneeId==null&&"APPLIED".equals(row.status))))throw ApiException.notFound();}
 private Map<String,Object> view(CaseRow row,boolean admin){
  var result=map("aftersaleId",row.aftersaleId,"orderId",row.orderId,"type",row.caseType,"reason",row.reason,"items",db.lines(row.aftersaleId).stream().map(l->map("orderItemId",l.orderItemId,"quantity",l.quantity,"requestedAmount",l.requestedAmount)).toList(),"evidenceMediaIds",admin&&row.assigneeId==null?List.of():db.evidence(row.aftersaleId),"status",row.status,"requestedAmount",row.requestedAmount,"approvedAmount",row.approvedAmount,"reviewComment",row.reviewComment,"refunds",db.caseRefunds(row.aftersaleId).stream().map(r->refundView(r,false)).toList(),"appliedAt",row.appliedAt,"version",row.version);
  if(admin){result.put("memberId",row.memberId);result.put("reviewerId",row.reviewerId);result.put("assigneeId",row.assigneeId);var order=requiredOrder(commerce.order(row.orderId));result.put("contact",masked(order));}return result;
 }
 static Map<String,Object> refundView(RefundRow r,boolean admin){var result=map("refundId",r.refundId,"orderId",r.orderId,"paymentId",r.paymentId,"aftersaleId",r.aftersaleId,"adjustmentId",r.adjustmentId,"type",r.type,"amount",r.amount,"currency","CNY","status",r.status,"reason",r.reason,"createdAt",r.createdAt,"completedAt",r.completedAt,"version",r.version);if(admin){result.put("reviewerId",r.reviewerId);result.put("executorId",r.executorId);result.put("lastError",r.lastError);}return result;}
 @SuppressWarnings("unchecked") private Map<String,Object> masked(OrderRow order){var snapshot=json.readValue(order.snapshotJson,Map.class);var a=(Map<String,Object>)snapshot.get("address");String name=Objects.toString(a.get("recipientName"),"*"),phone=Objects.toString(a.get("phone"),"");return map("recipientName",name.substring(0,1)+"**","phoneMasked",phone.length()==11?phone.substring(0,3)+"****"+phone.substring(7):"****"+phone.substring(Math.max(0,phone.length()-4)),"region",Objects.toString(a.get("city"),"")+Objects.toString(a.get("district"),""));}
 @SuppressWarnings("unchecked") private List<Map<String,Object>> orderItems(OrderRow order){return (List<Map<String,Object>>)json.readValue(order.snapshotJson,Map.class).get("items");}
 private static Map<String,Object> findItem(List<Map<String,Object>> items,String id){return items.stream().filter(i->id.equals(i.get("orderItemId"))).findFirst().orElseThrow(ApiException::notFound);}
 private long commerceQuantity(String order,String item){return db.pickedQuantity(order,item);}
 private static long netAmount(Map<String,Object> item){Object value=item.get("finalPayableAmount");return ((Number)(value==null?item.get("originalPayableAmount"):value)).longValue();}
 private void touch(CaseRow row){row.version++;row.updatedAt=clock.instant();db.updateCase(row);}
 private void audit(RequestActor actor,String resource,String operation,String reason){db.audit(id(),actor.userId(),operation,resource,reason,TraceContext.id(),clock.instant(),String.join(",",actor.roles().stream().sorted().toList()),"SUCCESS");}
 static long add(long a,long b){var n=BigInteger.valueOf(a).add(BigInteger.valueOf(b));if(n.signum()<0||n.compareTo(BigInteger.valueOf(MAX))>0)throw ApiException.invalid("金额超出允许范围");return n.longValueExact();}
 static Map<String,Object> map(Object... values){var m=new LinkedHashMap<String,Object>();for(int n=0;n<values.length;n+=2)m.put((String)values[n],values[n+1]);return m;}
 private static String id(){return UUID.randomUUID().toString();}
 private static CaseRow required(CaseRow row){if(row==null)throw ApiException.notFound();return row;}
 private static OrderRow requiredOrder(OrderRow row){if(row==null)throw ApiException.notFound();return row;}
 private static ApiException invalid(String reason){return new ApiException(409,1007,"INVALID_STATE",reason);}
 private static void version(CaseRow row,long expected){version(row.version,expected);}
 private static void version(long actual,long expected){if(actual!=expected)throw ApiException.conflict("资源已变更，请刷新后重试");}
 private static void paging(int page,int size){if(page<1||size<1||size>100)throw ApiException.invalid("分页范围不合法");}
}
