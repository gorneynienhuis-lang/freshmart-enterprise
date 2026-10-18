package com.freshmart.identity;

import com.freshmart.common.TraceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.time.Clock;
import java.util.UUID;

/** Persists rejected governance decisions even when the command transaction rolls back. */
@Service
public class EmployeeDenialAudit {
 private final EmployeeMapper employees; private final Clock clock;
 public EmployeeDenialAudit(EmployeeMapper employees,Clock clock){this.employees=employees;this.clock=clock;}
 @Transactional(propagation=Propagation.REQUIRES_NEW)
 public void rejected(String actor,String target,String code){employees.audit(UUID.randomUUID().toString(),actor,"employee.command.denied",target,code,null,null,TraceContext.id(),clock.instant());}
}
