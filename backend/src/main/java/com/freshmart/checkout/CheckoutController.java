package com.freshmart.checkout;

import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import static com.freshmart.checkout.CheckoutModels.*;

@RestController @RequestMapping("/api/v1")
public class CheckoutController {
 private final CheckoutService checkout;private final IdempotencyService commands;private final ObjectMapper json;
 public CheckoutController(CheckoutService checkout,IdempotencyService commands,ObjectMapper json){this.checkout=checkout;this.commands=commands;this.json=json;}
 @GetMapping("/addresses") public ApiEnvelope<Map<String,List<AddressView>>> addresses(HttpServletRequest r){return ApiEnvelope.ok(Map.of("items",checkout.addresses(user(r))));}
 @PostMapping("/addresses") @ResponseStatus(HttpStatus.CREATED) public ApiEnvelope<AddressView> createAddress(@Valid @RequestBody AddressInput body,HttpServletRequest r){return command(r,body,AddressView.class,()->checkout.createAddress(user(r),body));}
 @PutMapping("/addresses/{addressId}") public ApiEnvelope<AddressView> updateAddress(@PathVariable String addressId,@Valid @RequestBody AddressUpdateRequest body,HttpServletRequest r){return command(r,body,AddressView.class,()->checkout.updateAddress(user(r),addressId,body));}
 @DeleteMapping("/addresses/{addressId}") public ApiEnvelope<CommandResult> deleteAddress(@PathVariable String addressId,@Valid @RequestBody VersionRequest body,HttpServletRequest r){return command(r,body,CommandResult.class,()->checkout.deleteAddress(user(r),addressId,body.version()));}
 @GetMapping("/cart") public ApiEnvelope<CartView> cart(HttpServletRequest r){return ApiEnvelope.ok(checkout.cart(user(r)));}
 @PostMapping("/cart/items") public ApiEnvelope<CartView> addCart(@Valid @RequestBody CartAddRequest body,HttpServletRequest r){return command(r,body,CartView.class,()->checkout.addCartItem(user(r),body));}
 @PatchMapping("/cart/items/{cartItemId}") public ApiEnvelope<CartView> updateCart(@PathVariable String cartItemId,@Valid @RequestBody CartUpdateRequest body,HttpServletRequest r){return command(r,body,CartView.class,()->checkout.updateCartItem(user(r),cartItemId,body));}
 @DeleteMapping("/cart/items/{cartItemId}") public ApiEnvelope<CartView> deleteCart(@PathVariable String cartItemId,@Valid @RequestBody VersionRequest body,HttpServletRequest r){return command(r,body,CartView.class,()->checkout.deleteCartItem(user(r),cartItemId,body.version()));}
 @GetMapping("/delivery-slots") public ApiEnvelope<Map<String,List<SlotView>>> slots(@RequestParam LocalDate date,@RequestParam String addressId,HttpServletRequest r){return ApiEnvelope.ok(Map.of("items",checkout.slots(user(r),date,addressId)));}
 @GetMapping("/coupons") public ApiEnvelope<Map<String,List<CouponView>>> coupons(HttpServletRequest r){return ApiEnvelope.ok(Map.of("items",checkout.coupons(user(r))));}
 @PostMapping("/orders/quote") public ApiEnvelope<QuoteView> quote(@Valid @RequestBody QuoteRequest body,HttpServletRequest r){return command(r,body,QuoteView.class,()->checkout.quote(user(r),body));}
 private static String user(HttpServletRequest r){var actor=RequestActor.current(r);actor.requireRole("MEMBER");return actor.userId();}
 private <T> ApiEnvelope<T> command(HttpServletRequest r,Object body,Class<T> type,Supplier<T> action){return ApiEnvelope.ok(commands.execute(user(r),r.getMethod()+" "+r.getRequestURI(),CommandHeaders.requireIdempotencyKey(r),json.writeValueAsString(body),type,action));}
}
