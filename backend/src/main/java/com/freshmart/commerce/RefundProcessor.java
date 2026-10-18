package com.freshmart.commerce;

import com.freshmart.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import java.time.*;
import java.util.*;
import static com.freshmart.commerce.CommerceModels.*;

/** Merchant bookkeeping is separate from the durable sandbox channel fact. Every worker mutation is fenced. */
@Service
public class RefundProcessor {
 public record OutboxLease(String eventId,String status,int attemptCount,int cycleAttemptCount,Instant availableAt,Instant leaseUntil,String leaseToken,long leaseGeneration){}
 public record ChannelReceipt(String refundId,String paymentId,long amount,String channelRefundNo,Instant completedAt){}
 public static final class ClaimedRefund extends RefundRow {
  private final String token;private final long generation;private final int cycleAttempt;
  private ClaimedRefund(RefundRow r,OutboxLease lease){
   refundId=r.refundId;orderId=r.orderId;paymentId=r.paymentId;businessKey=r.businessKey;aftersaleId=r.aftersaleId;adjustmentId=r.adjustmentId;type=r.type;status=r.status;reason=r.reason;reviewerId=r.reviewerId;executorId=r.executorId;lastError=r.lastError;amount=r.amount;version=r.version;createdAt=r.createdAt;completedAt=r.completedAt;
   token=lease.leaseToken();generation=lease.leaseGeneration();cycleAttempt=lease.cycleAttemptCount();
  }
 }
 private record Locked(OrderRow order,PaymentRow payment,RefundRow refund,OutboxLease lease){}
 private final CommerceMapper db;private final CommerceService orders;private final Clock clock;private final com.freshmart.aftersale.AfterSaleCompletionService aftersales;private final RefundRecoveryPolicy policy;private final com.freshmart.aftersale.AfterSaleDenialAudit denials;
 public RefundProcessor(CommerceMapper db,CommerceService orders,Clock clock,com.freshmart.aftersale.AfterSaleCompletionService aftersales,RefundRecoveryPolicy policy,com.freshmart.aftersale.AfterSaleDenialAudit denials){this.db=db;this.orders=orders;this.clock=clock;this.aftersales=aftersales;this.policy=policy;this.denials=denials;}
 private Locked lock(String id){var lookup=db.refund(id);if(lookup==null)return null;var o=db.lockOrder(lookup.orderId);var p=db.lockPayment(lookup.paymentId);var r=db.lockRefund(id);return new Locked(o,p,r,db.lockRefundOutbox(id));}
 @Transactional(isolation=Isolation.READ_COMMITTED) public ClaimedRefund claim(String id){
  var x=lock(id);if(x==null||x.lease==null||"SUCCESS".equals(x.refund.status)||"COMPLETED".equals(x.lease.status()))return null;
  var receipt=db.refundReceipt(id);boolean fact=validReceipt(x.refund,receipt);Instant now=clock.instant();var old=x.lease;
  if(!Set.of("PENDING","PROCESSING").contains(old.status())&&!("DEAD".equals(old.status())&&fact))return null;
  if(old.leaseUntil()!=null&&old.leaseUntil().isAfter(now)||old.availableAt().isAfter(now)&&!fact)return null;
  String token=UUID.randomUUID().toString();if(db.claimRefund(id,old.leaseGeneration(),token,now,now.plusSeconds(policy.leaseSeconds()),fact)!=1)return null;
  var claim=new ClaimedRefund(x.refund,db.lockRefundOutbox(id));
  if(receipt!=null&&!fact){dead(x,claim,"RECEIPT_MISMATCH");return null;}
  // A channel success is authoritative even after the original authorizer loses their role.
  if(!fact&&(old.cycleAttemptCount()>=policy.maxAttempts()||!sendAllowed(x))){dead(x,claim,old.cycleAttemptCount()>=policy.maxAttempts()?"RETRY_EXHAUSTED":"AUTHORIZATION_REVOKED");return null;}
  x.refund.status="PROCESSING";x.refund.lastError=null;x.refund.version=CommerceService.nextVersion(x.refund.version);db.updateRefund(x.refund);return new ClaimedRefund(x.refund,db.lockRefundOutbox(id));
 }
 /** Joins the receipt store transaction; row/user locks remain held until the channel fact commits. */
 @Transactional(isolation=Isolation.READ_COMMITTED) public boolean authorizeSend(ClaimedRefund claim){
  var x=lock(claim.refundId);if(!owns(x,claim))return false;if(!Objects.equals(claim.paymentId,x.refund.paymentId)||claim.amount!=x.refund.amount)throw new RefundChannelException("RECEIPT_MISMATCH",true);var receipt=db.refundReceipt(claim.refundId);
  if(receipt!=null){if(!validReceipt(x.refund,receipt))throw new RefundChannelException("RECEIPT_MISMATCH",true);return true;}
  if(!sendAllowed(x)){dead(x,claim,"AUTHORIZATION_REVOKED");return false;}return true;
 }
 private boolean sendAllowed(Locked x){
  var r=x.refund;if(r.executorId==null)return false;
  if("SYSTEM".equals(r.executorId))return Set.of("CANCEL","LATE_PAYMENT","DUPLICATE_PAYMENT","WEIGHT_DIFFERENCE").contains(r.type);
  db.lockUser(r.executorId);
  return !r.executorId.equals(x.order.userId)&&!r.executorId.equals(r.reviewerId)&&r.executorId.equals(db.authorizedRefundExecutor(r.executorId))&&(!"AFTERSALE".equals(r.type)||r.reviewerId!=null&&r.aftersaleId.equals(db.validRefundApproval(r.aftersaleId,r.reviewerId)));
 }
 private boolean validReceipt(RefundRow r,ChannelReceipt c){return c!=null&&r.refundId.equals(c.refundId())&&r.paymentId.equals(c.paymentId())&&r.refundId.equals(c.channelRefundNo())&&r.amount==c.amount()&&c.completedAt()!=null&&!c.completedAt().isBefore(r.createdAt)&&!c.completedAt().isAfter(clock.instant().plusSeconds(5));}
 private boolean owns(Locked x,ClaimedRefund c){return x!=null&&x.lease!=null&&"PROCESSING".equals(x.lease.status())&&Objects.equals(x.lease.leaseToken(),c.token)&&x.lease.leaseGeneration()==c.generation&&x.lease.leaseUntil()!=null&&x.lease.leaseUntil().isAfter(clock.instant());}
 @Transactional(isolation=Isolation.READ_COMMITTED) public void complete(ClaimedRefund claim){
  var x=lock(claim.refundId);if(x==null)return;if("SUCCESS".equals(x.refund.status)&&x.lease!=null&&"COMPLETED".equals(x.lease.status()))return;if(!owns(x,claim))return;
  var receipt=db.refundReceipt(claim.refundId);if(!validReceipt(x.refund,receipt))throw new RefundChannelException(receipt==null?"CHANNEL_RECEIPT_MISSING":"RECEIPT_MISMATCH",receipt!=null);
  completeLocked(x,claim,receipt);
 }
 private void completeLocked(Locked x,ClaimedRefund claim,ChannelReceipt receipt){
  var p=x.payment;var r=x.refund;var o=x.order;if(p.refundReserved<r.amount||p.refundedAmount>p.amount-r.amount)throw new IllegalStateException("Refund budget integrity failure");
  if(finish(claim,"COMPLETED",null,receipt.completedAt())!=1)throw new IllegalStateException("Refund lease lost before bookkeeping");
  p.refundReserved-=r.amount;p.refundedAmount+=r.amount;p.version=CommerceService.nextVersion(p.version);db.updatePayment(p);
  r.status="SUCCESS";r.completedAt=receipt.completedAt();r.version=CommerceService.nextVersion(r.version);r.lastError=null;db.updateRefund(r);
  if(p.accepted)o.refundedAmount=Math.addExact(o.refundedAmount,r.amount);
  if("REFUND_PENDING".equals(o.adjustmentStatus)){long total=db.lockRefundsForOrder(o.orderId).stream().filter(a->o.adjustmentId.equals(a.adjustmentId)&&"SUCCESS".equals(a.status)).mapToLong(a->a.amount).sum();if(total==-o.adjustmentDelta)o.adjustmentStatus="REFUNDED";}
  orders.touch(o);aftersales.completeRefund(r.refundId);audit("SYSTEM",r,"refund.success","渠道回执与原退款号、支付、金额均已核验；完成本地补账",null,"SUCCESS");
 }
 @Transactional(isolation=Isolation.READ_COMMITTED) public void failed(ClaimedRefund claim,RuntimeException failure){
  var x=lock(claim.refundId);if(!owns(x,claim))return;var receipt=db.refundReceipt(claim.refundId);
  if(validReceipt(x.refund,receipt)){completeLocked(x,claim,receipt);return;}
  String code=receipt!=null?"RECEIPT_MISMATCH":failure instanceof RefundChannelException e?e.code():"CHANNEL_UNAVAILABLE";
  boolean terminal=receipt!=null||failure instanceof RefundChannelException e&&e.permanent()||claim.cycleAttempt>=policy.maxAttempts();
  if(terminal){dead(x,claim,code);return;}
  Instant next=clock.instant().plus(policy.backoff(claim.cycleAttempt));if(finish(claim,"PENDING",code,null,next)!=1)return;
  x.refund.lastError="渠道暂不可用，已安排退避重试";x.refund.version=CommerceService.nextVersion(x.refund.version);db.updateRefund(x.refund);audit("SYSTEM",x.refund,"refund.retry.scheduled",code,null,"FAILED");
 }
 private void dead(Locked x,ClaimedRefund claim,String code){
  if(finish(claim,"DEAD",code,null)!=1)return;x.refund.status="FAILED";x.refund.lastError=switch(code){case "AUTHORIZATION_REVOKED"->"原执行授权失效，需独立财务恢复";case "RECEIPT_MISMATCH"->"渠道回执不符，需人工对账";default->"渠道执行失败，已停止自动重试并保留退款预留";};x.refund.version=CommerceService.nextVersion(x.refund.version);db.updateRefund(x.refund);audit("SYSTEM",x.refund,"refund.dead",code,null,"FAILED");
 }
 private int finish(ClaimedRefund c,String state,String code,Instant completed){return finish(c,state,code,completed,clock.instant());}
 private int finish(ClaimedRefund c,String state,String code,Instant completed,Instant next){Instant now=clock.instant();return db.finishRefundClaim(c.refundId,c.token,c.generation,now,state,next,code,"DEAD".equals(state)?now:null,completed);}
 /** Reauthorize the same original refund/outbox; never releases or recreates the existing money reserve. */
 @Transactional(isolation=Isolation.READ_COMMITTED) public RefundRow recover(RequestActor actor,String id,long version,String reason){
  actor.requireRole("FINANCE");actor.requirePermission("refund.retry");if(version<0||version>MAX_SAFE||reason==null||reason.isBlank()||reason.length()>500)throw ApiException.invalid("恢复原因或版本不合法");
  var x=lock(id);if(x==null)throw ApiException.notFound();db.lockUser(actor.userId());if(!actor.userId().equals(db.currentFinanceSession(actor.userId(),actor.sessionId(),clock.instant())))throw ApiException.unauthorized();
  var r=x.refund;if(actor.userId().equals(x.order.userId)||actor.userId().equals(r.reviewerId)){denials.rejected(actor,id,"购买人或原审核人不得恢复同笔退款");throw ApiException.forbidden();}if(r.version!=version)throw ApiException.conflict("退款版本已变化");
  if(!"FAILED".equals(r.status)||r.executorId==null||x.lease==null||!"DEAD".equals(x.lease.status()))throw ApiException.conflict("仅失败且已停止的原退款可恢复");
  if("AFTERSALE".equals(r.type)&&(r.reviewerId==null||!r.aftersaleId.equals(db.validRefundApproval(r.aftersaleId,r.reviewerId))))throw ApiException.conflict("原审核关联已失效");
  var receipt=db.refundReceipt(id);if(receipt!=null&&!validReceipt(r,receipt))throw ApiException.conflict("渠道回执不符，需先人工对账");
  String before="executor="+r.executorId+",reviewer="+r.reviewerId+",status="+r.status;
  if(db.recoverRefundOutbox(id,x.lease.leaseGeneration(),UUID.randomUUID().toString(),clock.instant())!=1)throw ApiException.conflict("恢复任务已变化");
  r.executorId=actor.userId();r.status="PROCESSING";r.lastError=null;r.version=CommerceService.nextVersion(r.version);db.updateRefund(r);audit(actor.userId(),r,"refund.retry",reason.trim(),before,"SUCCESS");return r;
 }
 private void audit(String actor,RefundRow r,String operation,String reason,String before,String outcome){db.refundAudit(UUID.randomUUID().toString(),actor,"SYSTEM".equals(actor)?"":String.join(",",db.refundActorRoles(actor)),operation,r.refundId,reason,before,"executor="+r.executorId+",reviewer="+r.reviewerId+",status="+r.status,TraceContext.id(),clock.instant(),outcome);}
}
