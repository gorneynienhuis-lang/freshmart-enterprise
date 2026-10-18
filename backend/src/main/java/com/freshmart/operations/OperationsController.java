package com.freshmart.operations;

import com.freshmart.catalog.CatalogService.SkuView;
import com.freshmart.checkout.CheckoutModels.SlotView;
import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.TreeMap;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import static com.freshmart.operations.OperationsModels.*;

@RestController @RequestMapping("/api/v1/admin")
public class OperationsController {
 private final OperationsService service;private final IdempotencyService commands;private final ObjectMapper json;
 public OperationsController(OperationsService service,IdempotencyService commands,ObjectMapper json){this.service=service;this.commands=commands;this.json=json;}
 private RequestActor actor(){return RequestActor.current();}
 private <T>ApiEnvelope<T> command(HttpServletRequest r,Object body,Class<T> type,Supplier<T> work){Object canonical=body;if(body instanceof JsonNode node&&node.isObject()){var sorted=new TreeMap<String,JsonNode>();node.properties().forEach(e->sorted.put(e.getKey(),e.getValue()));canonical=sorted;}return ApiEnvelope.ok(commands.execute(actor().userId(),r.getMethod()+" "+r.getRequestURI(),CommandHeaders.requireIdempotencyKey(r),json.writeValueAsString(canonical),type,work));}
 @GetMapping("/products") public ApiEnvelope<?> products(@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size,@RequestParam(required=false)String status){return ApiEnvelope.ok(service.products(actor(),page,size,status));}
 @GetMapping("/products/{productId}") public ApiEnvelope<?> product(@PathVariable String productId){return ApiEnvelope.ok(service.product(actor(),productId));}
 @PostMapping("/products") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<?> createProduct(@Valid @RequestBody ProductWrite in,HttpServletRequest r){return command(r,in,AdminProduct.class,()->service.createProduct(actor(),in));}
 @PatchMapping("/products/{productId}") public ApiEnvelope<?> patchProduct(@PathVariable String productId,@RequestBody JsonNode in,HttpServletRequest r){return command(r,in,AdminProduct.class,()->service.patchProduct(actor(),productId,in));}
 @PutMapping("/products/{productId}/status") public ApiEnvelope<?> productStatus(@PathVariable String productId,@Valid @RequestBody ProductStatus in,HttpServletRequest r){return command(r,in,AdminProduct.class,()->service.productStatus(actor(),productId,in));}
 @PostMapping("/products/{productId}/skus") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<?> createSku(@PathVariable String productId,@Valid @RequestBody SkuWrite in,HttpServletRequest r){return command(r,in,SkuView.class,()->service.createSku(actor(),productId,in));}
 @PatchMapping("/skus/{skuId}") public ApiEnvelope<?> patchSku(@PathVariable String skuId,@RequestBody JsonNode in,HttpServletRequest r){return command(r,in,SkuView.class,()->service.patchSku(actor(),skuId,in));}
 @GetMapping("/batches") public ApiEnvelope<?> batches(@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size,@RequestParam(required=false)String skuId,@RequestParam(required=false)String lifecycle,@RequestParam(required=false)String freshness){return ApiEnvelope.ok(service.batches(actor(),page,size,skuId,lifecycle,freshness));}
 @GetMapping("/batches/{batchId}") public ApiEnvelope<?> batch(@PathVariable String batchId){return ApiEnvelope.ok(service.batch(actor(),batchId));}
 @PostMapping("/batches") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<?> createBatch(@Valid @RequestBody BatchCreate in,HttpServletRequest r){return command(r,in,Batch.class,()->service.createBatch(actor(),in));}
 @PostMapping("/batches/{batchId}/adjustments") public ApiEnvelope<?> adjust(@PathVariable String batchId,@Valid @RequestBody Adjustment in,HttpServletRequest r){return command(r,in,Batch.class,()->service.adjust(actor(),batchId,in));}
 @PutMapping("/batches/{batchId}/lifecycle") public ApiEnvelope<?> lifecycle(@PathVariable String batchId,@Valid @RequestBody Lifecycle in,HttpServletRequest r){return command(r,in,Batch.class,()->service.lifecycle(actor(),batchId,in));}
 @GetMapping("/inventory-movements") public ApiEnvelope<?> movements(@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size,@RequestParam(required=false)String batchId,@RequestParam(required=false)String orderId){return ApiEnvelope.ok(service.movements(actor(),page,size,batchId,orderId));}
 @GetMapping("/delivery-slots") public ApiEnvelope<?> slots(@RequestParam LocalDate date){return ApiEnvelope.ok(service.slots(actor(),date));}
 @PutMapping("/delivery-slots/{slotId}") public ApiEnvelope<?> slot(@PathVariable String slotId,@Valid @RequestBody SlotUpdate in,HttpServletRequest r){return command(r,in,SlotView.class,()->service.updateSlot(actor(),slotId,in));}
 @GetMapping("/policies") public ApiEnvelope<?> policies(){return ApiEnvelope.ok(service.policies(actor()));}
 @PutMapping("/policies") public ApiEnvelope<?> policies(@Valid @RequestBody Policies in,HttpServletRequest r){return command(r,in,Policies.class,()->service.updatePolicies(actor(),in));}
}
