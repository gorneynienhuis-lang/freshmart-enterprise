package com.freshmart.observability;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.io.IOException;
import java.util.Set;

/** A separate read-only exposition credential. It is never an application identity or ADMIN session. */
@Component
public final class MetricsScrapeAuth {
    private final byte[] credential;
    public MetricsScrapeAuth(@Value("${app.monitoring-enabled:false}") boolean enabled,
                             @Value("${app.metrics-token-file:}") String configuredFile) {
        if (!enabled) { credential = null; return; }
        try {
            if (configuredFile == null || configuredFile.isBlank()) throw new IOException();
            Path path = Path.of(configuredFile).toAbsolutePath().normalize();
            for (Path current = path; current != null; current = current.getParent()) if (Files.isSymbolicLink(current)) throw new IOException();
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || Files.size(path) > 256 || Files.size(path) < 43) throw new IOException();
            if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
                Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(path, LinkOption.NOFOLLOW_LINKS);
                if (!permissions.equals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE))) throw new IOException();
            } else throw new IOException(); // This runtime requires an owner-only secret file.
            String token = Files.readString(path, StandardCharsets.US_ASCII).strip();
            if (!token.matches("[A-Za-z0-9_-]{43,128}")) throw new IOException();
            credential = token.getBytes(StandardCharsets.US_ASCII);
        } catch (IOException | RuntimeException error) {
            throw new IllegalStateException("Monitoring credential file is missing or unsafe");
        }
    }
    public boolean accepts(String method, String path, String authorization) {
        if (credential == null || !"GET".equals(method) || !"/actuator/prometheus".equals(path) || authorization == null || !authorization.startsWith("Bearer ")) return false;
        String supplied = authorization.substring(7);
        return supplied.length() <= 128 && MessageDigest.isEqual(credential, supplied.getBytes(StandardCharsets.US_ASCII));
    }
}
