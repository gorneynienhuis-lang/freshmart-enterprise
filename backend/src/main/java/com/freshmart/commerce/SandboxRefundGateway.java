package com.freshmart.commerce;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import static com.freshmart.commerce.CommerceModels.*;

/** Persistent local sandbox channel, deliberately a separate transaction from merchant completion. */
@Service
public class SandboxRefundGateway {
    private final CommerceMapper db;private final SandboxSignature sandbox;private final Clock clock;
    public SandboxRefundGateway(CommerceMapper db,SandboxSignature sandbox,Clock clock){this.db=db;this.sandbox=sandbox;this.clock=clock;}
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void execute(RefundRow refund){sandbox.requireEnabled();refund.completedAt=clock.instant();db.sandboxReceipt(refund);
        if(!Long.valueOf(refund.amount).equals(db.receiptAmount(refund.refundId)))throw new IllegalStateException("Sandbox refund receipt mismatch");}
}
