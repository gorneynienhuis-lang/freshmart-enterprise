package com.freshmart.audit;

import com.freshmart.common.RequestActor;
import com.freshmart.common.TraceContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.UUID;

@Service
public class AuditRecorder {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public AuditRecorder(JdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }
    public void record(RequestActor actor, String operation, String type, String target, String outcome, String reason) {
        write(actor == null ? "ANONYMOUS" : actor.userId(), actor == null ? "" : String.join(",", actor.roles().stream().sorted().toList()), operation, type, target, outcome, reason);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void denied(RequestActor actor, String operation, String target, String reason) {
        record(actor, operation, "API", target, "DENIED", reason);
    }
    private void write(String actor, String roles, String operation, String type, String target, String outcome, String reason) {
        jdbc.update("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID().toString(), actor, operation, type, target, SafeAuditText.redact(reason), TraceContext.id(), Timestamp.from(clock.instant()), roles, outcome);
    }
}
