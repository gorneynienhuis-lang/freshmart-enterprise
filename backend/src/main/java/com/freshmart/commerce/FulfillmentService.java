package com.freshmart.commerce;

import com.freshmart.checkout.CheckoutMapper;
import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import com.freshmart.identity.IdentityMapper;
import com.freshmart.identity.TokenCodec;
import com.freshmart.audit.SafeAuditText;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import static com.freshmart.commerce.CommerceModels.*;
import static com.freshmart.commerce.CommerceService.*;

/** Extends the same order transaction rather than replacing inventory or money ledgers. */
@Service
public class FulfillmentService {
 private final CommerceService commerce;
 private final CommerceMapper db;
 private final FulfillmentMapper fulfillment;
 private final CheckoutMapper checkout;
 private final IdentityMapper identities;
 private final IdempotencyService commands;
 private final FulfillmentDenialAudit denials;
 private final ObjectMapper json;
 private final Clock clock;
 public FulfillmentService(CommerceService commerce,CommerceMapper db,FulfillmentMapper fulfillment,CheckoutMapper checkout,
                           IdentityMapper identities,IdempotencyService commands,FulfillmentDenialAudit denials,ObjectMapper json,Clock clock){
  this.commerce=commerce;this.db=db;this.fulfillment=fulfillment;this.checkout=checkout;
  this.identities=identities;this.commands=commands;this.denials=denials;this.json=json;this.clock=clock;
 }

 @Transactional
 public Map<String,Object> reallocate(RequestActor actor,String taskId,Reallocate request){
  try{
   actor.requireRole("PICKER");
   OrderRow order=commerce.pickOrder(actor,taskId,true);
   if(!actor.userId().equals(order.pickerId))throw ApiException.notFound();
   version(order.version,request.version());
   if(!"PICKING".equals(order.status)||!"CLAIMED".equals(order.pickStatus))
    throw invalidState("仅本人正在拣货且尚未出库的任务可以重分配");
   var snapshot=commerce.snapshot(order);
   Instant end=instant(child(snapshot,"slot").get("endAt"));
   if(!end.isAfter(clock.instant()))throw stock("配送时段已结束，不能分配新批次");
   List<Map<String,Object>> items=items(snapshot);
   Map<String,Map<String,Object>> byItem=new LinkedHashMap<>();
   Map<String,String> itemBySku=new HashMap<>();
   for(var item:items){
    byItem.put(string(item,"orderItemId"),item);
    if(itemBySku.put(string(item,"skuId"),string(item,"orderItemId"))!=null)
     throw new IllegalStateException("Duplicate SKU in frozen order");
   }
   List<String> skuIds=items.stream().map(item->string(item,"skuId")).sorted().toList();
   skuIds.forEach(checkout::lockSku);
   List<AllocationRow> old=fulfillment.lockAllocations(order.orderId);
   if(old.isEmpty()||old.stream().anyMatch(a->a.pickedQuantity!=0||a.returnedQuantity!=0||a.reservedQuantity<=0))
    throw invalidState("已扣减实物库存或无有效预占，不能重分配");
   for(var allocation:old)nextVersion(allocation.version);
   Map<String,Long> proposed=new TreeMap<>(),requestedTotals=new HashMap<>(),oldTotals=new HashMap<>(),releasedByBatch=new HashMap<>();
   for(var line:request.allocations()){
    if(!byItem.containsKey(line.orderItemId()))throw ApiException.invalid("重分配包含其他订单行");
    String key=line.orderItemId()+"/"+line.batchId();
    if(proposed.put(key,line.quantity())!=null)throw ApiException.invalid("同一订单行和批次不能重复提交");
    requestedTotals.merge(line.orderItemId(),line.quantity(),this::safeAdd);
   }
   for(var allocation:old){
    oldTotals.merge(allocation.orderItemId,allocation.reservedQuantity,this::safeAdd);
    releasedByBatch.merge(allocation.batchId,allocation.reservedQuantity,this::safeAdd);
   }
   for(var item:items){
    String itemId=string(item,"orderItemId");long quantity=number(item,"quantity");
    if(!Objects.equals(requestedTotals.get(itemId),quantity)||!Objects.equals(oldTotals.get(itemId),quantity))
     throw ApiException.invalid("重分配必须完整保持每个订单行的基础单位数量");
   }
   Map<String,com.freshmart.checkout.CheckoutModels.QuoteLineRow> quoteLines=new HashMap<>();
   for(var line:checkout.quoteLines(order.quoteId))quoteLines.put(line.skuId(),line);
   Map<String,Long> expected=new TreeMap<>();
   for(String sku:skuIds){
    var item=byItem.get(itemBySku.get(sku));var quote=quoteLines.get(sku);
    Instant near=quote!=null&&quote.nearExpiryOnly()?quote.nearExpiryCutoffAt():null;
    long remaining=number(item,"quantity");
    for(var batch:db.lockBatches(sku,end,near)){
     if(batch.receivedAt().isAfter(clock.instant())||!batch.expiresAt().isAfter(clock.instant()))continue;
     long available=safeAdd(batch.onHand()-batch.reserved()-batch.quarantined(),releasedByBatch.getOrDefault(batch.batchId(),0L));
     long take=Math.min(remaining,available);
     if(take>0){expected.put(string(item,"orderItemId")+"/"+batch.batchId(),take);remaining-=take;}
     if(remaining==0)break;
    }
    if(remaining>0)throw stock("重分配候选批次的有效可用量不足");
   }
   if(!expected.equals(proposed))throw stock("提交的批次不满足当前FEFO、到期或临期成交限制，请刷新批次后重试");
   String before=allocationSummary(old);
   for(var allocation:old){
    var batch=db.lockBatch(allocation.batchId);
    if(batch==null)throw new IllegalStateException("Reserved batch disappeared");
    commerce.move(order,allocation,batch,0,-allocation.reservedQuantity,0,"RELEASE",request.reason().trim(),actor.userId());
    if(fulfillment.retireAllocation(allocation.allocationId)!=1)throw ApiException.conflict("旧分配已变化");
   }
   for(var entry:expected.entrySet()){
    String[] key=entry.getKey().split("/",2);var item=byItem.get(key[0]);var batch=db.lockBatch(key[1]);
    AllocationRow allocation=new AllocationRow();
    allocation.allocationId=id("alloc");allocation.orderId=order.orderId;allocation.orderItemId=key[0];
    allocation.skuId=string(item,"skuId");allocation.batchId=batch.batchId();allocation.batchNo=batch.batchNo();
    allocation.baseUnit=string(item,"baseUnit");allocation.reservedQuantity=entry.getValue();
    db.insertAllocation(allocation);
    commerce.move(order,allocation,batch,0,entry.getValue(),0,"RESERVE",request.reason().trim(),actor.userId());
   }
   commerce.touch(order);
   audit(actor,"pick.reallocate","PICK_TASK",taskId,request.reason().trim(),before,allocationSummary(db.allocations(order.orderId)));
   return commerce.pickView(order);
  }catch(ApiException error){denials.rejected(actor,taskId,"pick.reallocate",error.errorKey());throw error;}
 }

 @Transactional
 public Map<String,Object> reportException(RequestActor actor,String taskId,DeliveryException request){
  try{
   actor.requireRole("COURIER");OrderRow order=commerce.deliveryOrder(actor,taskId,true);
   actor.requireOwner(order.courierId);version(order.version,request.version());
   if(!"DELIVERING".equals(order.status)||!"DELIVERING".equals(order.deliveryStatus))
    throw invalidState("只能为本人正在配送的任务报告异常");
   String support=fulfillment.chooseSupport(order.userId,actor.userId());
   if(support==null)throw invalidState("暂无可处理且与订单购买人独立的客服，请稍后重试");
   db.lockUser(support);
   if(db.activeRole(support,"SERVICE")!=1)throw ApiException.conflict("客服状态已变化，请重试");
   var exception=new DeliveryExceptionRow(id("dex"),order.orderId,taskId,order.orderId,request.type(),request.reason().trim(),
           order.courierId,support,"OPEN",null,null,clock.instant(),null);
   fulfillment.insertException(exception);order.deliveryStatus="EXCEPTION";commerce.touch(order);
   audit(actor,"delivery.exception","DELIVERY_TASK",taskId,request.reason().trim(),"status=DELIVERING;courier="+order.courierId,
           "status=EXCEPTION;courier="+order.courierId+";exception="+exception.exceptionId());
   audit(actor,"delivery.exception.assign","DELIVERY_EXCEPTION",exception.exceptionId(),
           "SYSTEM_RULE: least open exceptions then userId; buyer and reporting courier excluded",null,"assignee="+support);
   return commerce.deliveryView(order);
  }catch(ApiException error){denials.rejected(actor,taskId,"delivery.exception",error.errorKey());throw error;}
 }

 @Transactional
 public Map<String,Object> resolveException(RequestActor actor,String taskId,ResolveException request){
  try{
   actor.requireRole("SERVICE");OrderRow lookup=required(db.byDelivery(taskId));OrderRow order=required(db.lockOrder(lookup.orderId));
   if(fulfillment.exceptionScope(order.orderId,actor.userId())==0)throw ApiException.notFound();
   var exception=fulfillment.lockOpenException(order.orderId);
   if(exception==null){if(!"EXCEPTION".equals(order.deliveryStatus))throw invalidState("当前配送任务没有未解决异常");throw ApiException.notFound();}
   if(!actor.userId().equals(exception.assigneeId())||actor.userId().equals(order.userId))throw ApiException.notFound();
   version(order.version,request.expectedVersion());
   if(!"DELIVERING".equals(order.status)||!"EXCEPTION".equals(order.deliveryStatus)||!Objects.equals(order.courierId,exception.courierId()))
    throw invalidState("只有保持原受派配送员的配送中异常可以恢复");
   if(db.activeRole(order.courierId,"COURIER")!=1)throw invalidState("原配送员已停用或岗位失效，不能恢复任务");
   if(fulfillment.resolve(exception.exceptionId(),actor.userId(),request.reason().trim(),clock.instant())!=1)
    throw ApiException.conflict("异常已由其他请求处理");
   order.deliveryStatus="DELIVERING";commerce.touch(order);
   audit(actor,"delivery.exception.resolve","DELIVERY_TASK",taskId,request.reason().trim(),"status=EXCEPTION;courier="+order.courierId,
           "status=DELIVERING;courier="+order.courierId+";exception="+exception.exceptionId());
   return commerce.deliveryView(order);
  }catch(ApiException error){denials.rejected(actor,taskId,"delivery.exception.resolve",error.errorKey());throw error;}
 }

 /** Re-authorize and lock before reading a replay. The ledger contains no contact data. */
 @Transactional @SuppressWarnings("unchecked")
 public Map<String,Object> contactAccess(RequestActor actor,String taskId,ContactAccess request,String key){
  try{
   actor.requireRole("COURIER");db.lockUser(actor.userId());
   var current=identities.userById(actor.userId());var session=identities.sessionById(actor.sessionId());
   if(current==null||!"ACTIVE".equals(current.status())||current.mustChangePassword()||session==null
           ||!"ACTIVE".equals(session.status())||!session.userId().equals(actor.userId())
           ||!session.accessExpiresAt().isAfter(clock.instant())||!identities.roles(actor.userId()).contains("COURIER"))
    throw ApiException.unauthorized();
   OrderRow order=commerce.deliveryOrder(actor,taskId,true);actor.requireOwner(order.courierId);version(order.version,request.version());
   if(!"DELIVERING".equals(order.status)||!"DELIVERING".equals(order.deliveryStatus))
    throw invalidState("仅本人正在配送且无异常的任务可读取联系信息");
   if(!"DELIVERY_CONTACT".equals(request.purpose())||request.reason()==null||request.reason().isBlank())
    throw ApiException.invalid("用途或访问理由无效");
   commands.execute(actor.userId(),"POST /api/v1/admin/delivery-tasks/"+taskId+"/contact-access",key,
           TokenCodec.hash(json.writeValueAsString(request)),Map.class,()->{
    audit(actor,"delivery.contact.access","DELIVERY_TASK",taskId,
            "purpose=DELIVERY_CONTACT;reasonHash="+TokenCodec.hash(request.reason().trim()),null,"authorized=true;version="+order.version);
    return map("accepted",true,"taskId",taskId);
   });
   var address=child(commerce.snapshot(order),"address");
   return map("taskId",taskId,"recipientName",address.get("recipientName"),"phone",address.get("phone"),
           "addressDetail",""+address.get("province")+address.get("city")+address.get("district")+address.get("detail"));
  }catch(ApiException error){denials.rejected(actor,taskId,"delivery.contact.access",error.errorKey());throw error;}
 }
 private long safeAdd(long a,long b){
  try{long value=Math.addExact(a,b);if(value<0||value>9007199254740991L)throw ApiException.invalid("数量合计超出安全范围");return value;}
  catch(ArithmeticException error){throw ApiException.invalid("数量合计超出安全范围");}
 }
 private String allocationSummary(List<AllocationRow> allocations){
  return json.writeValueAsString(allocations.stream().map(a->map("allocationId",a.allocationId,"orderItemId",a.orderItemId,
          "batchId",a.batchId,"reservedQuantity",a.reservedQuantity,"version",a.version)).toList());
 }
 private void audit(RequestActor actor,String operation,String type,String resource,String reason,String before,String after){
  fulfillment.audit(id("audit"),actor.userId(),operation,type,resource,SafeAuditText.redact(reason),before,after,TraceContext.id(),clock.instant(),String.join(",",actor.roles().stream().sorted().toList()),"SUCCESS");
 }
}
