package com.freshmart.finance;

import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController @RequestMapping("/api/v1/admin/reconciliations")
public class FinanceController {
    private final FinanceService service;
    private final FinanceCommands commands;
    public FinanceController(FinanceService service,FinanceCommands commands) { this.service=service;this.commands=commands; }
    @GetMapping public ApiEnvelope<?> list(@RequestParam(required=false) LocalDate businessDate,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size) {return ApiEnvelope.ok(service.list(RequestActor.current(),businessDate,page,size));}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ApiEnvelope<?> create(@Valid @RequestBody FinanceModels.Request body,HttpServletRequest request) {
        RequestActor actor=RequestActor.current(request);
        return ApiEnvelope.ok(commands.create(actor,body.businessDate(),CommandHeaders.requireIdempotencyKey(request)));
    }
}
