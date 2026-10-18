package com.freshmart.aftersale;
import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.function.Supplier;
import static com.freshmart.aftersale.AfterSaleModels.*;
@RestController @RequestMapping("/api/v1")
public class AfterSaleController {
 private final AfterSaleService service;private final IdempotencyService commands;private final ObjectMapper json;
 public AfterSaleController(AfterSaleService service,IdempotencyService commands,ObjectMapper json){this.service=service;this.commands=commands;this.json=json;}
 @PostMapping("/aftersales") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<?> apply(@Valid @RequestBody ApplyRequest body,HttpServletRequest r){return command(r,body,()->service.apply(actor(r),body));}
 @GetMapping("/aftersales") public ApiEnvelope<?> list(@RequestParam(required=false) String status,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,HttpServletRequest r){return ApiEnvelope.ok(service.list(actor(r),status,page,size,false));}
 @GetMapping("/aftersales/{id}") public ApiEnvelope<?> get(@PathVariable String id,HttpServletRequest r){return ApiEnvelope.ok(service.get(actor(r),id,false));}
 @PostMapping("/aftersales/{id}/cancel") public ApiEnvelope<?> cancel(@PathVariable String id,@Valid @RequestBody ReasonVersion body,HttpServletRequest r){return command(r,body,()->service.cancel(actor(r),id,body));}
 @GetMapping("/admin/aftersales") public ApiEnvelope<?> adminList(@RequestParam(required=false) String status,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,HttpServletRequest r){return ApiEnvelope.ok(service.list(actor(r),status,page,size,true));}
 @GetMapping("/admin/aftersales/{id}") public ApiEnvelope<?> adminGet(@PathVariable String id,HttpServletRequest r){return ApiEnvelope.ok(service.get(actor(r),id,true));}
 @PostMapping("/admin/aftersales/{id}/claim") public ApiEnvelope<?> claim(@PathVariable String id,@Valid @RequestBody Version body,HttpServletRequest r){return command(r,body,()->service.claim(actor(r),id,body));}
 @PostMapping("/admin/aftersales/{id}/approve") public ApiEnvelope<?> approve(@PathVariable String id,@Valid @RequestBody ApproveRequest body,HttpServletRequest r){return command(r,body,()->service.approve(actor(r),id,body));}
 @PostMapping("/admin/aftersales/{id}/reject") public ApiEnvelope<?> reject(@PathVariable String id,@Valid @RequestBody ReviewRequest body,HttpServletRequest r){return command(r,body,()->service.reject(actor(r),id,body));}
 @GetMapping("/admin/refunds") public ApiEnvelope<?> refunds(@RequestParam(required=false) String status,@RequestParam(required=false) String orderId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,HttpServletRequest r){return ApiEnvelope.ok(service.refunds(actor(r),status,orderId,page,size));}
 @PostMapping("/admin/refunds/{id}/execute") public ApiEnvelope<?> execute(@PathVariable String id,@Valid @RequestBody ReasonVersion body,HttpServletRequest r){return command(r,body,()->service.execute(actor(r),id,body,false));}
 @PostMapping("/admin/refunds/{id}/retry") public ApiEnvelope<?> retry(@PathVariable String id,@Valid @RequestBody ReasonVersion body,HttpServletRequest r){return command(r,body,()->service.execute(actor(r),id,body,true));}
 private static RequestActor actor(HttpServletRequest r){return RequestActor.current(r);}
 @SuppressWarnings("unchecked") private ApiEnvelope<?> command(HttpServletRequest r,Object body,Supplier<Map<String,Object>> call){return ApiEnvelope.ok(commands.execute(actor(r).userId(),r.getMethod()+" "+r.getRequestURI(),CommandHeaders.requireIdempotencyKey(r),json.writeValueAsString(body),Map.class,()->call.get()));}
}
