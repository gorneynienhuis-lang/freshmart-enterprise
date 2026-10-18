package com.freshmart.commerce;

import com.freshmart.common.TraceContext;
import com.freshmart.common.RequestActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.Clock;
import java.util.UUID;

@Service
public class FulfillmentDenialAudit {
 private final FulfillmentMapper mapper;private final Clock clock;
 public FulfillmentDenialAudit(FulfillmentMapper mapper,Clock clock){this.mapper=mapper;this.clock=clock;}
 @Transactional(propagation=Propagation.REQUIRES_NEW)
 public void rejected(RequestActor actor,String task,String operation,String code){String target=task!=null&&task.matches("[A-Za-z0-9_-]{1,64}")?task:"unknown";mapper.audit(UUID.randomUUID().toString(),actor.userId(),operation+".denied","FULFILLMENT",target,code,null,null,TraceContext.id(),clock.instant(),String.join(",",actor.roles().stream().sorted().toList()),"DENIED");}
}
