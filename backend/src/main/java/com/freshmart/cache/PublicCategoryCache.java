package com.freshmart.cache;

import com.freshmart.catalog.CatalogService.CategoryView;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.core.StreamReadConstraints;
import tools.jackson.core.StreamReadFeature;
import tools.jackson.core.json.JsonFactory;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Optional Redis cache for public category DTOs only. No application-memory data cache. */
@Component
public class PublicCategoryCache {
    private static final Logger log = LoggerFactory.getLogger(PublicCategoryCache.class);
    private static final int MAX_BYTES = 65536, MAX_CATEGORIES = 100;
    private static final JsonMapper JSON = JsonMapper.builder(JsonFactory.builder()
                    .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
                    .disable(StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION)
                    .streamReadConstraints(StreamReadConstraints.builder().maxNestingDepth(8)
                            .maxDocumentLength(MAX_BYTES).maxStringLength(2048).maxNumberLength(10).build()).build())
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                    DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES,
                    DeserializationFeature.FAIL_ON_MISSING_CREATOR_PROPERTIES,
                    DeserializationFeature.FAIL_ON_NULL_CREATOR_PROPERTIES,
                    DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS).build();

    private final StringRedisTemplate redis;
    private final boolean enabled;
    private final String namespace, key;
    private final Duration ttl, jitter, cooldown;
    private final LongSupplier nanoTime;
    private final AtomicLong blockedUntil = new AtomicLong();
    private final Map<String, Counter> counters = new HashMap<>();

    @Autowired
    public PublicCategoryCache(StringRedisTemplate redis, MeterRegistry registry,
            @Value("${app.catalog-cache.enabled:false}") boolean enabled,
            @Value("${app.catalog-cache.ttl:60s}") Duration ttl,
            @Value("${app.catalog-cache.jitter:5s}") Duration jitter,
            @Value("${app.catalog-cache.failure-cooldown:3s}") Duration cooldown,
            @Value("${app.token-secret:}") String secret,
            @Value("${spring.datasource.url}") String databaseUrl,
            @Value("${app.public-origin:http://localhost:8080}") String origin) {
        this(redis, registry, enabled, ttl, jitter, cooldown, secret, databaseUrl, origin, System::nanoTime);
    }

    PublicCategoryCache(StringRedisTemplate redis, MeterRegistry registry, boolean enabled,
            Duration ttl, Duration jitter, Duration cooldown, String secret, String databaseUrl,
            String origin, LongSupplier nanoTime) {
        if (ttl == null || ttl.compareTo(Duration.ofSeconds(5)) < 0 || ttl.compareTo(Duration.ofHours(1)) > 0
                || jitter == null || jitter.isNegative() || jitter.compareTo(ttl.dividedBy(4)) > 0
                || cooldown == null || cooldown.compareTo(Duration.ofMillis(100)) < 0
                || cooldown.compareTo(Duration.ofSeconds(30)) > 0) {
            throw new IllegalArgumentException("Catalog cache durations are out of range");
        }
        this.redis = Objects.requireNonNull(redis);
        this.enabled = enabled;
        this.ttl = ttl; this.jitter = jitter; this.cooldown = cooldown;
        this.nanoTime = Objects.requireNonNull(nanoTime);
        this.namespace = enabled ? CatalogCacheIdentity.namespace(secret, databaseUrl, origin) : "disabled";
        this.key = namespace + ":public:categories";
        for (String result : List.of("hit", "miss", "invalid", "redis_error", "db_load", "write", "disabled", "bypass")) {
            counters.put(result, Counter.builder("freshmall.catalog.cache").tag("cache", "public_categories")
                    .tag("result", result).register(registry));
        }
    }

    public List<CategoryView> getOrLoad(Supplier<List<CategoryView>> databaseLoader) {
        if (!enabled) { count("disabled"); return load(databaseLoader); }
        long deadline = blockedUntil.get();
        if (deadline != 0 && nanoTime.getAsLong() - deadline < 0) {
            count("bypass"); return load(databaseLoader);
        }
        String raw;
        try {
            raw = redis.opsForValue().get(key);
            blockedUntil.set(0);
        } catch (RuntimeException error) {
            fail(error); return load(databaseLoader); // Never retry SET after a failed GET in the same request.
        }
        if (raw != null) {
            try {
                List<CategoryView> cached = decode(raw);
                count("hit"); return cached;
            } catch (RuntimeException ignored) {
                count("invalid"); // Never log a possibly hostile cached payload or its parse exception.
            }
        } else count("miss");

        // Database errors must propagate normally, outside every Redis/codec fallback catch.
        List<CategoryView> loaded = load(databaseLoader);
        if (valid(loaded) && !loaded.isEmpty()) {
            String encoded = JSON.writeValueAsString(new Entry(1, namespace, loaded));
            if (encoded.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES) {
                try { redis.opsForValue().set(key, encoded, expiry()); count("write"); }
                catch (RuntimeException error) { fail(error); }
            }
        } else if (raw != null) {
            // An invalid old entry must not become a hit when the database legitimately returns no rows.
            try { redis.delete(key); } catch (RuntimeException error) { fail(error); }
        }
        return loaded;
    }

    private List<CategoryView> load(Supplier<List<CategoryView>> loader) {
        count("db_load"); return List.copyOf(Objects.requireNonNull(loader.get()));
    }

    private List<CategoryView> decode(String raw) {
        if (raw.length() > MAX_BYTES || raw.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES)
            throw new IllegalArgumentException("Oversized category cache entry");
        JsonNode root = JSON.readTree(raw);
        if (!fields(root, Set.of("schemaVersion", "identity", "items"))
                || !root.get("schemaVersion").isIntegralNumber() || !root.get("schemaVersion").canConvertToInt()
                || !root.get("identity").isString() || !root.get("items").isArray()
                || root.get("items").size() > MAX_CATEGORIES) throw new IllegalArgumentException("Invalid category cache structure");
        for (JsonNode item : root.get("items")) {
            if (!fields(item, Set.of("categoryId", "code", "name", "shortName", "imageUrl", "sortOrder"))
                    || !item.get("sortOrder").isIntegralNumber() || !item.get("sortOrder").canConvertToInt())
                throw new IllegalArgumentException("Invalid category cache item");
            for (String field : List.of("categoryId", "code", "name", "shortName", "imageUrl"))
                if (!item.get(field).isString()) throw new IllegalArgumentException("Invalid category text type");
        }
        Entry entry = JSON.readValue(raw, Entry.class);
        if (entry.schemaVersion != 1 || !namespace.equals(entry.identity) || !valid(entry.items) || entry.items.isEmpty())
            throw new IllegalArgumentException("Invalid category cache entry");
        return List.copyOf(entry.items);
    }

    private static boolean fields(JsonNode node, Set<String> fields) {
        if (node == null || !node.isObject() || node.size() != fields.size()) return false;
        for (String name : fields) if (!node.has(name)) return false;
        return true;
    }

    private boolean valid(List<CategoryView> items) {
        if (items == null || items.size() > MAX_CATEGORIES) return false;
        Set<String> ids = new HashSet<>(), codes = new HashSet<>();
        CategoryView previous = null;
        for (CategoryView c : items) {
            if (c == null || !id(c.categoryId()) || !id(c.code()) || !ids.add(c.categoryId()) || !codes.add(c.code())
                    || !text(c.name(), 40) || !text(c.shortName(), 20) || c.sortOrder() < 0
                    || !image(c.imageUrl())) return false;
            if (previous != null && (previous.sortOrder() > c.sortOrder()
                    || previous.sortOrder() == c.sortOrder() && previous.categoryId().compareTo(c.categoryId()) > 0)) return false;
            previous = c;
        }
        return true;
    }

    private static boolean id(String value) { return value != null && value.matches("[A-Za-z0-9_-]{1,64}"); }
    private static boolean text(String value, int max) {
        return value != null && !value.isBlank() && value.codePointCount(0, value.length()) <= max
                && value.codePoints().noneMatch(Character::isISOControl);
    }
    private static boolean image(String value) {
        if (!text(value, 2048)) return false;
        try { URI uri = URI.create(value); return Set.of("http", "https").contains(uri.getScheme()) && uri.getHost() != null
                && uri.getUserInfo() == null; } catch (RuntimeException ignored) { return false; }
    }
    private Duration expiry() {
        long spread = jitter.toMillis();
        return ttl.plusMillis(spread == 0 ? 0 : ThreadLocalRandom.current().nextLong(-spread, spread + 1));
    }
    private void fail(RuntimeException error) {
        long now = nanoTime.getAsLong(), previous = blockedUntil.getAndSet(now + cooldown.toNanos());
        count("redis_error");
        if (previous == 0 || now - previous >= 0)
            log.warn("Optional category cache unavailable; using database type={}", error.getClass().getSimpleName());
    }
    private void count(String result) { counters.get(result).increment(); }
    record Entry(int schemaVersion, String identity, List<CategoryView> items) {}
}
