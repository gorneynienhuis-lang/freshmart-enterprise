package com.freshmart.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Repository
public class AuditRepository {
    private final JdbcTemplate jdbc;
    public AuditRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Row(String auditId, String actorId, String roles, String action, String resourceType, String resourceId, String result, String reason, String traceId, Instant occurredAt) {}
    public record Window(String actorId, String resourceId, Instant from, Instant to) {}
    private String where(Window w, List<Object> args) {
        String sql = " FROM fm_audit_event WHERE created_at>=? AND created_at<?";
        args.add(Timestamp.from(w.from())); args.add(Timestamp.from(w.to()));
        if (w.actorId() != null) { sql += " AND actor_id=?"; args.add(w.actorId()); }
        if (w.resourceId() != null) { sql += " AND resource_id=?"; args.add(w.resourceId()); }
        return sql;
    }
    public long count(Window w) { var args = new ArrayList<Object>(); String sql = where(w, args); return jdbc.queryForObject("SELECT COUNT(*)" + sql, Long.class, args.toArray()); }
    public List<Row> list(Window w, int page, int size) {
        var args = new ArrayList<Object>(); String sql = where(w, args); args.add(size); args.add((long)(page - 1) * size);
        return jdbc.query("SELECT *" + sql + " ORDER BY created_at DESC,event_id DESC LIMIT ? OFFSET ?", (rs, index) -> new Row(rs.getString("event_id"),rs.getString("actor_id"),rs.getString("actor_roles_snapshot"),rs.getString("operation"),rs.getString("resource_type"),rs.getString("resource_id"),rs.getString("outcome"),rs.getString("reason"),rs.getString("trace_id"),rs.getTimestamp("created_at").toInstant()), args.toArray());
    }
}
