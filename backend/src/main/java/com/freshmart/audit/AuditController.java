package com.freshmart.audit;

import com.freshmart.common.*;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;

@RestController
public class AuditController {
    private final AuditService service;
    public AuditController(AuditService service) { this.service = service; }
    @GetMapping("/api/v1/admin/audit-logs")
    public ApiEnvelope<?> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,
                              @RequestParam(required=false) String actorId,@RequestParam(required=false) String resourceId,
                              @RequestParam(required=false) Instant from,@RequestParam(required=false) Instant to) {
        return ApiEnvelope.ok(service.list(RequestActor.current(),page,size,actorId,resourceId,from,to));
    }
}
