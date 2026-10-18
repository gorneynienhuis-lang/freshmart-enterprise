package com.freshmart.operations;

import com.freshmart.catalog.CatalogService;
import com.freshmart.checkout.*;
import com.freshmart.commerce.*;
import com.freshmart.common.*;
import com.freshmart.identity.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.freshmart.operations.OperationsModels.*;

/** Real HTTP filters, Flyway/JDBC data, price policy reads and competing row-lock transactions. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:operations;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=15000",
 "spring.datasource.username=sa","spring.datasource.password=","app.token-secret=operations-test-only-secret-not-a-runtime-key-123456789",
 "app.secure-cookies=false","app.public-origin=http://localhost:5173","app.media-dir=./.runtime/operations-test-media","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
class OperationsIntegrationTest {
 static final String PASSWORD="Operations-test-password-2026!",IMAGE="http://localhost:5173/catalog/S001.jpg";
 static final AtomicLong PHONES=new AtomicLong(13770000000L);
 @Autowired MockMvc mvc;@Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired OperationsService service;
 @Autowired AuthenticationService auth;@Autowired IdentityMapper users;@Autowired PasswordHasher passwords;
 @Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;@Autowired CommerceService commerce;
 @Autowired CatalogService catalog;@Autowired PlatformTransactionManager tx;
 record Session(String userId,String access,RequestActor actor){}
 record Product(String id,String sku){}
 Session operator,picker,finance,member;String category;

 @BeforeEach void prepare(){
  jdbc.update("UPDATE fm_business_policy SET freight_amount=600,free_shipping_threshold_amount=9900,near_expiry_days=3,near_expiry_discount_basis_points=9000,newcomer_coupon_amount=500,newcomer_coupon_min_goods_amount=3000,version=0 WHERE policy_id='STORE'");
  jdbc.update("UPDATE fm_coupon_campaign SET discount_amount=500,min_goods_amount=3000,enabled=FALSE WHERE campaign_id='NEW_MEMBER_V1'");
  operator=account("OPERATOR");picker=account("PICKER");finance=account("FINANCE");member=account("MEMBER");
  category="category-"+UUID.randomUUID();jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url,sort_order,enabled) VALUES(?,?,'测试鲜果','果',?,0,TRUE)",category,category,IMAGE);
 }
 Session account(String role){String id=UUID.randomUUID().toString(),phone=Long.toString(PHONES.incrementAndGet());Instant now=Instant.now();users.insertUser(new UserRow(id,phone,passwords.encode(PASSWORD),"测试"+role,"ACTIVE",false,0,now,now));users.insertRole(id,role);var logged=auth.login(phone,PASSWORD);return new Session(id,logged.body().accessToken(),auth.authenticate(logged.body().accessToken()));}
 String key(){return UUID.randomUUID().toString();}
 JsonNode data(MvcResult result)throws Exception{return json.readTree(result.getResponse().getContentAsString()).path("data");}
 MvcResult write(Session a,String method,String path,Object body,String key,int expected)throws Exception{MockHttpServletRequestBuilder request=switch(method){case "POST"->post(path);case "PATCH"->patch(path);case "PUT"->put(path);default->throw new IllegalArgumentException();};return mvc.perform(request.header("Authorization","Bearer "+a.access()).header("Idempotency-Key",key).contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().is(expected)).andReturn();}
 MvcResult read(Session a,String path,int expected)throws Exception{return mvc.perform(get(path).header("Authorization","Bearer "+a.access())).andExpect(status().is(expected)).andReturn();}
 Product product()throws Exception{var created=data(write(operator,"POST","/api/v1/admin/products",new ProductWrite(category,"测试苹果","产地直送的课程测试商品","上海","COLD",IMAGE),key(),201));String id=created.path("productId").asString();var sku=data(write(operator,"POST","/api/v1/admin/products/"+id+"/skus",new SkuWrite("SKU-"+key(),"标准份","500g/份","PIECE","BY_PIECE",null,1000L,950L,IMAGE),key(),201));write(operator,"PUT","/api/v1/admin/products/"+id+"/status",new ProductStatus("ON_SALE",0L),key(),200);return new Product(id,sku.path("skuId").asString());}
 JsonNode receive(Product p,long quantity,Instant expires)throws Exception{return data(write(picker,"POST","/api/v1/admin/batches",new BatchCreate("B-"+key(),p.sku(),quantity,Instant.now().minus(Duration.ofDays(1)),expires,"采购验收入库"),key(),201));}
 CheckoutModels.QuoteView quote(Product p,long quantity){var address=checkout.createAddress(member.userId(),new CheckoutModels.AddressInput("测试会员","13800138000","上海市","上海市","松江区","东华课程测试地址",true));checkout.initializeSlots();var slot=checkoutDb.slots(LocalDate.now(CheckoutService.ZONE).plusDays(1)).getFirst();return checkout.quote(member.userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(p.sku(),quantity)),address.addressId(),slot.slotId(),null));}
 String createOrder(CheckoutModels.QuoteView q){return (String)commerce.create(member.actor(),new CommerceModels.CreateOrder(q.quoteId(),q.quoteToken(),"测试下单")).get("orderId");}

 @Test void draftProductSkuAndPublicationAreRealVersionedAndIdempotent()throws Exception{
  String idem=key();var body=new ProductWrite(category,"校园苹果","测试商品描述","上海","COLD",IMAGE);var first=data(write(operator,"POST","/api/v1/admin/products",body,idem,201));String id=first.path("productId").asString();
  assertEquals("DRAFT",first.path("status").asString());assertEquals(0,first.path("skus").size());assertEquals("未配置规格",first.path("unitLabel").asString());assertEquals(0,first.path("price").asLong());assertEquals(first,data(write(operator,"POST","/api/v1/admin/products",body,idem,201)));
  write(operator,"POST","/api/v1/admin/products",new ProductWrite(category,"不同请求","测试描述","上海","COLD",IMAGE),idem,409);
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_product WHERE product_id=?",Integer.class,id));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_audit_event WHERE resource_id=? AND operation='product.create'",Integer.class,id));
  read(operator,"/api/v1/admin/products?status=DRAFT",200);assertEquals(id,data(read(operator,"/api/v1/admin/products/"+id,200)).path("productId").asString());
  write(operator,"PUT","/api/v1/admin/products/"+id+"/status",new ProductStatus("ON_SALE",0L),key(),409);
  var changed=data(write(operator,"PATCH","/api/v1/admin/products/"+id,Map.of("name","东华苹果","version",0),key(),200));assertEquals(1,changed.path("version").asLong());assertEquals("东华苹果",changed.path("name").asString());
  write(operator,"PATCH","/api/v1/admin/products/"+id,Map.of("name","旧版本覆盖","version",0),key(),409);
  var sku=data(write(operator,"POST","/api/v1/admin/products/"+id+"/skus",new SkuWrite("SKU-"+key(),"标准份","份","PIECE","BY_PIECE",null,1000L,900L,IMAGE),key(),201));String sid=sku.path("skuId").asString();
  assertEquals(0,sku.path("version").asLong());write(operator,"PATCH","/api/v1/admin/skus/"+sid,Map.of("price",800,"memberPrice",900,"version",0),key(),400);
  assertEquals(1,data(write(operator,"PATCH","/api/v1/admin/skus/"+sid,Map.of("memberPrice",850,"version",0),key(),200)).path("version").asLong());
  write(operator,"PUT","/api/v1/admin/products/"+id+"/status",new ProductStatus("ON_SALE",1L),key(),200);assertEquals(850,catalog.product(id).memberPrice());
  write(operator,"PUT","/api/v1/admin/products/"+id+"/status",new ProductStatus("OFF_SALE",2L),key(),200);mvc.perform(get("/api/v1/products/"+id)).andExpect(status().isNotFound());
 }
 @Test void unknownFieldsControlledImagesAndUnitChangesFailClosed()throws Exception{
  write(operator,"POST","/api/v1/admin/products",Map.of("categoryId",category,"name","苹果","description","测试","origin","上海","storage","COLD","imageUrl","https://evil.example/image.jpg"),key(),400);
  Product p=product();for(Object patch:List.of(Map.of("version",1),Map.of("name",List.of(),"version",1),Map.of("status","ON_SALE","version",1),Map.of("imageUrl","http://localhost:5173/api/v1/media/private/unowned/content","version",1)))write(operator,"PATCH","/api/v1/admin/products/"+p.id(),patch,key(),400);
  receive(p,10,Instant.now().plus(Duration.ofDays(8)));
  var patch=new LinkedHashMap<String,Object>();patch.put("baseUnit","GRAM");patch.put("priceMode","BY_WEIGHT");patch.put("priceUnitGram",500);patch.put("version",0);write(operator,"PATCH","/api/v1/admin/skus/"+p.sku(),patch,key(),409);
  assertEquals("PIECE",jdbc.queryForObject("SELECT base_unit FROM fm_sku WHERE sku_id=?",String.class,p.sku()));
  write(operator,"PATCH","/api/v1/admin/skus/"+p.sku(),Map.of("price",9007199254740992L,"version",0),key(),400);
  var fractional=new LinkedHashMap<String,Object>(Map.of("skuCode","FRACTION-"+key(),"name","不能有小数金额","unitLabel","份","baseUnit","PIECE","priceMode","BY_PIECE","price",10.5,"memberPrice",5,"imageUrl",IMAGE));fractional.put("priceUnitGram",null);write(operator,"POST","/api/v1/admin/products/"+p.id()+"/skus",fractional,key(),400);
 }
 @Test void receiptsAdjustmentsFiltersAndLedgerConserveInventory()throws Exception{
  Product p=product();String no="B-"+key(),idem=key();var in=new BatchCreate(no,p.sku(),100L,Instant.now().minusSeconds(3600),Instant.now().plus(Duration.ofDays(8)),"采购验收");var first=data(write(picker,"POST","/api/v1/admin/batches",in,idem,201));String id=first.path("batchId").asString();
  assertEquals(first,data(write(picker,"POST","/api/v1/admin/batches",in,idem,201)));write(picker,"POST","/api/v1/admin/batches",in,key(),409);assertEquals(100,first.path("available").asLong());assertEquals("PIECE",first.path("baseUnit").asString());
  assertEquals(id,data(read(picker,"/api/v1/admin/batches/"+id,200)).path("batchId").asString());assertEquals(1,data(read(picker,"/api/v1/admin/batches?skuId="+p.sku()+"&lifecycle=NORMAL&freshness=NORMAL",200)).path("total").asLong());
  var adjustment=new Adjustment(-3L,"DAMAGE","验收破损；电话13800138000 password=notARealPassword",0L);var changed=data(write(picker,"POST","/api/v1/admin/batches/"+id+"/adjustments",adjustment,key(),200));assertEquals(97,changed.path("onHand").asLong());assertEquals(1,changed.path("version").asLong());
  write(picker,"POST","/api/v1/admin/batches/"+id+"/adjustments",adjustment,key(),409);write(picker,"POST","/api/v1/admin/batches/"+id+"/adjustments",new Adjustment(-98L,"DAMAGE","数量不足",1L),key(),422);
  assertEquals(97,jdbc.queryForObject("SELECT SUM(on_hand_delta) FROM fm_inventory_movement WHERE batch_id=?",Long.class,id));assertEquals(2,data(read(picker,"/api/v1/admin/inventory-movements?batchId="+id,200)).path("total").asLong());assertEquals(97,jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,id));var audit=jdbc.queryForMap("SELECT actor_roles_snapshot,outcome,reason FROM fm_audit_event WHERE resource_id=? AND operation='inventory.adjust'",id);assertEquals("PICKER",audit.get("ACTOR_ROLES_SNAPSHOT"));assertEquals("SUCCESS",audit.get("OUTCOME"));assertFalse(audit.get("REASON").toString().contains("13800138000"));assertFalse(audit.get("REASON").toString().contains("notARealPassword"));
 }
 @Test void realOrderReservationsCannotBeQuarantinedDisposedOrConsumedByAdjustments()throws Exception{
  Product p=product();String batch=receive(p,10,Instant.now().plus(Duration.ofDays(8))).path("batchId").asString();String order=createOrder(quote(p,4));
  long version=jdbc.queryForObject("SELECT version FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch);assertEquals(4,jdbc.queryForObject("SELECT reserved FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch));
  for(String lifecycle:List.of("QUARANTINED","DISPOSED"))write(picker,"PUT","/api/v1/admin/batches/"+batch+"/lifecycle",new Lifecycle(lifecycle,"质检处理",version),key(),409);
  write(picker,"POST","/api/v1/admin/batches/"+batch+"/adjustments",new Adjustment(-7L,"DAMAGE","不可侵占订单预占",version),key(),422);
  var reduced=data(write(picker,"POST","/api/v1/admin/batches/"+batch+"/adjustments",new Adjustment(-2L,"DAMAGE","未预占部分损耗",version),key(),200));assertEquals(8,reduced.path("onHand").asLong());assertEquals(4,reduced.path("reserved").asLong());assertEquals(4,reduced.path("available").asLong());
  assertEquals(4,jdbc.queryForObject("SELECT SUM(reserved_quantity) FROM fm_order_allocation WHERE order_id=?",Long.class,order));
  commerce.cancel(member.actor(),order,new CommerceModels.ReasonVersion("测试取消释放预占",0L),false);assertEquals(0,jdbc.queryForObject("SELECT reserved FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch));assertEquals(8,jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch));
 }
 @Test void quarantineInspectionDisposalAndExpiryDoNotReviveStock()throws Exception{
  Product p=product();String batch=receive(p,10,Instant.now().plus(Duration.ofDays(8))).path("batchId").asString();var quarantine=data(write(picker,"PUT","/api/v1/admin/batches/"+batch+"/lifecycle",new Lifecycle("QUARANTINED","待质检",0L),key(),200));assertEquals(10,quarantine.path("quarantined").asLong());assertEquals(0,quarantine.path("available").asLong());
  var loss=data(write(picker,"POST","/api/v1/admin/batches/"+batch+"/adjustments",new Adjustment(-2L,"DAMAGE","隔离品损耗",1L),key(),200));assertEquals(8,loss.path("onHand").asLong());assertEquals(8,loss.path("quarantined").asLong());
  var normal=data(write(picker,"PUT","/api/v1/admin/batches/"+batch+"/lifecycle",new Lifecycle("NORMAL","质检通过",2L),key(),200));assertEquals(8,normal.path("available").asLong());
  jdbc.update("UPDATE fm_inventory_batch SET produced_at=?,received_at=?,expires_at=? WHERE batch_id=?",Timestamp.from(Instant.now().minus(Duration.ofDays(3))),Timestamp.from(Instant.now().minus(Duration.ofDays(2))),Timestamp.from(Instant.now().minusSeconds(1)),batch);
  assertEquals("EXPIRED",data(read(picker,"/api/v1/admin/batches/"+batch,200)).path("freshness").asString());write(picker,"PUT","/api/v1/admin/batches/"+batch+"/lifecycle",new Lifecycle("NORMAL","不能修改状态续命",3L),key(),409);
  var disposed=data(write(picker,"POST","/api/v1/admin/batches/"+batch+"/adjustments",new Adjustment(-8L,"EXPIRED_DISPOSAL","到期销毁",3L),key(),200));assertEquals("DISPOSED",disposed.path("lifecycle").asString());assertEquals(0,disposed.path("onHand").asLong());write(picker,"PUT","/api/v1/admin/batches/"+batch+"/lifecycle",new Lifecycle("NORMAL","不可恢复",4L),key(),409);
  assertEquals(0,jdbc.queryForObject("SELECT SUM(on_hand_delta) FROM fm_inventory_movement WHERE batch_id=?",Long.class,batch));assertEquals(0,jdbc.queryForObject("SELECT SUM(quarantined_delta) FROM fm_inventory_movement WHERE batch_id=?",Long.class,batch));
 }
 @Test void competingInventoryUpdatesUseSkuThenBatchLocksAndOneVersionWins()throws Exception{
  Product p=product();String batch=receive(p,10,Instant.now().plus(Duration.ofDays(8))).path("batchId").asString();var gate=new CountDownLatch(1);
  try(var pool=Executors.newFixedThreadPool(2)){List<Future<Integer>> futures=new ArrayList<>();for(int i=0;i<2;i++)futures.add(pool.submit(()->{gate.await();try{service.adjust(picker.actor(),batch,new Adjustment(-1L,"DAMAGE","并发损耗验证",0L));return 200;}catch(ApiException e){return e.status();}}));gate.countDown();List<Integer> outcomes=new ArrayList<>();for(var f:futures)outcomes.add(f.get(10,TimeUnit.SECONDS));Collections.sort(outcomes);assertEquals(List.of(200,409),outcomes);}
  assertEquals(9,jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch));assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM fm_inventory_movement WHERE batch_id=?",Integer.class,batch));
 }
 @Test void concurrentDuplicateReceiptsCannotDoubleCountTheSameSkuBatch()throws Exception{
  Product p=product();String no="B-"+key();var gate=new CountDownLatch(1);var in=new BatchCreate(no,p.sku(),5L,Instant.now().minusSeconds(60),Instant.now().plus(Duration.ofDays(8)),"并发相同采购批次");
  try(var pool=Executors.newFixedThreadPool(2)){List<Future<Integer>> futures=new ArrayList<>();for(int i=0;i<2;i++)futures.add(pool.submit(()->{gate.await();try{service.createBatch(picker.actor(),in);return 201;}catch(ApiException e){return e.status();}}));gate.countDown();List<Integer> outcomes=new ArrayList<>();for(var f:futures)outcomes.add(f.get(10,TimeUnit.SECONDS));Collections.sort(outcomes);assertEquals(List.of(201,409),outcomes);}
  assertEquals(5,jdbc.queryForObject("SELECT SUM(on_hand) FROM fm_inventory_batch WHERE sku_id=? AND batch_no=?",Long.class,p.sku(),no));
 }
 @Test void policiesChangeRealCatalogueCartNewQuotesAndNewCouponsButNeverOldSnapshots()throws Exception{
  Product p=product();receive(p,100,Instant.now().plus(Duration.ofDays(5)));var original=quote(p,1);assertEquals(1550,original.price().payableAmount());var snapshot=new TransactionTemplate(tx).execute(s->checkout.lockQuoteForOrder(member.userId(),original.quoteId(),original.quoteToken()));String persisted=checkoutDb.lockQuote(original.quoteId(),member.userId()).snapshotJson();assertEquals(950,catalog.product(p.id()).salePrice());
  var oldOrderQuote=quote(p,1);String order=createOrder(oldOrderQuote);long originalAmount=jdbc.queryForObject("SELECT payable_amount FROM fm_order WHERE order_id=?",Long.class,order);
  var changed=data(write(operator,"PUT","/api/v1/admin/policies",new Policies(200L,5000L,7,5000,200L,0L,0L),key(),200));assertEquals(1,changed.path("version").asLong());assertEquals(200,data(read(operator,"/api/v1/admin/policies",200)).path("freightAmount").asLong());
  assertEquals(500,catalog.product(p.id()).salePrice());assertEquals(500,checkout.addCartItem(member.userId(),new CheckoutModels.CartAddRequest(p.sku(),1L,true)).estimatedGoodsAmount());assertEquals(700,quote(p,1).price().payableAmount());assertEquals(persisted,checkoutDb.lockQuote(original.quoteId(),member.userId()).snapshotJson());assertEquals(409,assertThrows(ApiException.class,()->checkout.validateForOrder(snapshot)).status());assertEquals(originalAmount,jdbc.queryForObject("SELECT payable_amount FROM fm_order WHERE order_id=?",Long.class,order));
  var newMember=auth.register(Long.toString(PHONES.incrementAndGet()),PASSWORD,"新会员");var coupon=checkout.coupons(newMember.body().user().userId()).getFirst();assertEquals(200,coupon.discountAmount());
  write(operator,"PUT","/api/v1/admin/policies",new Policies(200L,5000L,7,5000,0L,0L,1L),key(),200);var noCoupon=auth.register(Long.toString(PHONES.incrementAndGet()),PASSWORD,"停止发券后的会员");assertTrue(checkout.coupons(noCoupon.body().user().userId()).isEmpty());assertEquals(200,checkout.coupons(newMember.body().user().userId()).getFirst().discountAmount());
  write(operator,"PUT","/api/v1/admin/policies",new Policies(1L,1L,1,1,1L,1L,0L),key(),409);write(operator,"PUT","/api/v1/admin/policies",Map.of("freightAmount",0,"secret","not-allowed","version",2),key(),400);
 }
 @Test void slotPolicyIsVersionedPreservesReservationsAndUsesTrueRemainingCount()throws Exception{
  checkout.initializeSlots();String id="slot-test-"+key();LocalDate day=LocalDate.now(CheckoutService.ZONE).plusDays(1);Instant start=day.atTime(22,0).atZone(CheckoutService.ZONE).toInstant();jdbc.update("INSERT INTO fm_delivery_slot(slot_id,slot_date,label,start_at,end_at,cutoff_at,capacity,used,enabled,version) VALUES(?,?,'测试时段',?,?,?,30,5,TRUE,0)",id,day,Timestamp.from(start),Timestamp.from(start.plusSeconds(3600)),Timestamp.from(start));var slot=checkoutDb.slot(id);
  read(operator,"/api/v1/admin/delivery-slots?date="+slot.slotDate(),200);write(operator,"PUT","/api/v1/admin/delivery-slots/"+slot.slotId(),new SlotUpdate(4L,slot.startAt(),true,0L),key(),409);write(operator,"PUT","/api/v1/admin/delivery-slots/"+slot.slotId(),new SlotUpdate(10L,slot.startAt().plusSeconds(1),true,0L),key(),400);
  var changed=data(write(operator,"PUT","/api/v1/admin/delivery-slots/"+slot.slotId(),new SlotUpdate(10L,slot.startAt().minusSeconds(1800),false,0L),key(),200));assertEquals(5,changed.path("remaining").asLong());assertEquals("OUT_OF_SERVICE",changed.path("unavailableReason").asString());assertEquals(1,changed.path("version").asLong());checkout.initializeSlots();assertEquals(10,checkoutDb.slot(slot.slotId()).capacity());assertEquals(5,checkoutDb.slot(slot.slotId()).used());
  write(operator,"PUT","/api/v1/admin/delivery-slots/"+slot.slotId(),new SlotUpdate(30L,slot.startAt(),true,0L),key(),409);
  // This capacity-only fixture has no order references; remove only its own independent slot.
  jdbc.update("DELETE FROM fm_delivery_slot WHERE slot_id=?",slot.slotId());
 }
 @Test void financialInventoryProjectionHasOnlyOrderReferencesAndNoHumanNotes()throws Exception{
  Product p=product();String batch=receive(p,10,Instant.now().plus(Duration.ofDays(8))).path("batchId").asString();String order=createOrder(quote(p,2));jdbc.update("UPDATE fm_inventory_movement SET reason='客户13800138000住某地址；库位A-01' WHERE order_id=?",order);
  var warehouse=data(read(picker,"/api/v1/admin/inventory-movements?batchId="+batch,200));var financeView=data(read(finance,"/api/v1/admin/inventory-movements?batchId="+batch,200));assertEquals(2,warehouse.path("total").asLong());assertEquals(1,financeView.path("total").asLong());var line=financeView.path("items").get(0);assertEquals(order,line.path("orderId").asString());assertEquals(2,line.path("reservedDelta").asLong());assertEquals("system-audit",line.path("actorId").asString());assertFalse(financeView.toString().contains("13800138000"));assertFalse(financeView.toString().contains("库位"));assertFalse(line.has("warehouseId"));assertFalse(line.has("batchNo"));
  read(finance,"/api/v1/admin/batches/"+batch,403);write(finance,"POST","/api/v1/admin/batches/"+batch+"/adjustments",new Adjustment(-1L,"DAMAGE","财务不能改库存",1L),key(),403);
 }
 @Test void guestMemberAdminWrongRolesAndMalformedRequestsCannotReachOperations()throws Exception{
  mvc.perform(get("/api/v1/admin/products")).andExpect(status().isUnauthorized());for(String path:List.of("/api/v1/admin/products","/api/v1/admin/batches","/api/v1/admin/policies","/api/v1/admin/inventory-movements"))read(member,path,403);
  Session admin=account("ADMIN");read(admin,"/api/v1/admin/products",403);read(operator,"/api/v1/admin/batches",403);read(picker,"/api/v1/admin/products",403);read(operator,"/api/v1/admin/products?size=101",400);read(picker,"/api/v1/admin/batches?freshness=INVALID",400);read(operator,"/api/v1/admin/delivery-slots",400);read(operator,"/api/v1/admin/products/unknown-id",404);
  mvc.perform(post("/api/v1/admin/products").header("Authorization","Bearer "+operator.access()).contentType("application/json").content(json.writeValueAsString(new ProductWrite(category,"苹果","描述","上海","COLD",IMAGE)))).andExpect(status().isBadRequest());
 }
 @Test void legacyBatchWithoutProductionRecordDoesNotInventAProductionDate()throws Exception {
  String product="legacy-product-"+UUID.randomUUID(),sku="legacy-sku-"+UUID.randomUUID(),batch="legacy-batch-"+UUID.randomUUID();
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'历史合成商品','历史未知生产时间','上海','COLD',?,'ON_SALE')",product,product,category,IMAGE);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price,member_price,image_url,status) VALUES(?,?,?,'一件','件','PIECE','BY_PIECE',1000,900,?,'ACTIVE')",sku,sku,product,IMAGE);
  Instant received=Instant.now().minusSeconds(86400),expiry=Instant.now().plusSeconds(8*86400);
  jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,produced_at,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'warehouse-main',NULL,?,?,'NORMAL',10,0,0)",batch,sku,batch,Timestamp.from(received),Timestamp.from(expiry));
  var result=mvc.perform(get("/api/v1/admin/batches/"+batch).header("Authorization","Bearer "+picker.access())).andExpect(status().isOk()).andReturn();
  JsonNode view=json.readTree(result.getResponse().getContentAsString()).path("data");assertTrue(view.path("producedAt").isNull());assertNotNull(view.path("receivedAt").asString());
 }
}
