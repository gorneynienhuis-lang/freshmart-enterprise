package com.freshmart.command;

import com.freshmart.common.ApiException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.*;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.*;

@SpringJUnitConfig(IdempotencyServiceTest.Config.class)
class IdempotencyServiceTest {
    @Configuration @EnableTransactionManagement @MapperScan(basePackageClasses=CommandMapper.class)
    @Import(IdempotencyService.class)
    static class Config {
        @Bean(destroyMethod="close") HikariDataSource dataSource() {
            var ds=new HikariDataSource();
            ds.setJdbcUrl("jdbc:h2:mem:commands;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000");
            ds.setMaximumPoolSize(4);
            new ResourceDatabasePopulator(new ClassPathResource("db/migration/V002__command_audit.sql")).execute(ds);
            new JdbcTemplate(ds).execute("CREATE TABLE test_effect(id VARCHAR(64) PRIMARY KEY)");
            return ds;
        }
        @Bean SqlSessionFactory sqlSessionFactory(DataSource ds) throws Exception {
            var bean=new SqlSessionFactoryBean();bean.setDataSource(ds);
            var config=new org.apache.ibatis.session.Configuration();
            config.setMapUnderscoreToCamelCase(true);config.setArgNameBasedConstructorAutoMapping(true);
            bean.setConfiguration(config);return bean.getObject();
        }
        @Bean PlatformTransactionManager tx(DataSource ds) { return new DataSourceTransactionManager(ds); }
        @Bean ObjectMapper json() { return new ObjectMapper(); }
        @Bean Clock clock() { return Clock.systemUTC(); }
    }
    record Result(String id) {}
    @Autowired IdempotencyService service;
    @Autowired DataSource dataSource;
    private static String key() { return UUID.randomUUID().toString(); }

    @Test void replaysCommittedResultWithoutRunningSideEffectAgain() {
        var calls=new AtomicInteger();var key=key();
        var first=service.execute("u1","/commands",key,"body",Result.class,()->new Result("r"+calls.incrementAndGet()));
        var second=service.execute("u1","/commands",key,"body",Result.class,()->{fail("replayed side effect");return null;});
        assertEquals(first,second);assertEquals(1,calls.get());
    }
    @Test void changedBodySameKeyIsConflictWhileDifferentActorIsIndependent() {
        var key=key();service.execute("u1","/commands",key,"a",Result.class,()->new Result("a"));
        var error=assertThrows(ApiException.class,()->service.execute("u1","/commands",key,"b",Result.class,()->new Result("b")));
        assertEquals(409,error.status());assertEquals(1008,error.code());assertEquals("IDEMPOTENCY_CONFLICT",error.errorKey());
        assertEquals("b",service.execute("u2","/commands",key,"b",Result.class,()->new Result("b")).id());
    }
    @Test void failureRollsBackBothResultAndBusinessWriteAndCanRetry() {
        var key=key();var jdbc=new JdbcTemplate(dataSource);
        assertThrows(IllegalStateException.class,()->service.execute("u3","/commands",key,"body",Result.class,()->{
            jdbc.update("INSERT INTO test_effect(id) VALUES(?)",key);throw new IllegalStateException("injected failure");
        }));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM test_effect WHERE id=?",Integer.class,key));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM fm_idempotency WHERE idempotency_key=?",Integer.class,key));
        assertEquals("done",service.execute("u3","/commands",key,"body",Result.class,()->{
            jdbc.update("INSERT INTO test_effect(id) VALUES(?)",key);return new Result("done");
        }).id());
    }
    @Test void concurrentSameKeyIsSerializedByPersistentLock() throws Exception {
        var key=key();var calls=new AtomicInteger();var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(4)) {
            Callable<Result> job=()->{gate.await();return service.execute("u4","/commands",key,"body",Result.class,()->new Result("r"+calls.incrementAndGet()));};
            var futures=List.of(pool.submit(job),pool.submit(job),pool.submit(job),pool.submit(job));
            gate.countDown();for(var f:futures) assertEquals("r1",f.get(10,TimeUnit.SECONDS).id());
        }
        assertEquals(1,calls.get());
    }
    @Test void malformedKeyNeverRunsCommand() {
        var ex=assertThrows(ApiException.class,()->service.execute("u1","/commands","1-1-1-1-1","a",Result.class,()->{fail();return null;}));
        assertEquals(400,ex.status());
    }
}
