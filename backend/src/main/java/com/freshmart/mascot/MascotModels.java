package com.freshmart.mascot;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class MascotModels {
    private MascotModels() {}

    public record ChatRequest(
            @NotBlank @Size(max = 500) String message,
            @NotBlank @Size(max = 128) String sessionId,
            @Size(max = 6) List<@Valid HistoryItem> history,
            @Size(max = 120) String page) {}

    public record HistoryItem(@NotBlank String role, @NotBlank @Size(max = 2000) String content) {}

    public record ChatReply(List<String> reply, List<String> suggestions, String source) {}
}
