package com.freshmart.commerce;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import static com.freshmart.commerce.CommerceModels.*;

@Service
public class RefundProcessor {
    private final CommerceMapper db;private final CommerceService orders;private final Clock clock;private final com.freshmart.aftersale.AfterSaleCompletionService aftersales;
    public RefundProcessor(CommerceMapper db,CommerceService orders,Clock clock,com.freshmart.aftersale.AfterSaleCompletionService aftersales){this.db=db;this.orders=orders;this.clock=clock;this.aftersales=aftersales;}
    @Transactional
    public RefundRow claim(String id){var lookup=db.refund(id);if(lookup==null)return null;var order=db.lockOrder(lookup.orderId);var r=db.lockRefund(id);
        if("SUCCESS".equals(r.status)||r.executorId==null||("AFTERSALE".equals(r.type)&&r.executorId.equals(r.reviewerId)))return null;
        if("AFTERSALE".equals(r.type)&&(r.reviewerId==null||r.executorId.equals(order.userId)||db.activeRole(r.executorId,"FINANCE")!=1||db.matchesReviewer(r.aftersaleId,r.reviewerId)!=1)){
            db.retryOutbox(id,clock.instant().plusSeconds(60));return null;
        }
        if(db.claimRefund(id,clock.instant(),clock.instant().plusSeconds(30))!=1)return null;
        r.status="PROCESSING";r.version++;db.updateRefund(r);return r;}
    @Transactional
    public void complete(String id){var lookup=db.refund(id);if(lookup==null)return;var o=db.lockOrder(lookup.orderId);var p=db.lockPayment(lookup.paymentId);var r=db.lockRefund(id);
        if("SUCCESS".equals(r.status)){db.completeOutbox(id,clock.instant());aftersales.completeRefund(id);return;}
        if(!"PROCESSING".equals(r.status)||r.executorId==null||!Long.valueOf(r.amount).equals(db.receiptAmount(id)))throw new IllegalStateException("No verified channel receipt");
        p.refundReserved-=r.amount;p.refundedAmount+=r.amount;p.version++;db.updatePayment(p);
        r.status="SUCCESS";r.completedAt=clock.instant();r.version++;r.lastError=null;db.updateRefund(r);db.completeOutbox(id,clock.instant());
        if(p.accepted)o.refundedAmount+=r.amount;
        if("REFUND_PENDING".equals(o.adjustmentStatus)){
            long total=db.refunds(o.orderId).stream().filter(x->o.adjustmentId.equals(x.adjustmentId)&&"SUCCESS".equals(x.status)).mapToLong(x->x.amount).sum();
            if(total==-o.adjustmentDelta)o.adjustmentStatus="REFUNDED";
        }
        orders.touch(o);aftersales.completeRefund(id);orders.audit(o,"SYSTEM","refund.success","沙箱退款渠道回执已验证");
    }
    @Transactional
    public void retryLater(String id){db.retryOutbox(id,clock.instant().plusSeconds(10));}
}
