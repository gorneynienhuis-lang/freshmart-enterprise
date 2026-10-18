package com.freshmart.mascot;

import com.freshmart.common.ApiEnvelope;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.freshmart.mascot.MascotModels.ChatReply;
import static com.freshmart.mascot.MascotModels.ChatRequest;

@RestController
@RequestMapping("/api/v1/mascot")
public class MascotController {
    private final MascotService service;

    public MascotController(MascotService service) { this.service = service; }

    @PostMapping("/chat")
    public ApiEnvelope<ChatReply> chat(@Valid @RequestBody ChatRequest request) {
        return ApiEnvelope.ok(service.answer(request));
    }
}
