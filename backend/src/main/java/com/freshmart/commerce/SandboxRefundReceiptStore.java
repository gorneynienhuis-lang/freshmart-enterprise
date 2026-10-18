package com.freshmart.commerce;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;

/** The simulated channel's durable success fact commits separately from the adapter response and merchant books. */
@Service
public class SandboxRefundReceiptStore {
 private final CommerceMapper db;private final RefundProcessor processor;private final Clock clock;
 public SandboxRefundReceiptStore(CommerceMapper db,RefundProcessor processor,Clock clock){this.db=db;this.processor=processor;this.clock=clock;}
 @Transactional(propagation=Propagation.REQUIRES_NEW,isolation=Isolation.READ_COMMITTED)
 public void record(RefundProcessor.ClaimedRefund claim){
  // Current lease and current authorization are locked through the channel fact commit.
  if(!processor.authorizeSend(claim))return;
  claim.completedAt=clock.instant();db.sandboxReceipt(claim);
  var receipt=db.refundReceipt(claim.refundId);if(receipt==null||!claim.paymentId.equals(receipt.paymentId())||!claim.refundId.equals(receipt.channelRefundNo())||claim.amount!=receipt.amount())throw new RefundChannelException("RECEIPT_MISMATCH",true);
 }
}
