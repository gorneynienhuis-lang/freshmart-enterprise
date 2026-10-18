package com.freshmart.finance;

import com.freshmart.command.IdempotencyService;
import com.freshmart.common.RequestActor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;

/** The command ledger and every reconciliation read share one consistent snapshot. */
@Service
public class FinanceCommands {
    private final IdempotencyService commands;
    private final FinanceService service;
    public FinanceCommands(IdempotencyService commands, FinanceService service) {this.commands=commands;this.service=service;}
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public FinanceModels.Reconciliation create(RequestActor actor, LocalDate day, String key) {
        actor.requirePermission("reconciliation.run");
        return commands.execute(actor.userId(),"POST /api/v1/admin/reconciliations",key,day.toString(),FinanceModels.Reconciliation.class,()->service.reconcile(actor,day));
    }
}
