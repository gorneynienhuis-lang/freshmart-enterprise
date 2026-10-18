package com.freshmart.observability;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BusinessMetricsCollectorTest {
    static final class MutableClock extends Clock {
        Instant now=Instant.parse("2026-10-18T06:00:00Z");
        public Instant instant(){return now;}public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId zone){return this;}
    }
    @Test void cachesLastGoodSnapshotAndExposesFailureWithoutFalseGreen() {
        var source=mock(BusinessMetricsSource.class);var clock=new MutableClock();var registry=new SimpleMeterRegistry();
        var collector=new BusinessMetricsCollector(source,registry,clock,10000);
        assertEquals(0,gauge(registry,"freshmall.business.snapshot.collection.success"));
        var snapshot=new BusinessMetricsSource.Snapshot(new BusinessMetricsMapper.Outbox(3,2,1,1,clock.now.minusSeconds(180)),2,new BusinessMetricsMapper.Inventory(1,2),clock.now);
        when(source.read()).thenReturn(snapshot).thenThrow(new IllegalStateException("synthetic SQL failure must not be logged"));
        collector.collect();
        assertEquals(3,registry.get("freshmall.outbox.events").tag("state","PENDING").gauge().value());
        assertEquals(2,registry.get("freshmall.outbox.events").tag("state","PROCESSING").gauge().value());
        assertEquals(1,registry.get("freshmall.outbox.events").tag("state","DEAD").gauge().value());
        assertEquals(180,gauge(registry,"freshmall.outbox.oldest.pending.age"));
        assertEquals(1,gauge(registry,"freshmall.outbox.processing.overdue"));assertEquals(2,gauge(registry,"freshmall.refund.failed"));
        assertEquals(1,gauge(registry,"freshmall.inventory.negative.stock.batches"));assertEquals(2,gauge(registry,"freshmall.inventory.invariant.violations"));
        double timestamp=gauge(registry,"freshmall.business.snapshot.last.success.timestamp");clock.now=clock.now.plusSeconds(30);collector.collect();
        assertEquals(0,gauge(registry,"freshmall.business.snapshot.collection.success"));assertEquals(timestamp,gauge(registry,"freshmall.business.snapshot.last.success.timestamp"));
        assertEquals(210,gauge(registry,"freshmall.outbox.oldest.pending.age"));assertEquals(2,gauge(registry,"freshmall.refund.failed"));
        assertEquals(1,registry.get("freshmall.business.snapshot.collections").tag("result","success").counter().count());
        assertEquals(1,registry.get("freshmall.business.snapshot.collections").tag("result","failure").counter().count());
        Set<String> labelKeys=new HashSet<>();registry.getMeters().forEach(meter->meter.getId().getTags().forEach(tag->labelKeys.add(tag.getKey())));
        assertEquals(Set.of("state","result"),labelKeys);assertEquals(12,registry.getMeters().size());collector.stop();registry.close();
    }
    @Test void idleOrFutureCreatedTimesNeverProduceNegativeAgeAndIntervalsAreBounded(){
        var source=mock(BusinessMetricsSource.class);var clock=new MutableClock();var registry=new SimpleMeterRegistry();var collector=new BusinessMetricsCollector(source,registry,clock,1000);
        when(source.read()).thenReturn(new BusinessMetricsSource.Snapshot(new BusinessMetricsMapper.Outbox(0,0,0,0,null),0,new BusinessMetricsMapper.Inventory(0,0),clock.now));collector.collect();assertEquals(0,gauge(registry,"freshmall.outbox.oldest.pending.age"));
        when(source.read()).thenReturn(new BusinessMetricsSource.Snapshot(new BusinessMetricsMapper.Outbox(1,0,0,0,clock.now.plusSeconds(20)),0,new BusinessMetricsMapper.Inventory(0,0),clock.now));collector.collect();assertEquals(0,gauge(registry,"freshmall.outbox.oldest.pending.age"));
        assertThrows(IllegalArgumentException.class,()->new BusinessMetricsCollector(source,registry,clock,999));assertThrows(IllegalArgumentException.class,()->new BusinessMetricsCollector(source,registry,clock,60001));collector.stop();registry.close();
    }
    static double gauge(SimpleMeterRegistry registry,String name){return registry.get(name).gauge().value();}
}
