package com.freshmart.commerce;

import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import com.freshmart.identity.TokenCodec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.Map;
import java.util.function.Supplier;
import static com.freshmart.commerce.CommerceModels.*;

@RestController
@RequestMapping("/api/v1")
public class CommerceController {
    private final CommerceService service;private final IdempotencyService commands;private final ObjectMapper json;
    private final SandboxSignature signatures;private final Validator validator;
    public CommerceController(CommerceService service,IdempotencyService commands,ObjectMapper json,SandboxSignature signatures,Validator validator){this.service=service;this.commands=commands;this.json=json;this.signatures=signatures;this.validator=validator;}
    @PostMapping("/orders") @ResponseStatus(HttpStatus.CREATED)
    public ApiEnvelope<?> create(@Valid @RequestBody CreateOrder body,HttpServletRequest request){return command(request,body,()->service.create(actor(),body));}
    @GetMapping("/orders") public ApiEnvelope<?> orders(@RequestParam(required=false)String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return ApiEnvelope.ok(service.list(actor(),status,page,size,false));}
    @GetMapping("/orders/{id}") public ApiEnvelope<?> order(@PathVariable String id){return ApiEnvelope.ok(service.get(actor(),id));}
    @GetMapping("/orders/{id}/status") public ApiEnvelope<?> status(@PathVariable String id){return ApiEnvelope.ok(service.status(actor(),id));}
    @PostMapping("/orders/{id}/cancel") public ApiEnvelope<?> cancel(@PathVariable String id,@Valid @RequestBody ReasonVersion body,HttpServletRequest request){return command(request,body,()->service.cancel(actor(),id,body,false));}
    @PostMapping("/payments/prepay") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<?> prepay(@Valid @RequestBody Prepay body,HttpServletRequest request){return command(request,body,()->service.prepay(actor(),body));}
    @GetMapping("/payments/{id}") public ApiEnvelope<?> payment(@PathVariable String id){return ApiEnvelope.ok(service.payment(actor(),id));}
    @PostMapping("/payments/{id}/sandbox-simulate") public ApiEnvelope<?> simulate(@PathVariable String id,@Valid @RequestBody Simulate body,HttpServletRequest request){signatures.requireEnabled();return command(request,body,()->service.simulate(actor(),id,body));}
    @PostMapping("/payments/sandbox/callback") public ApiEnvelope<?> callback(@RequestBody String raw,
            @RequestHeader(value="X-Sandbox-Signature",required=false)String signature,@RequestHeader(value="X-Sandbox-Timestamp",required=false)String timestamp,
            @RequestHeader(value="X-Sandbox-Nonce",required=false)String nonce){
        signatures.verify(raw,timestamp,nonce,signature);Callback body;
        try{body=json.readValue(raw,Callback.class);}catch(RuntimeException e){throw ApiException.invalid("渠道事件格式不合法");}
        if(!validator.validate(body).isEmpty())throw ApiException.invalid("渠道事件参数不合法");
        return ApiEnvelope.ok(service.callback(body,nonce,TokenCodec.hash(raw)));
    }
    @GetMapping("/refunds/{id}") public ApiEnvelope<?> refund(@PathVariable String id){return ApiEnvelope.ok(service.refund(actor(),id));}
    @GetMapping("/admin/orders") public ApiEnvelope<?> adminOrders(@RequestParam(required=false)String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return ApiEnvelope.ok(service.list(actor(),status,page,size,true));}
    @GetMapping("/admin/orders/{id}") public ApiEnvelope<?> adminOrder(@PathVariable String id){return ApiEnvelope.ok(service.adminOrder(actor(),id));}
    @PostMapping("/admin/orders/{id}/cancel") public ApiEnvelope<?> adminCancel(@PathVariable String id,@Valid @RequestBody ReasonVersion body,HttpServletRequest request){return command(request,body,()->service.cancel(actor(),id,body,true));}
    @PostMapping("/admin/orders/{id}/returns/receive") public ApiEnvelope<?> receiveReturn(@PathVariable String id,@Valid @RequestBody ReturnReceive body,HttpServletRequest request){return command(request,body,()->service.receiveReturn(actor(),id,body));}
    @GetMapping("/admin/pick-tasks") public ApiEnvelope<?> picks(@RequestParam(required=false)String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return ApiEnvelope.ok(service.pickTasks(actor(),status,page,size));}
    @GetMapping("/admin/pick-tasks/{id}") public ApiEnvelope<?> pick(@PathVariable String id){return ApiEnvelope.ok(service.pickTask(actor(),id));}
    @PostMapping("/admin/pick-tasks/{id}/claim") public ApiEnvelope<?> claim(@PathVariable String id,@Valid @RequestBody Version body,HttpServletRequest request){return command(request,body,()->service.claim(actor(),id,body));}
    @PostMapping("/admin/pick-tasks/{id}/confirm") public ApiEnvelope<?> confirm(@PathVariable String id,@Valid @RequestBody PickConfirm body,HttpServletRequest request){return command(request,body,()->service.confirmPick(actor(),id,body));}
    @GetMapping("/admin/delivery-tasks") public ApiEnvelope<?> deliveries(@RequestParam(required=false)String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return ApiEnvelope.ok(service.deliveryTasks(actor(),status,page,size));}
    @GetMapping("/admin/delivery-tasks/{id}") public ApiEnvelope<?> delivery(@PathVariable String id){return ApiEnvelope.ok(service.deliveryTask(actor(),id));}
    @PostMapping("/admin/delivery-tasks/{id}/dispatch") public ApiEnvelope<?> dispatch(@PathVariable String id,@Valid @RequestBody Dispatch body,HttpServletRequest request){return command(request,body,()->service.dispatch(actor(),id,body));}
    @PostMapping("/admin/delivery-tasks/{id}/complete") public ApiEnvelope<?> complete(@PathVariable String id,@Valid @RequestBody Complete body,HttpServletRequest request){return command(request,body,()->service.complete(actor(),id,body));}
    @GetMapping("/admin/dashboard") public ApiEnvelope<?> dashboard(@RequestParam(required=false)LocalDate date){return ApiEnvelope.ok(service.dashboard(actor(),date));}
    private RequestActor actor(){return RequestActor.current();}
    @SuppressWarnings({"unchecked","rawtypes"})
    private ApiEnvelope<?> command(HttpServletRequest request,Object body,Supplier<Map<String,Object>> action){
        return ApiEnvelope.ok(commands.execute(actor().userId(),request.getMethod()+" "+request.getRequestURI(),CommandHeaders.requireIdempotencyKey(request),
                TokenCodec.hash(json.writeValueAsString(body)),Map.class,(Supplier)action));
    }
}
