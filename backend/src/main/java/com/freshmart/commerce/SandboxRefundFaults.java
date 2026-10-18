package com.freshmart.commerce;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.Set;

/** No HTTP control. A private per-refund plan only works in an explicitly enabled loopback demo/test. */
@Component
public class SandboxRefundFaults {
 public enum Mode { TRANSIENT_BEFORE_COMMIT,REJECT_BEFORE_COMMIT,ACK_LOST_AFTER_COMMIT }
 public record Plan(String refundId,String mode,int remainingFailures,int triggeredCount){}
 private final CommerceMapper db;private final Clock clock;private final boolean enabled;
 public SandboxRefundFaults(CommerceMapper db,Clock clock,Environment env,SandboxSignature sandbox,
                           @Value("${app.sandbox-refund-faults-enabled:false}")boolean enabled,@Value("${server.address:}")String address){
  if(enabled&&(!sandbox.enabled()||!env.acceptsProfiles(Profiles.of("demo","test"))||env.acceptsProfiles(Profiles.of("prod","production","showcase"))||!Set.of("127.0.0.1","::1","0:0:0:0:0:0:0:1","localhost").contains(address)))throw new IllegalStateException("Refund faults require an explicit loopback demo/test sandbox");
  this.db=db;this.clock=clock;this.enabled=enabled;
 }
 public boolean enabled(){return enabled;}
 /** Isolated integration fixtures may configure a real channel failure; they may not forge FAILED refunds. */
 @Transactional public void arm(String refundId,Mode mode,int count){
  if(!enabled)throw new IllegalStateException("Private refund fault injection is disabled");
  if(refundId==null||!refundId.matches("[A-Za-z0-9_-]{1,64}")||mode==null||count<1||count>100)throw new IllegalArgumentException("Invalid private fault plan");
  db.armRefundFault(refundId,mode.name(),count,clock.instant());
 }
 /** Return a decision, then throw outside this transaction so consumption stays committed across a lost response. */
 @Transactional(propagation=Propagation.REQUIRES_NEW)
 public Mode consume(String refundId,boolean afterCommit){
  if(!enabled)return null;var row=db.lockRefundFault(refundId);if(row==null||row.remainingFailures()==0)return null;
  var mode=Mode.valueOf(row.mode());if((mode==Mode.ACK_LOST_AFTER_COMMIT)!=afterCommit)return null;
  if(db.consumeRefundFault(refundId,row.triggeredCount(),clock.instant())!=1)throw new IllegalStateException("Fault plan consumption lost");
  db.refundAudit(java.util.UUID.randomUUID().toString(),"SYSTEM_FAULT_TEST","","sandbox.refund.fault",refundId,mode.name(),null,"trigger="+(row.triggeredCount()+1),com.freshmart.common.TraceContext.id(),clock.instant(),"FAILED");
  return mode;
 }
}
