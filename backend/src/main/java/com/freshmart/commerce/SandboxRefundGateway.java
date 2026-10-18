package com.freshmart.commerce;

import org.springframework.stereotype.Service;
import static com.freshmart.commerce.CommerceModels.*;

/** Persistent local sandbox channel, deliberately a separate transaction from merchant completion. */
@Service
public class SandboxRefundGateway {
    private final CommerceMapper db;private final SandboxSignature sandbox;private final SandboxRefundReceiptStore receipts;private final SandboxRefundFaults faults;
    public SandboxRefundGateway(CommerceMapper db,SandboxSignature sandbox,SandboxRefundReceiptStore receipts,SandboxRefundFaults faults){this.db=db;this.sandbox=sandbox;this.receipts=receipts;this.faults=faults;}
    // Deliberately no surrounding transaction: an ACK loss must not roll back a successful channel receipt.
    public void execute(RefundRow refund){
        sandbox.requireEnabled();if(!(refund instanceof RefundProcessor.ClaimedRefund claim))throw new IllegalArgumentException("A fenced refund claim is required");
        if(db.receiptAmount(refund.refundId)!=null)return;
        var before=faults.consume(refund.refundId,false);
        if(before==SandboxRefundFaults.Mode.REJECT_BEFORE_COMMIT)throw new RefundChannelException("CHANNEL_REJECTED",true);
        if(before==SandboxRefundFaults.Mode.TRANSIENT_BEFORE_COMMIT)throw new RefundChannelException("CHANNEL_TIMEOUT",false);
        receipts.record(claim);
        if(faults.consume(refund.refundId,true)==SandboxRefundFaults.Mode.ACK_LOST_AFTER_COMMIT)throw new RefundChannelException("CHANNEL_ACK_LOST",false);
    }
}
