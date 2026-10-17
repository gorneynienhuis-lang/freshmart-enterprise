package com.freshmart.command;

import com.freshmart.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/** The lock, command writes and result commit together. Rolled-back commands are not cached. */
@Service
public class IdempotencyService {
    private final CommandMapper mapper;
    private final ObjectMapper json;
    private final Clock clock;

    public IdempotencyService(CommandMapper mapper, ObjectMapper json, Clock clock) {
        this.mapper = mapper;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    public <T> T execute(String actorId, String route, String key, String canonicalRequest,
                         Class<T> resultType, Supplier<T> command) {
        validateKey(key);
        if (actorId == null || actorId.length() > 64 || route == null || route.length() > 256)
            throw new IllegalArgumentException("Invalid internal command scope");
        String hash = hash(canonicalRequest);
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        mapper.ensure(actorId, route, key, hash, now, now.plusHours(24));
        var row = mapper.lock(actorId, route, key);
        if (!row.requestHash().equals(hash))
            throw new ApiException(409, 1008, "IDEMPOTENCY_CONFLICT", "同一操作键不能用于不同请求");
        if ("COMPLETED".equals(row.status())) return json.readValue(row.resultJson(), resultType);
        T result = command.get();
        if (mapper.complete(actorId, route, key, json.writeValueAsString(result)) != 1)
            throw new IllegalStateException("Command result could not be persisted");
        return result;
    }

    public static void validateKey(String key) {
        try {
            if (key == null || !UUID.fromString(key).toString().equalsIgnoreCase(key))
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException ex) {
            throw ApiException.invalid("Idempotency-Key必须是完整UUID");
        }
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
}
