package com.freshmart.observability;

import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.*;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.sql.Timestamp;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** Minimal isolated H2 tables intentionally omit constraints to test defensive legacy-corruption gauges.
 * This fixture never connects to the running MySQL application or injects a real business fault. */
class BusinessMetricsMapperTest {
    @Test void aggregatesActualRowsAndIgnoresRetryAvailableTimeForOldestAge() {
        var ds=new DriverManagerDataSource("jdbc:h2:mem:metrics-"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");var jdbc=new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE fm_outbox(event_type VARCHAR(32),status VARCHAR(32),lease_until TIMESTAMP,available_at TIMESTAMP,created_at TIMESTAMP)");
        jdbc.execute("CREATE TABLE fm_refund(status VARCHAR(32))");
        jdbc.execute("CREATE TABLE fm_inventory_batch(on_hand BIGINT,reserved BIGINT,quarantined BIGINT,lifecycle_status VARCHAR(32))");
        var config=new Configuration(new Environment("test",new JdbcTransactionFactory(),ds));config.setMapUnderscoreToCamelCase(true);config.setArgNameBasedConstructorAutoMapping(true);config.setLocalCacheScope(LocalCacheScope.STATEMENT);config.addMapper(BusinessMetricsMapper.class);
        var factory=new SqlSessionFactoryBuilder().build(config);Instant now=Instant.parse("2026-10-18T06:00:00Z");
        try(var session=factory.openSession()){
            var mapper=session.getMapper(BusinessMetricsMapper.class);assertEquals(0,mapper.outbox(now).pending());assertNull(mapper.outbox(now).oldestPendingCreatedAt());assertEquals(0,mapper.inventory().invariantViolations());
            row(jdbc,"PENDING",null,now.plusSeconds(600),now.minusSeconds(600));row(jdbc,"PROCESSING",now.minusSeconds(1),now,now.minusSeconds(300));row(jdbc,"PROCESSING",now.plusSeconds(10),now,now.minusSeconds(200));row(jdbc,"PROCESSING",null,now,now.minusSeconds(100));
            row(jdbc,"DEAD",null,now,now.minusSeconds(3600));row(jdbc,"COMPLETED",null,now,now.minusSeconds(7200));
            jdbc.update("INSERT INTO fm_outbox VALUES('UNRELATED','PENDING',NULL,?,?)",Timestamp.from(now),Timestamp.from(now.minusSeconds(10000)));
            jdbc.update("INSERT INTO fm_refund VALUES('FAILED'),('SUCCESS'),('PROCESSING'),('FAILED')");
            jdbc.update("INSERT INTO fm_inventory_batch VALUES(10,2,1,'NORMAL'),(-1,0,0,'NORMAL'),(10,9,2,'NORMAL'),(10,0,9,'QUARANTINED'),(1,0,0,'DISPOSED'),(10,0,10,'QUARANTINED'),(0,0,0,'DISPOSED')");
            var outbox=mapper.outbox(now);assertEquals(1,outbox.pending());assertEquals(3,outbox.processing());assertEquals(1,outbox.dead());assertEquals(2,outbox.processingOverdue());assertEquals(now.minusSeconds(600),outbox.oldestPendingCreatedAt());
            assertEquals(2,mapper.failedRefunds());assertEquals(1,mapper.inventory().negative());assertEquals(4,mapper.inventory().invariantViolations());
        }
    }
    void row(JdbcTemplate jdbc,String status,Instant lease,Instant available,Instant created){jdbc.update("INSERT INTO fm_outbox VALUES('SANDBOX_REFUND',?,?,?,?)",status,lease==null?null:Timestamp.from(lease),Timestamp.from(available),Timestamp.from(created));}
}
