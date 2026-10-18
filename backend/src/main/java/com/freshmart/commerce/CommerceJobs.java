package com.freshmart.commerce;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;import org.slf4j.LoggerFactory;
import java.time.Clock;

@Component @EnableScheduling
@ConditionalOnProperty(name="app.commerce-jobs-enabled",havingValue="true",matchIfMissing=true)
public class CommerceJobs {
    private static final Logger log=LoggerFactory.getLogger(CommerceJobs.class);
    private final CommerceMapper db;private final CommerceService orders;private final RefundProcessor refunds;
    private final SandboxRefundGateway gateway;private final SandboxSignature sandbox;private final Clock clock;
    public CommerceJobs(CommerceMapper db,CommerceService orders,RefundProcessor refunds,SandboxRefundGateway gateway,SandboxSignature sandbox,Clock clock){this.db=db;this.orders=orders;this.refunds=refunds;this.gateway=gateway;this.sandbox=sandbox;this.clock=clock;}
    @Scheduled(fixedDelayString="${app.commerce-job-delay-ms:2000}",initialDelay=2000)
    public void run(){
        for(var order:db.dueOrders(clock.instant()))try{orders.expire(order.orderId);}catch(RuntimeException e){log.warn("Order expiration retry type={}",e.getClass().getSimpleName());}
        if(!sandbox.enabled())return;
        for(String id:db.dueRefunds(clock.instant())){
            RefundProcessor.ClaimedRefund claim=null;
            try{claim=refunds.claim(id);if(claim!=null){gateway.execute(claim);refunds.complete(claim);}}
            catch(RuntimeException e){
                if(claim!=null)try{refunds.failed(claim,e);}catch(RuntimeException recovery){log.warn("Refund failure bookkeeping retry type={}",recovery.getClass().getSimpleName());}
                log.warn("Sandbox refund execution failure type={}",e.getClass().getSimpleName());
            }
        }
    }
}
