package com.freshmart.cache;

import com.freshmart.catalog.CatalogService.CategoryView;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Unit boundary tests only; real Redis evidence is recorded separately, never inferred from mocks. */
class PublicCategoryCacheTest {
    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private SimpleMeterRegistry meters;
    private AtomicLong nanos;
    private PublicCategoryCache cache;
    private static final String SECRET = "cache-test-only-secret-with-at-least-32-characters";
    private static final String DB = "jdbc:mysql://127.0.0.1:3306/isolated_test";
    private static final String ORIGIN = "http://localhost:18080";
    private static final List<CategoryView> ROWS = List.of(new CategoryView("fruit", "FRUIT", "新鲜水果", "水果", ORIGIN + "/catalog/fruit.jpg", 1));

    @SuppressWarnings("unchecked")
    @BeforeEach void setup() {
        redis = mock(StringRedisTemplate.class); values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        meters = new SimpleMeterRegistry(); nanos = new AtomicLong(1000000000L);
        cache = make(true);
    }
    private PublicCategoryCache make(boolean enabled) {
        return new PublicCategoryCache(redis, meters, enabled, Duration.ofSeconds(60), Duration.ofSeconds(5),
                Duration.ofSeconds(3), SECRET, DB, ORIGIN, nanos::get);
    }
    private String key() { return CatalogCacheIdentity.namespace(SECRET, DB, ORIGIN) + ":public:categories"; }
    private String stored() {
        var capture = ArgumentCaptor.forClass(String.class);
        verify(values).set(eq(key()), capture.capture(), any(Duration.class)); return capture.getValue();
    }
    private double count(String result) { return meters.get("freshmall.catalog.cache").tag("result", result).counter().count(); }

    @Test void missStoresTypedPublicFieldsWithBoundedAtomicExpiryAndHitAvoidsDatabase() {
        assertEquals(ROWS, cache.getOrLoad(() -> ROWS));
        var ttl = ArgumentCaptor.forClass(Duration.class);
        verify(values).set(eq(key()), anyString(), ttl.capture());
        assertTrue(ttl.getValue().toMillis() >= 55000 && ttl.getValue().toMillis() <= 65000);
        String payload = stored();
        assertFalse(payload.contains(SECRET)); assertFalse(payload.contains(DB));
        assertFalse(payload.contains("price")); assertFalse(payload.contains("stock"));
        when(values.get(key())).thenReturn(payload);
        assertEquals(ROWS, cache.getOrLoad(() -> { throw new AssertionError("A cache hit must not read MySQL"); }));
        assertEquals(1, count("db_load")); assertEquals(1, count("hit"));
    }

    @Test void corruptUnknownFieldsDuplicateKeysWrongIdentityAndCoercedTypesAreReplaced() {
        cache.getOrLoad(() -> ROWS); String valid = stored();
        for (String invalid : List.of("not json", "{}", valid + " {}", valid.replace("\"schemaVersion\":1", "\"schemaVersion\":2"),
                valid.replace("\"identity\":", "\"extra\":0,\"identity\":"),
                valid.replace("\"schemaVersion\":1", "\"schemaVersion\":1,\"schemaVersion\":1"),
                valid.replace("\"schemaVersion\":1", "\"schemaVersion\":\"1\""),
                valid.replace("\"sortOrder\":1", "\"sortOrder\":1.5"),
                valid.replace("\"sortOrder\":1", "\"sortOrder\":null"),
                valid.replace("\"sortOrder\":1", "\"sortOrder\":-1"),
                valid.replace("\"fruit\"", "\"../private\""),
                valid.replace("\"新鲜水果\"", "null"),
                valid.replace(CatalogCacheIdentity.namespace(SECRET, DB, ORIGIN), "wrong-identity"),
                "x".repeat(65537))) {
            when(values.get(key())).thenReturn(invalid);
            assertEquals(ROWS, cache.getOrLoad(() -> ROWS));
        }
        assertEquals(14, count("invalid")); assertEquals(0, count("hit"));
    }

    @Test void getFailureReturnsDatabaseAndCooldownSkipsRedisThenRecovers() {
        when(values.get(key())).thenThrow(new RedisConnectionFailureException("Secret-like error messages must not be logged"));
        assertEquals(ROWS, cache.getOrLoad(() -> ROWS));
        assertEquals(ROWS, cache.getOrLoad(() -> ROWS));
        verify(values, times(1)).get(key()); verify(values, never()).set(anyString(), anyString(), any(Duration.class));
        assertEquals(1, count("bypass"));
        nanos.addAndGet(Duration.ofSeconds(4).toNanos());
        doReturn(null).when(values).get(key());
        assertEquals(ROWS, cache.getOrLoad(() -> ROWS)); verify(values, times(2)).get(key());
        verify(values).set(eq(key()), anyString(), any(Duration.class));
    }

    @Test void failedWriteDoesNotDiscardValidDatabaseResultAndOpensCooldown() {
        doThrow(new RedisConnectionFailureException("unavailable")).when(values).set(anyString(), anyString(), any(Duration.class));
        assertEquals(ROWS, cache.getOrLoad(() -> ROWS)); assertEquals(ROWS, cache.getOrLoad(() -> ROWS));
        verify(values, times(1)).get(key()); assertEquals(1, count("redis_error")); assertEquals(2, count("db_load"));
    }

    @Test void databaseFailureIsNeverConvertedIntoSuccessOrInventedEmptyData() {
        var failure = new IllegalStateException("database not available");
        assertSame(failure, assertThrows(IllegalStateException.class, () -> cache.getOrLoad(() -> { throw failure; })));
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
        when(values.get(key())).thenThrow(new RedisConnectionFailureException("offline"));
        assertSame(failure, assertThrows(IllegalStateException.class, () -> cache.getOrLoad(() -> { throw failure; })));
    }

    @Test void disabledCacheNeverConnectsAndEmptyDatabaseResultsAreNotCached() {
        assertEquals(ROWS, make(false).getOrLoad(() -> ROWS)); verifyNoInteractions(values);
        assertTrue(cache.getOrLoad(List::of).isEmpty()); verify(values, never()).set(anyString(), anyString(), any(Duration.class));
        when(values.get(key())).thenReturn("invalid");
        assertTrue(cache.getOrLoad(List::of).isEmpty()); verify(redis).delete(key());
    }

    @Test void cachedListsAreImmutableAndInvalidDatabaseRowsAreReturnedWithoutCaching() {
        cache.getOrLoad(() -> ROWS); String payload = stored(); when(values.get(key())).thenReturn(payload);
        assertThrows(UnsupportedOperationException.class, () -> cache.getOrLoad(List::of).clear());
        reset(values); when(values.get(key())).thenReturn(null);
        var unusual = List.of(new CategoryView("unusual", "OTHER", "长".repeat(41), "其他", ORIGIN + "/catalog/fruit.jpg", 1));
        assertEquals(unusual, cache.getOrLoad(() -> unusual));
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test void namespaceChangesWithDatabaseSecretOrOriginWithoutRevealingAnyOfThem() {
        String a = CatalogCacheIdentity.namespace(SECRET, DB, ORIGIN);
        assertNotEquals(a, CatalogCacheIdentity.namespace(SECRET, DB + "_restore", ORIGIN));
        assertNotEquals(a, CatalogCacheIdentity.namespace(SECRET + "2", DB, ORIGIN));
        assertNotEquals(a, CatalogCacheIdentity.namespace(SECRET, DB, ORIGIN + "2"));
        assertTrue(a.matches("freshmall:cache:v1:[a-f0-9]{64}"));
        assertEquals("freshmall:cache:v1:ebd18ca31b25fd4aee5d5d0969a8c0955badbdffb0c69ba9a5fef2e5b1f18003",
                CatalogCacheIdentity.namespace("01234567890123456789012345678901", "jdbc:mysql://127.0.0.1/test", "http://localhost:18080"));
    }

    @Test void invalidConfigurationFailsFast() {
        for (Duration ttl : List.of(Duration.ZERO, Duration.ofSeconds(4), Duration.ofHours(2)))
            assertThrows(IllegalArgumentException.class, () -> new PublicCategoryCache(redis, meters, true, ttl,
                    Duration.ZERO, Duration.ofSeconds(3), SECRET, DB, ORIGIN, nanos::get));
    }
}
