package com.freshmart.observability;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;

@Service
public class BusinessMetricsSource {
    public record Snapshot(BusinessMetricsMapper.Outbox outbox, long failedRefunds, BusinessMetricsMapper.Inventory inventory, Instant capturedAt) {}
    private final BusinessMetricsMapper mapper;
    private final Clock clock;
    public BusinessMetricsSource(BusinessMetricsMapper mapper, Clock clock) { this.mapper=mapper; this.clock=clock; }
    @Transactional(readOnly=true, timeout=5)
    public Snapshot read() {
        Instant now=clock.instant();
        var outbox=mapper.outbox(now); long refunds=mapper.failedRefunds(); var inventory=mapper.inventory();
        return new Snapshot(outbox,refunds,inventory,clock.instant());
    }
}
