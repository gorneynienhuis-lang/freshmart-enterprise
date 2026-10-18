package com.freshmart.audit;

import java.util.regex.Pattern;

/** Defensive redaction for free-text audit reasons; request bodies are never logged. */
public final class SafeAuditText {
    private SafeAuditText() {}
    private static final Pattern PHONE = Pattern.compile("(?<![0-9])1[3-9][0-9]{9}(?![0-9])");
    private static final Pattern BEARER = Pattern.compile("(?i)bearer\\s+[A-Za-z0-9._~-]+");
    private static final Pattern CREDENTIAL = Pattern.compile("(?i)(password|passwd|密码|token|cookie|secret)\\s*[:=：]\\s*[^\\s,;，；]+");
    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
    public static String redact(String value) {
        if (value == null || value.isBlank()) return null;
        String safe = PHONE.matcher(value).replaceAll("[手机号已隐藏]");
        safe = BEARER.matcher(safe).replaceAll("Bearer [已隐藏]");
        safe = CREDENTIAL.matcher(safe).replaceAll("$1=[已隐藏]");
        safe = JWT.matcher(safe).replaceAll("[凭据已隐藏]");
        safe = safe.replaceAll("[\\p{Cntrl}&&[^\\n\\t]]", "");
        return safe.length() > 500 ? safe.substring(0, 500) : safe;
    }
}
