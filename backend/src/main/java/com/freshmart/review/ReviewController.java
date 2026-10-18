package com.freshmart.review;
import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
@RestController @RequestMapping("/api/v1/reviews") public class ReviewController {
 private final ReviewService service;private final IdempotencyService commands;private final ObjectMapper json;
 public ReviewController(ReviewService service,IdempotencyService commands,ObjectMapper json){this.service=service;this.commands=commands;this.json=json;}
 @SuppressWarnings("unchecked") @PostMapping @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<?> create(@Valid @RequestBody ReviewModels.Input input,HttpServletRequest request){var actor=RequestActor.current(request);return ApiEnvelope.ok(commands.execute(actor.userId(),request.getMethod()+" "+request.getRequestURI(),CommandHeaders.requireIdempotencyKey(request),json.writeValueAsString(input),Map.class,()->service.create(actor,input)));}
}
