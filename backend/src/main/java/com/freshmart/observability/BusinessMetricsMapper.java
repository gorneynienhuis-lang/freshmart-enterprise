package com.freshmart.observability;

import org.apache.ibatis.annotations.*;
import java.time.Instant;

/** Aggregate-only reads: never load owner IDs, paths, payloads, amounts or credentials for metrics. */
@Mapper
public interface BusinessMetricsMapper {
    record Outbox(long pending, long processing, long dead, long processingOverdue, Instant oldestPendingCreatedAt) {}
    record Inventory(long negative, long invariantViolations) {}
    @Select("SELECT COALESCE(SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END),0) AS pending," +
            "COALESCE(SUM(CASE WHEN status='PROCESSING' THEN 1 ELSE 0 END),0) AS processing," +
            "COALESCE(SUM(CASE WHEN status='DEAD' THEN 1 ELSE 0 END),0) AS dead," +
            "COALESCE(SUM(CASE WHEN status='PROCESSING' AND (lease_until IS NULL OR lease_until<=#{now}) THEN 1 ELSE 0 END),0) AS processing_overdue," +
            "MIN(CASE WHEN status IN ('PENDING','PROCESSING') THEN created_at ELSE NULL END) AS oldest_pending_created_at " +
            "FROM fm_outbox WHERE event_type='SANDBOX_REFUND'")
    @Options(timeout=2) Outbox outbox(Instant now);
    @Select("SELECT COUNT(*) FROM fm_refund WHERE status='FAILED'")
    @Options(timeout=2) long failedRefunds();
    @Select("SELECT COALESCE(SUM(CASE WHEN on_hand<0 OR reserved<0 OR quarantined<0 THEN 1 ELSE 0 END),0) AS negative," +
            "COALESCE(SUM(CASE WHEN on_hand<0 OR reserved<0 OR quarantined<0 OR reserved+quarantined>on_hand " +
            "OR (lifecycle_status='QUARANTINED' AND (reserved<>0 OR quarantined<>on_hand)) " +
            "OR (lifecycle_status='DISPOSED' AND (on_hand<>0 OR reserved<>0 OR quarantined<>0)) THEN 1 ELSE 0 END),0) AS invariant_violations " +
            "FROM fm_inventory_batch")
    @Options(timeout=2) Inventory inventory();
}
