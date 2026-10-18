package com.freshmart.checkout;

import com.freshmart.common.ApiException;
import com.freshmart.identity.AuthenticationService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.freshmart.checkout.CheckoutModels.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Exercises real SQL, Flyway migrations, HTTP filters, optimistic versions and competing transactions. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:checkout;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.username=sa","spring.datasource.password=","app.token-secret=checkout-test-only-randomizable-secret-123456789","app.secure-cookies=false"})
@AutoConfigureMockMvc
class CheckoutIntegrationTest {
 static final AtomicLong PHONE=new AtomicLong(13700000000L);
 @Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;@Autowired CheckoutService service;@Autowired CheckoutMapper mapper;@Autowired AuthenticationService auth;@Autowired ObjectMapper json;@Autowired PlatformTransactionManager tx;
 String user,access,other,otherAccess,piece,weight;AddressView address;SlotRow slot;
 @BeforeEach void seed(){
  jdbc.update("UPDATE fm_coupon_campaign SET enabled=FALSE WHERE campaign_id='NEW_MEMBER_V1'");
  var me=auth.register(Long.toString(PHONE.incrementAndGet()),"Checkout-password-2026!","本人");user=me.body().user().userId();access=me.body().accessToken();
  var them=auth.register(Long.toString(PHONE.incrementAndGet()),"Checkout-password-2026!","别人");other=them.body().user().userId();otherAccess=them.body().accessToken();
  address=service.createAddress(user,input("松江区",true));service.initializeSlots();slot=mapper.slots(LocalDate.now(CheckoutService.ZONE).plusDays(1)).getFirst();
  String category="c-"+UUID.randomUUID(),product="p-"+UUID.randomUUID();piece="s-"+UUID.randomUUID();weight="w-"+UUID.randomUUID();
  jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url,sort_order,enabled) VALUES(?,?, '测试水果','果','http://localhost:8080/catalog/apple.jpg',0,TRUE)",category,category);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'测试苹果','测试商品','上海','COLD','http://localhost:8080/catalog/apple.jpg','ON_SALE')",product,product,category);
  sku(piece,product,false);sku(weight,product,true);batch(piece,100,slot.endAt().plus(Duration.ofDays(8)),"NORMAL");batch(weight,10000,slot.endAt().plus(Duration.ofDays(8)),"NORMAL");
 }
 AddressInput input(String district,boolean def){return new AddressInput("测试用户","13800138000","上海市","上海市",district,"东华大学演示地址",def);}
 void sku(String id,String product,boolean grams){jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url,status) VALUES(?,?,?,'标准规格',?,?,?,?,1000,950,'http://localhost:8080/catalog/apple.jpg','ACTIVE')",id,id,product,grams?"500g":"份",grams?"GRAM":"PIECE",grams?"BY_WEIGHT":"BY_PIECE",grams?500:null);}
 String batch(String sku,long amount,Instant expires,String lifecycle){String id="b-"+UUID.randomUUID();jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'warehouse',?,?,?, ?,0,?)",id,sku,id,Timestamp.from(Instant.now().minus(Duration.ofDays(7))),Timestamp.from(expires),lifecycle,amount,lifecycle.equals("QUARANTINED")?amount:0);return id;}
 QuoteRequest request(String sku,long count,String coupon){return new QuoteRequest(List.of(new PurchaseItem(sku,count)),address.addressId(),slot.slotId(),coupon);}
 JsonNode data(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsString()).path("data");}
 String key(){return UUID.randomUUID().toString();}
 MvcResult postJson(String path,Object body,String key,int expected)throws Exception{return mvc.perform(post("/api/v1"+path).header("Authorization","Bearer "+access).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().is(expected)).andReturn();}

 @Test void addressDefaultOwnerVersionAndIdempotencyAreEnforced()throws Exception{
  String key=key();var first=data(postJson("/addresses",input("长宁区",true),key,201));String id=first.path("addressId").asString();
  assertEquals(id,data(postJson("/addresses",input("长宁区",true),key,201)).path("addressId").asString());postJson("/addresses",input("松江区",true),key,409);
  assertEquals(2,service.addresses(user).size());assertEquals(1,service.addresses(user).stream().filter(AddressView::isDefault).count());
  mvc.perform(delete("/api/v1/addresses/"+id).header("Authorization","Bearer "+otherAccess).header("Idempotency-Key",key()).contentType("application/json").content("{\"version\":0}")).andExpect(status().isNotFound());
  mvc.perform(delete("/api/v1/addresses/"+id).header("Authorization","Bearer "+access).header("Idempotency-Key",key()).contentType("application/json").content("{\"version\":99}")).andExpect(status().isConflict());
  mvc.perform(delete("/api/v1/addresses/"+id).header("Authorization","Bearer "+access).header("Idempotency-Key",key()).contentType("application/json").content("{\"version\":0}")).andExpect(status().isOk());
  assertTrue(service.addresses(user).getFirst().isDefault());assertEquals(404,assertThrows(ApiException.class,()->service.slots(other,slot.slotDate(),address.addressId())).status());
 }
 @Test void addressDefaultsStayUniqueUnderConcurrentCreates()throws Exception{
  try(var pool=Executors.newFixedThreadPool(2)){
   var gate=new CountDownLatch(1);var a=pool.submit(()->{gate.await();return service.createAddress(user,input("松江区",true));});var b=pool.submit(()->{gate.await();return service.createAddress(user,input("长宁区",true));});gate.countDown();a.get(5,TimeUnit.SECONDS);b.get(5,TimeUnit.SECONDS);
   assertEquals(1,service.addresses(user).stream().filter(AddressView::isDefault).count());
  }
 }
 @Test void cartMergesSkuAndRetryDoesNotDuplicateOrReserveStock()throws Exception{
  String key=key();var request=new CartAddRequest(piece,2L,true);var first=data(postJson("/cart/items",request,key,200));
  assertEquals(first,data(postJson("/cart/items",request,key,200)));postJson("/cart/items",new CartAddRequest(piece,3L,true),key,409);
  assertEquals(3,data(postJson("/cart/items",new CartAddRequest(piece,1L,true),key(),200)).path("items").get(0).path("quantity").asLong());
  assertEquals(0,jdbc.queryForObject("SELECT SUM(reserved) FROM fm_inventory_batch WHERE sku_id=?",Long.class,piece));
 }
 @Test void cartUpdateAndDeleteHideOtherOwnersAndRejectStaleVersions()throws Exception{
  var c=service.addCartItem(user,new CartAddRequest(piece,2L,true));String id=c.items().getFirst().cartItemId();
  String update=json.writeValueAsString(new CartUpdateRequest(3L,false,0L));
  mvc.perform(patch("/api/v1/cart/items/"+id).header("Authorization","Bearer "+otherAccess).header("Idempotency-Key",key()).contentType("application/json").content(update)).andExpect(status().isNotFound());
  mvc.perform(patch("/api/v1/cart/items/"+id).header("Authorization","Bearer "+access).header("Idempotency-Key",key()).contentType("application/json").content(update)).andExpect(status().isOk()).andExpect(jsonPath("$.data.estimatedGoodsAmount").value(0));
  mvc.perform(delete("/api/v1/cart/items/"+id).header("Authorization","Bearer "+access).header("Idempotency-Key",key()).contentType("application/json").content("{\"version\":0}")).andExpect(status().isConflict());
  mvc.perform(delete("/api/v1/cart/items/"+id).header("Authorization","Bearer "+access).header("Idempotency-Key",key()).contentType("application/json").content("{\"version\":1}")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items.length()").value(0));
 }
 @Test void gramQuantityIsAlreadyGramsAndAmountsAreServerCalculated()throws Exception{
  var q=service.quote(user,request(weight,333,null));assertEquals(333,q.lines().getFirst().estimatedGram());assertEquals(633,q.price().goodsPayableAmount());assertEquals(1233,q.price().payableAmount());assertEquals(666,q.price().referenceGoodsAmount());
  var c=service.addCartItem(user,new CartAddRequest(weight,333L,true));assertEquals(633,c.estimatedGoodsAmount());
  mvc.perform(post("/api/v1/orders/quote").header("Authorization","Bearer "+access).header("Idempotency-Key",key()).contentType("application/json").content(json.writeValueAsString(Map.of("items",List.of(Map.of("skuId",piece,"quantity",1)),"addressId",address.addressId(),"slotId",slot.slotId(),"payableAmount",1)))).andExpect(status().isBadRequest());
 }
 @Test void nearExpiryDiscountNeedsEntireLinePoolAndDeliveryWindowCoverage(){
  batch(piece,2,slot.endAt().plusSeconds(3600),"NORMAL");
  var discounted=service.quote(user,request(piece,2,null));assertEquals(900,discounted.lines().getFirst().unitPrice());assertEquals(100,discounted.price().nearExpiryDiscountAmount());
  var mixed=service.quote(user,request(piece,3,null));assertEquals(950,mixed.lines().getFirst().unitPrice());assertNull(mixed.lines().getFirst().nearExpiryUnitPrice());
  var saved=mapper.quoteLines(discounted.quoteId()).getFirst();assertTrue(saved.nearExpiryOnly());assertEquals(0,jdbc.queryForObject("SELECT SUM(reserved) FROM fm_inventory_batch WHERE sku_id=?",Long.class,piece));
 }
 @Test void expiredAtWindowEndQuarantinedAndFutureReceivedBatchesCannotSupportQuote(){
  jdbc.update("UPDATE fm_inventory_batch SET on_hand=0 WHERE sku_id=?",piece);
  batch(piece,10,slot.endAt(),"NORMAL");batch(piece,10,slot.endAt().plusSeconds(1),"QUARANTINED");String future=batch(piece,10,slot.endAt().plus(Duration.ofDays(4)),"NORMAL");jdbc.update("UPDATE fm_inventory_batch SET received_at=? WHERE batch_id=?",Timestamp.from(Instant.now().plusSeconds(3600)),future);
  assertEquals(422,assertThrows(ApiException.class,()->service.quote(user,request(piece,1,null))).status());
 }
 @Test void campaignIsExplicitGrantsExactlyOnceAndCouponThresholdAndAllocationAreReal()throws Exception{
  service.claimNewcomerCoupon(user);assertTrue(service.coupons(user).isEmpty());jdbc.update("UPDATE fm_coupon_campaign SET enabled=TRUE WHERE campaign_id='NEW_MEMBER_V1'");
  try(var pool=Executors.newFixedThreadPool(2)){var a=pool.submit(()->service.claimNewcomerCoupon(user));var b=pool.submit(()->service.claimNewcomerCoupon(user));a.get(5,TimeUnit.SECONDS);b.get(5,TimeUnit.SECONDS);}
  var coupon=service.coupons(user).getFirst();assertEquals(1,service.coupons(user).size());assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE actor_id=? AND operation='NEWCOMER_COUPON_GRANT'",Integer.class,user));
  assertEquals(400,assertThrows(ApiException.class,()->service.quote(user,request(piece,1,coupon.couponId()))).status());
  var q=service.quote(user,request(piece,4,coupon.couponId()));assertEquals(3800,q.price().memberGoodsAmount());assertEquals(500,q.price().couponDiscountAmount());assertEquals(3900,q.price().payableAmount());assertEquals("AVAILABLE",mapper.coupon(coupon.couponId(),user).status());
  assertEquals(404,assertThrows(ApiException.class,()->service.quote(other,new QuoteRequest(List.of(new PurchaseItem(piece,4L)),service.createAddress(other,input("松江区",true)).addressId(),slot.slotId(),coupon.couponId()))).status());
 }
 @Test void quoteRetryReturnsPersistedSnapshotAndTamperingReuseExpiryOrPriceChangesFail()throws Exception{
  String key=key();var request=request(piece,1,null);var first=data(postJson("/orders/quote",request,key,200));assertEquals(first,data(postJson("/orders/quote",request,key,200)));String id=first.path("quoteId").asString(),token=first.path("quoteToken").asString();
  assertEquals(404,assertThrows(ApiException.class,()->service.lockQuoteForOrder(other,id,token)).status());assertEquals(404,assertThrows(ApiException.class,()->service.lockQuoteForOrder(user,id,token+"x")).status());
  var snap=new TransactionTemplate(tx).execute(t->service.lockQuoteForOrder(user,id,token));service.validateForOrder(snap);jdbc.update("UPDATE fm_sku SET member_price=member_price-1,version=version+1 WHERE sku_id=?",piece);assertEquals(409,assertThrows(ApiException.class,()->service.validateForOrder(snap)).status());new TransactionTemplate(tx).executeWithoutResult(t->mapper.consumeQuote(id,snap.row().version()));
  assertEquals(409,assertThrows(ApiException.class,()->service.lockQuoteForOrder(user,id,token)).status());
  var q=service.quote(user,request(piece,1,null));jdbc.update("UPDATE fm_checkout_quote SET expires_at=? WHERE quote_id=?",Timestamp.from(Instant.now().minusSeconds(1)),q.quoteId());assertEquals(1203,assertThrows(ApiException.class,()->service.lockQuoteForOrder(user,q.quoteId(),q.quoteToken())).code());
 }
 @Test void slotQueriesAreReadOnlyDateBoundAndPreserveCapacityConfiguration()throws Exception{
  var outside=service.createAddress(user,input("徐汇区",false));assertTrue(service.slots(user,slot.slotDate(),outside.addressId()).stream().allMatch(s->!s.available()&&"OUT_OF_SERVICE".equals(s.unavailableReason())));
  jdbc.update("UPDATE fm_delivery_slot SET capacity=7,used=7 WHERE slot_id=?",slot.slotId());service.initializeSlots();assertEquals(7,mapper.slot(slot.slotId()).capacity());assertEquals("FULL",service.slots(user,slot.slotDate(),address.addressId()).getFirst().unavailableReason());
  assertEquals(400,assertThrows(ApiException.class,()->service.slots(user,slot.slotDate().plusDays(1),address.addressId())).status());
  mvc.perform(get("/api/v1/delivery-slots").header("Authorization","Bearer "+access).param("date",slot.slotDate().toString())).andExpect(status().isBadRequest());
  jdbc.update("UPDATE fm_delivery_slot SET capacity=30,used=0 WHERE slot_id=?",slot.slotId());
 }
 @Test void unauthorizedWrongRoleMissingKeyAndMissingRequiredFieldsFailClosed()throws Exception{
  mvc.perform(get("/api/v1/cart")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/v1/cart/items").header("Authorization","Bearer "+access).contentType("application/json").content(json.writeValueAsString(new CartAddRequest(piece,1L,true)))).andExpect(status().isBadRequest());
  postJson("/cart/items",Map.of("skuId",piece,"quantity",1),key(),400);
  jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",user);jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,'ADMIN')",user);
  mvc.perform(get("/api/v1/addresses").header("Authorization","Bearer "+access)).andExpect(status().isForbidden());
 }
 @Test void duplicateQuoteSkusMergeBeforePricingAndOverflowIsRejected(){
  var q=service.quote(user,new QuoteRequest(List.of(new PurchaseItem(piece,2L),new PurchaseItem(piece,3L)),address.addressId(),slot.slotId(),null));assertEquals(1,q.lines().size());assertEquals(5,q.lines().getFirst().quantity());assertEquals(4750,q.price().goodsPayableAmount());
  assertEquals(400,assertThrows(ApiException.class,()->service.quote(user,new QuoteRequest(List.of(new PurchaseItem(piece,MAX),new PurchaseItem(piece,1L)),address.addressId(),slot.slotId(),null))).status());
 }
}
