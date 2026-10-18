package com.freshmart.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;import org.slf4j.LoggerFactory;
import java.time.*;
import java.util.concurrent.*;

/** Cached gauges keep scrape HTTP independent from SQL and from the commerce scheduler thread. */
@Component
@ConditionalOnProperty(name="app.monitoring-enabled",havingValue="true")
public class BusinessMetricsCollector {
    private static final Logger log=LoggerFactory.getLogger(BusinessMetricsCollector.class);
    private final BusinessMetricsSource source; private final Clock clock; private final long delay;
    private final Counter success, failure;
    private volatile BusinessMetricsSource.Snapshot snapshot=new BusinessMetricsSource.Snapshot(new BusinessMetricsMapper.Outbox(0,0,0,0,null),0,new BusinessMetricsMapper.Inventory(0,0),Instant.EPOCH);
    private volatile boolean collectionSuccess;
    private ScheduledExecutorService executor;
    public BusinessMetricsCollector(BusinessMetricsSource source, MeterRegistry registry, Clock clock,
                                     @Value("${app.metrics-snapshot-delay-ms:10000}") long delay) {
        if(delay<1000||delay>60000)throw new IllegalArgumentException("Monitoring interval is out of range");
        this.source=source;this.clock=clock;this.delay=delay;
        Gauge.builder("freshmall.outbox.events",this,c->c.snapshot.outbox().pending()).tag("state","PENDING").register(registry);
        Gauge.builder("freshmall.outbox.events",this,c->c.snapshot.outbox().processing()).tag("state","PROCESSING").register(registry);
        Gauge.builder("freshmall.outbox.events",this,c->c.snapshot.outbox().dead()).tag("state","DEAD").register(registry);
        Gauge.builder("freshmall.outbox.processing.overdue",this,c->c.snapshot.outbox().processingOverdue()).register(registry);
        Gauge.builder("freshmall.outbox.oldest.pending.age",this,BusinessMetricsCollector::oldestAge).baseUnit("seconds").register(registry);
        Gauge.builder("freshmall.refund.failed",this,c->c.snapshot.failedRefunds()).register(registry);
        Gauge.builder("freshmall.inventory.negative.stock.batches",this,c->c.snapshot.inventory().negative()).register(registry);
        Gauge.builder("freshmall.inventory.invariant.violations",this,c->c.snapshot.inventory().invariantViolations()).register(registry);
        Gauge.builder("freshmall.business.snapshot.collection.success",this,c->c.collectionSuccess?1:0).register(registry);
        Gauge.builder("freshmall.business.snapshot.last.success.timestamp",this,c->c.snapshot.capturedAt().getEpochSecond()).baseUnit("seconds").register(registry);
        success=Counter.builder("freshmall.business.snapshot.collections").tag("result","success").register(registry);
        failure=Counter.builder("freshmall.business.snapshot.collections").tag("result","failure").register(registry);
    }
    private double oldestAge(){Instant value=snapshot.outbox().oldestPendingCreatedAt();return value==null?0:Math.max(0,Duration.between(value,clock.instant()).toMillis()/1000.0);}
    @EventListener(ApplicationReadyEvent.class)
    public synchronized void start(){if(executor!=null)return;executor=Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"freshmall-metrics-snapshot");t.setDaemon(true);return t;});executor.scheduleWithFixedDelay(this::collect,0,delay,TimeUnit.MILLISECONDS);}
    void collect(){try{var candidate=source.read();snapshot=candidate;collectionSuccess=true;success.increment();}catch(RuntimeException error){collectionSuccess=false;failure.increment();log.warn("Business metrics collection failed type={}",error.getClass().getSimpleName());}}
    @PreDestroy public synchronized void stop(){if(executor!=null)executor.shutdownNow();}
}
