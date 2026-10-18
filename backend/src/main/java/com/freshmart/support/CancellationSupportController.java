package com.freshmart.support;

import com.freshmart.command.IdempotencyService;
import com.freshmart.commerce.CommerceModels.ReasonVersion;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;
import static com.freshmart.support.CancellationSupportModels.*;

@RestController @RequestMapping("/api/v1/orders")
public class CancellationSupportController {
 private final CancellationSupportService service;private final IdempotencyService commands;private final ObjectMapper json;
 public CancellationSupportController(CancellationSupportService service,IdempotencyService commands,ObjectMapper json){this.service=service;this.commands=commands;this.json=json;}
 @PostMapping("/{orderId}/cancellation-requests") @ResponseStatus(HttpStatus.CREATED)
 public ApiEnvelope<CancellationSupport> request(@PathVariable String orderId,@Valid @RequestBody ReasonVersion body,HttpServletRequest request){
  var actor=RequestActor.current(request);actor.requireRole("MEMBER");
  return ApiEnvelope.ok(commands.execute(actor.userId(),request.getMethod()+" "+request.getRequestURI(),CommandHeaders.requireIdempotencyKey(request),json.writeValueAsString(body),CancellationSupport.class,()->service.request(actor,orderId,body)));
 }
}
