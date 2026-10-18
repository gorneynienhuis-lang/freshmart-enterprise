package com.freshmart.audit;

import com.freshmart.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class AuditService {
    private final AuditRepository repository;
    private final AuditRecorder recorder;
    private final Clock clock;
    private static final Set<String> ROLES = Set.of("MEMBER","PICKER","COURIER","OPERATOR","SERVICE","FINANCE","ADMIN");
    public AuditService(AuditRepository repository, AuditRecorder recorder, Clock clock) { this.repository = repository; this.recorder = recorder; this.clock = clock; }
    public record View(String auditId,String actorId,List<String> actorRoles,String action,String resourceType,String resourceId,String result,String reason,String traceId,Instant occurredAt) {}
    @Transactional
    public PageResult<View> list(RequestActor actor, int page, int size, String actorId, String resourceId, Instant from, Instant to) {
        actor.requirePermission("audit.read");
        if (page < 1 || size < 1 || size > 100) throw ApiException.invalid("分页参数无效");
        for (String id : new String[]{actorId, resourceId}) if (id != null && !id.matches("[A-Za-z0-9_-]{1,64}")) throw ApiException.invalid("审计查询标识无效");
        Instant upper = to == null ? clock.instant().plusNanos(1000) : to;
        Instant lower = from == null ? upper.minus(Duration.ofDays(7)) : from;
        if (!lower.isBefore(upper) || Duration.between(lower,upper).compareTo(Duration.ofDays(31)) > 0 || upper.isAfter(clock.instant().plusSeconds(300)))
            throw ApiException.invalid("审计时间范围须在31天内，且不能查询未来时间");
        var window = new AuditRepository.Window(actorId, resourceId, lower, upper);
        long total = repository.count(window);
        var rows = repository.list(window,page,size).stream().map(row -> new View(row.auditId(),row.actorId(),row.roles() == null || row.roles().isEmpty() ? List.of() : Arrays.stream(row.roles().split(",")).filter(ROLES::contains).sorted().toList(), row.action(), row.resourceType(), row.resourceId(), row.result() == null ? "UNKNOWN" : row.result(), SafeAuditText.redact(row.reason()), row.traceId(), row.occurredAt())).toList();
        recorder.record(actor,"audit.query","AUDIT",TraceContext.id(),"SUCCESS","查询脱敏审计，时间窗和分页已校验");
        return new PageResult<>(page,size,total,rows);
    }
}
