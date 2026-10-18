package com.freshmart.aftersale;
import com.freshmart.common.TraceContext;
import com.freshmart.common.RequestActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.Clock;
import java.util.UUID;
@Service
public class AfterSaleDenialAudit {
 private final AfterSaleMapper mapper;private final Clock clock;
 public AfterSaleDenialAudit(AfterSaleMapper mapper,Clock clock){this.mapper=mapper;this.clock=clock;}
 @Transactional(propagation=Propagation.REQUIRES_NEW)
 public void rejected(RequestActor actor,String target,String reason){mapper.audit(UUID.randomUUID().toString(),actor.userId(),"aftersale.authorization.denied",target,reason,TraceContext.id(),clock.instant(),String.join(",",actor.roles().stream().sorted().toList()),"DENIED");}
}
