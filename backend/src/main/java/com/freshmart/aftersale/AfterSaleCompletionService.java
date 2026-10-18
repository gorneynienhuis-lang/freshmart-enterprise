package com.freshmart.aftersale;

import com.freshmart.commerce.CommerceMapper;
import com.freshmart.common.TraceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.util.*;

/** Invoked in the verified refund completion transaction, after the order financial totals are saved. */
@Service
public class AfterSaleCompletionService {
 private final CommerceMapper commerce;private final AfterSaleMapper db;private final ObjectMapper json;private final Clock clock;
 public AfterSaleCompletionService(CommerceMapper commerce,AfterSaleMapper db,ObjectMapper json,Clock clock){this.commerce=commerce;this.db=db;this.json=json;this.clock=clock;}
 @Transactional
 @SuppressWarnings("unchecked")
 public void completeRefund(String refundId){
  var lookup=commerce.refund(refundId);if(lookup==null||lookup.aftersaleId==null||!"AFTERSALE".equals(lookup.type))return;
  var order=commerce.lockOrder(lookup.orderId);var refund=commerce.lockRefund(refundId);if(!"SUCCESS".equals(refund.status))return;
  var after=db.lock(refund.aftersaleId);if(after==null)throw new IllegalStateException("Missing aftersale for verified refund");
  var refunds=db.caseRefunds(after.aftersaleId);long total=0;boolean all=true;for(var r:refunds){if("SUCCESS".equals(r.status))total=AfterSaleService.add(total,r.amount);else all=false;}
  if(total>after.approvedAmount)throw new IllegalStateException("Aftersale refund exceeds approval");
  var snapshot=json.readValue(order.snapshotJson,Map.class);var items=(List<Map<String,Object>>)snapshot.get("items");long remaining=total;boolean changed=false;
  for(var line:db.lines(after.aftersaleId)){
   long paid=Math.min(remaining,line.approvedAmount);remaining-=paid;
   if(paid<line.refundedAmount)throw new IllegalStateException("Successful refund amount cannot decrease");long delta=paid-line.refundedAmount;
   if(delta>0){var item=items.stream().filter(i->line.orderItemId.equals(i.get("orderItemId"))).findFirst().orElseThrow();long current=((Number)item.get("refundedAmount")).longValue();item.put("refundedAmount",AfterSaleService.add(current,delta));line.refundedAmount=paid;db.updateLine(line);changed=true;}
  }
  if(remaining!=0)throw new IllegalStateException("Approval line allocation does not conserve money");
  if(changed){order.snapshotJson=json.writeValueAsString(snapshot);order.updatedAt=clock.instant();order.version++;commerce.updateOrder(order);}
  if(all&&total==after.approvedAmount&&!"COMPLETED".equals(after.status)){
   after.status="COMPLETED";after.version++;after.updatedAt=clock.instant();db.updateCase(after);db.release(after.aftersaleId);
   db.audit(UUID.randomUUID().toString(),"SYSTEM","aftersale.complete",after.aftersaleId,"全部原路退款回执已成功，不修改实物库存",TraceContext.id(),clock.instant(),"","SUCCESS");
  }
 }
}
