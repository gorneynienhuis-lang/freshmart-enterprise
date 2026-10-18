package com.freshmart.media;

import com.freshmart.aftersale.*;
import com.freshmart.checkout.*;
import com.freshmart.commerce.*;
import com.freshmart.common.*;
import com.freshmart.identity.AuthenticationService;
import com.freshmart.review.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URI;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.zip.CRC32;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real multipart, database, codec, filesystem, original payment flow and authorization; no image/API mocks. */
@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.url=jdbc:h2:mem:mediaReview;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.username=sa","spring.datasource.password=","app.token-secret=media-review-test-secret-not-for-deployment-123456789","app.sandbox-enabled=true","app.sandbox-secret=media-review-sandbox-secret-not-for-deployment-987654321","app.public-origin=http://localhost:8080","app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc @Import(MediaReviewIntegrationTest.TestClockConfiguration.class)
class MediaReviewIntegrationTest {
 static final AtomicLong PHONE=new AtomicLong(13400000000L);
 static final Path FILES=temp();
 static Path temp(){try{return Files.createTempDirectory("freshmart-media-integration-");}catch(IOException e){throw new ExceptionInInitializerError(e);}}
 @DynamicPropertySource static void mediaDirectory(DynamicPropertyRegistry registry){registry.add("app.media-dir",()->FILES.toString());}
 @TestConfiguration static class TestClockConfiguration {@Bean @Primary MutableClock mediaTestClock(){return new MutableClock();}}
 static class MutableClock extends Clock {private Instant now=Instant.now();void reset(){now=Instant.now();}void advance(long seconds){now=now.plusSeconds(seconds);}@Override public ZoneId getZone(){return ZoneOffset.UTC;}@Override public Clock withZone(ZoneId zone){return this;}@Override public Instant instant(){return now;}}
 @Autowired MediaService media;@Autowired MediaMapper mediaDb;@Autowired ImageSanitizer sanitizer;@Autowired ReviewService reviews;
 @Autowired AfterSaleService aftersale;@Autowired AfterSaleMapper afterDb;@Autowired CommerceService commerce;@Autowired CommerceMapper orders;
 @Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;@Autowired AuthenticationService auth;@Autowired JdbcTemplate jdbc;@Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired MutableClock clock;
 @Autowired RefundProcessor processor;@Autowired SandboxRefundGateway gateway;
 record Account(RequestActor actor,String token){}
 Account buyer,outsider,worker,courier,finance,operator;String product,sku,batch,orderId,itemId;
 Account account(String... roles){var issued=auth.register(Long.toString(PHONE.incrementAndGet()),"Media-test-password-2026!","13912345678测试用户");String id=issued.body().user().userId();jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",id);for(String role:roles)jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,?)",id,role);return new Account(auth.authenticate(issued.body().accessToken()),issued.body().accessToken());}
 @BeforeEach void fixture(){
  clock.reset();buyer=account("MEMBER");outsider=account("MEMBER","SERVICE");worker=account("PICKER","SERVICE","FINANCE");courier=account("COURIER");finance=account("FINANCE");operator=account("OPERATOR");
  String category=id();product=id();sku=id();batch=id();jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'真实图片测试','鲜','http://localhost:8080/catalog/S001.jpg')",category,category);
  jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'生鲜商品','媒体评价集成测试','上海','COLD','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,category);
  jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price,member_price,image_url,status) VALUES(?,?,?,'1盒','1盒','PIECE','BY_PIECE',1200,1000,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
  var address=checkout.createAddress(buyer.actor.userId(),new CheckoutModels.AddressInput("同学","13800138000","上海市","上海市","松江区","东华大学演示地址",true));checkout.initializeSlots();var slot=checkoutDb.slots(LocalDate.ofInstant(clock.instant(),CheckoutService.ZONE).plusDays(1)).getFirst();
  jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'W1',?,?,'NORMAL',100,0,0)",batch,sku,batch,Timestamp.from(clock.instant().minusSeconds(3600)),Timestamp.from(slot.endAt().plus(Duration.ofDays(10))));
  var quote=checkout.quote(buyer.actor.userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,1L)),address.addressId(),slot.slotId(),null));orderId=(String)commerce.create(buyer.actor,new CommerceModels.CreateOrder(quote.quoteId(),quote.quoteToken(),null)).get("orderId");var pay=commerce.prepay(buyer.actor,new CommerceModels.Prepay(orderId,"ORDER",null));commerce.simulate(buyer.actor,(String)pay.get("paymentId"),new CommerceModels.Simulate("SUCCESS",number(pay,"version")));
  var order=orders.order(orderId);var task=commerce.claim(worker.actor,order.pickTaskId,new CommerceModels.Version(order.version));var allocation=orders.allocations(orderId).getFirst();itemId=allocation.orderItemId;commerce.confirmPick(worker.actor,order.pickTaskId,new CommerceModels.PickConfirm(List.of(new CommerceModels.PickLine(allocation.allocationId,1L,"NORMAL","实际收到")),number(task,"version")));
  order=orders.order(orderId);commerce.dispatch(worker.actor,order.deliveryTaskId,new CommerceModels.Dispatch(courier.actor.userId(),order.version));order=orders.order(orderId);commerce.complete(courier.actor,order.deliveryTaskId,new CommerceModels.Complete(order.receiptCode,"已真实签收",order.version));assertEquals("FINISHED",orders.order(orderId).status);
 }
 @AfterAll static void deleteTestFiles()throws IOException{try(var paths=Files.walk(FILES)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(p);}}
 static String id(){return UUID.randomUUID().toString();}
 static long number(Map<String,Object> map,String name){return ((Number)map.get(name)).longValue();}
 static byte[] png()throws IOException{BufferedImage image=new BufferedImage(16,12,BufferedImage.TYPE_INT_RGB);image.setRGB(0,0,0x55AA33);var out=new ByteArrayOutputStream();ImageIO.write(image,"PNG",out);return out.toByteArray();}
 static byte[] jpegWithExif()throws IOException{BufferedImage image=new BufferedImage(16,12,BufferedImage.TYPE_INT_RGB);var base=new ByteArrayOutputStream();ImageIO.write(image,"JPEG",base);byte[] raw=base.toByteArray(),metadata="Exif\0\0GPS-private-location-should-not-survive".getBytes(java.nio.charset.StandardCharsets.US_ASCII);var result=new ByteArrayOutputStream();result.write(raw,0,2);result.write(0xFF);result.write(0xE1);result.write((metadata.length+2)>>8);result.write((metadata.length+2)&255);result.write(metadata);result.write(raw,2,raw.length-2);return result.toByteArray();}
 Map<String,Object> upload(String purpose)throws IOException{return media.upload(buyer.actor,purpose,orderId,null,png(),"image/png");}
 String mediaId(String purpose)throws IOException{return (String)upload(purpose).get("mediaId");}
 Map<String,String> query(String url){var result=new HashMap<String,String>();for(String pair:URI.create(url).getRawQuery().split("&")){String[] p=pair.split("=",2);result.put(p[0],p[1]);}return result;}

 @Test void multipartUploadDecodesReencodesStripsExifAndRetriesExactlyOnce()throws Exception{
  byte[] bytes=jpegWithExif();String key=id();var file=new MockMultipartFile("file","../../not-trusted.png","image/jpeg",bytes);
  var first=mvc.perform(multipart("/api/v1/media/images").file(file).param("purpose","AFTERSALE").param("orderId",orderId).header("Authorization","Bearer "+buyer.token).header("Idempotency-Key",key)).andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("READY")).andReturn();
  String mediaId=json.readTree(first.getResponse().getContentAsString()).path("data").path("mediaId").asString();
  mvc.perform(multipart("/api/v1/media/images").file(file).param("purpose","AFTERSALE").param("orderId",orderId).header("Authorization","Bearer "+buyer.token).header("Idempotency-Key",key)).andExpect(status().isCreated()).andExpect(jsonPath("$.data.mediaId").value(mediaId));
  assertEquals(1,mediaDb.orderCount(buyer.actor.userId(),orderId,"AFTERSALE"));
  assertEquals("MEMBER",jdbc.queryForObject("SELECT actor_roles_snapshot FROM fm_audit_event WHERE resource_id=? AND operation='media.upload'",String.class,mediaId));assertEquals("SUCCESS",jdbc.queryForObject("SELECT outcome FROM fm_audit_event WHERE resource_id=? AND operation='media.upload'",String.class,mediaId));
  var access=media.access(buyer.actor,mediaId);var parameters=query((String)access.get("url"));var content=media.privateContent(buyer.actor,mediaId,Long.parseLong(parameters.get("expiresAt")),parameters.get("sessionId"),parameters.get("signature"));
  assertNotNull(ImageIO.read(new ByteArrayInputStream(content.bytes())));String normalized=new String(content.bytes(),java.nio.charset.StandardCharsets.ISO_8859_1);assertFalse(normalized.contains("Exif"));assertFalse(normalized.contains("GPS-private"));assertEquals("image/jpeg",content.mimeType());
  mvc.perform(multipart("/api/v1/media/images").file(new MockMultipartFile("file","same.jpg","image/png",png())).param("purpose","AFTERSALE").param("orderId",orderId).header("Authorization","Bearer "+buyer.token).header("Idempotency-Key",key)).andExpect(status().isConflict());
 }
 @Test void fakeFormatMimeMismatchOversizeAndPixelBombAreRejectedBeforeAllocation()throws Exception{
  for(byte[] invalid:List.of("<svg onload='alert(1)'></svg>".getBytes(),"<html>fake image</html>".getBytes(),new byte[ImageSanitizer.MAX_BYTES+1]))assertEquals(400,assertThrows(ApiException.class,()->sanitizer.clean(invalid,"image/png")).status());
  assertEquals(400,assertThrows(ApiException.class,()->sanitizer.clean(png(),"image/jpeg")).status());
  byte[] bomb=png();for(int offset:new int[]{16,20}){bomb[offset]=0;bomb[offset+1]=0;bomb[offset+2]=0x1B;bomb[offset+3]=0x58;}CRC32 crc=new CRC32();crc.update(bomb,12,17);long sum=crc.getValue();for(int n=0;n<4;n++)bomb[29+n]=(byte)(sum>>(24-8*n));assertEquals(400,assertThrows(ApiException.class,()->sanitizer.clean(bomb,"image/png")).status());
  assertEquals(404,assertThrows(ApiException.class,()->media.upload(outsider.actor,"AFTERSALE",orderId,null,png(),"image/png")).status());
 }
 @Test void webpActuallyDecodesToSanitizedPngAndAnimatedInputIsNotAccepted()throws Exception{
  try(var in=getClass().getResourceAsStream("/media/small_1x1.webp")){assertNotNull(in);var value=media.upload(buyer.actor,"REVIEW",orderId,null,in.readAllBytes(),"image/webp");assertEquals("image/png",value.get("mimeType"));}
  try(var in=getClass().getResourceAsStream("/media/animated-webp-supported.webp")){assertNotNull(in);assertEquals(400,assertThrows(ApiException.class,()->sanitizer.clean(in.readAllBytes(),"image/webp")).status());}
 }
 @Test void signedPixelsRequireSameActiveBearerSessionCurrentScopeAndUnexpiredSignature()throws Exception{
  String mediaId=mediaId("AFTERSALE");var access=media.access(buyer.actor,mediaId);String url=(String)access.get("url"),relative=URI.create(url).getRawPath()+"?"+URI.create(url).getRawQuery();
  mvc.perform(get(relative).header("Authorization","Bearer "+buyer.token)).andExpect(status().isOk()).andExpect(content().contentType("image/png")).andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("X-Content-Type-Options","nosniff"));
  mvc.perform(get(relative)).andExpect(status().isUnauthorized());mvc.perform(get(relative).header("Authorization","Bearer "+outsider.token)).andExpect(status().isNotFound());
  mvc.perform(get(relative.replace("signature=","signature=x")).header("Authorization","Bearer "+buyer.token)).andExpect(status().isNotFound());
  var second=auth.login(jdbc.queryForObject("SELECT phone FROM fm_user WHERE user_id=?",String.class,buyer.actor.userId()),"Media-test-password-2026!");mvc.perform(get(relative).header("Authorization","Bearer "+second.body().accessToken())).andExpect(status().isNotFound());
  clock.advance(301);mvc.perform(get(relative).header("Authorization","Bearer "+buyer.token)).andExpect(status().isNotFound());
  jdbc.update("UPDATE fm_auth_session SET status='REVOKED' WHERE session_id=?",buyer.actor.sessionId());mvc.perform(get(relative).header("Authorization","Bearer "+buyer.token)).andExpect(status().isUnauthorized());
 }
 @Test void qualityEvidenceIsBoundToOwnOrderPurposeAndClaimedServiceWithoutChangingStockOrRefundRules()throws Exception{
  String evidence=mediaId("AFTERSALE"),review=mediaId("REVIEW");var lines=List.of(new AfterSaleModels.LineInput(itemId,1L,200L));
  assertEquals(400,assertThrows(ApiException.class,()->media.requireEvidence(buyer.actor,id(),"AFTERSALE",List.of(evidence))).status());
  assertEquals(400,assertThrows(ApiException.class,()->aftersale.apply(buyer.actor,new AfterSaleModels.ApplyRequest(orderId,"QUALITY","没有照片",lines,List.of()))).status());
  assertEquals(400,assertThrows(ApiException.class,()->aftersale.apply(buyer.actor,new AfterSaleModels.ApplyRequest(orderId,"QUALITY","错用途照片",lines,List.of(review)))).status());
  assertEquals(404,assertThrows(ApiException.class,()->media.access(worker.actor,evidence)).status());
  String afterId=(String)aftersale.apply(buyer.actor,new AfterSaleModels.ApplyRequest(orderId,"QUALITY","真实品质问题",lines,List.of(evidence))).get("aftersaleId");
  assertEquals(List.of(),aftersale.get(worker.actor,afterId,true).get("evidenceMediaIds"));aftersale.claim(worker.actor,afterId,new AfterSaleModels.Version(0L));assertNotNull(media.access(worker.actor,evidence));assertEquals(404,assertThrows(ApiException.class,()->media.access(outsider.actor,evidence)).status());
  long onHand=jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch);aftersale.approve(worker.actor,afterId,new AfterSaleModels.ApproveRequest(lines,"已核验实图",1L));var refund=afterDb.caseRefunds(afterId).getFirst();assertEquals(403,assertThrows(ApiException.class,()->aftersale.execute(worker.actor,refund.refundId,new AfterSaleModels.ReasonVersion(refund.version,"审核人试图自退"),false)).status());
  aftersale.execute(finance.actor,refund.refundId,new AfterSaleModels.ReasonVersion(refund.version,"独立财务复核"),false);var claimed=processor.claim(refund.refundId);assertNotNull(claimed);gateway.execute(claimed);processor.complete(claimed);assertEquals("COMPLETED",afterDb.find(afterId).status);assertEquals(onHand,jdbc.queryForObject("SELECT on_hand FROM fm_inventory_batch WHERE batch_id=?",Long.class,batch));assertEquals(200,orders.order(orderId).refundedAmount);
 }
 @Test void finishedLineCanBeReviewedOnlyOnceWithMaskedProjectionAndExplicitPublicReviewCopy()throws Exception{
  String image=mediaId("REVIEW"),privateEvidence=mediaId("AFTERSALE");var input=new ReviewModels.Input(itemId,5,"生鲜很好，是真实订单评价",List.of(image),false);
  assertEquals(404,assertThrows(ApiException.class,()->reviews.create(outsider.actor,input)).status());
  assertEquals(400,assertThrows(ApiException.class,()->reviews.create(buyer.actor,new ReviewModels.Input(itemId,5,"私图不能公开",List.of(privateEvidence),false))).status());
  var value=reviews.create(buyer.actor,input);assertEquals(409,assertThrows(ApiException.class,()->reviews.create(buyer.actor,input)).status());assertEquals("1**",value.get("displayName"));
  var page=reviews.list(product,1,20);assertEquals(1,page.total());String publicJson=json.writeValueAsString(page);for(String secret:List.of(orderId,itemId,buyer.actor.userId(),"13912345678","phone","storageKey","signature","AFTERSALE"))assertFalse(publicJson.contains(secret));
  assertNotNull(ImageIO.read(new ByteArrayInputStream(media.publicReview(image).bytes())));assertEquals(404,assertThrows(ApiException.class,()->media.publicReview(privateEvidence)).status());assertEquals(404,assertThrows(ApiException.class,()->media.publicProduct(image)).status());
  mvc.perform(get("/api/v1/products/"+product+"/reviews")).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].imageUrls[0]").value("http://localhost:8080/api/v1/media/reviews/"+image+"/content"));
 }
 @Test void unfinishedLineAndInvalidImageCountsCannotBeReviewedOrLinked()throws Exception{
  jdbc.update("UPDATE fm_order SET status='DELIVERING' WHERE order_id=?",orderId);assertEquals(409,assertThrows(ApiException.class,()->reviews.create(buyer.actor,new ReviewModels.Input(itemId,4,"尚未完成",List.of(),true))).status());jdbc.update("UPDATE fm_order SET status='FINISHED' WHERE order_id=?",orderId);
  String image=mediaId("REVIEW");assertEquals(400,assertThrows(ApiException.class,()->reviews.create(buyer.actor,new ReviewModels.Input(itemId,4,"重复图片",List.of(image,image),true))).status());assertEquals(400,assertThrows(ApiException.class,()->reviews.create(buyer.actor,new ReviewModels.Input(itemId,4,"超过六张",Collections.nCopies(7,image),true))).status());
  String key=id(),body=json.writeValueAsString(new ReviewModels.Input(itemId,4,"匿名评价",List.of(),true));for(int n=0;n<2;n++)mvc.perform(post("/api/v1/reviews").header("Authorization","Bearer "+buyer.token).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.data.displayName").value("匿名用户"));assertEquals(1,reviews.list(product,1,20).total());
 }
 @Test void productImagesUseSeparatePublicScopeAndNoExternalUrlOrPrivateMediaCanBePromoted()throws Exception{
  var value=media.upload(operator.actor,"PRODUCT",null,product,png(),"image/png");String image=(String)value.get("mediaId"),url=(String)value.get("publicUrl");media.requirePublicProductUrl(url);media.requirePublicProductUrl("http://localhost:8080/catalog/S001.jpg");
  assertNotNull(ImageIO.read(new ByteArrayInputStream(media.publicProduct(image).bytes())));assertEquals(404,assertThrows(ApiException.class,()->media.access(operator.actor,image)).status());String evidence=mediaId("AFTERSALE");
  for(String invalid:List.of("https://untrusted.invalid/photo.jpg","http://localhost:8080/api/v1/media/"+evidence+"/content","http://localhost:8080/catalog/not-present.jpg","http://localhost:8080/catalog/../S001.jpg","http://localhost:8080/api/v1/media/products/"+evidence+"/content"))assertEquals(400,assertThrows(ApiException.class,()->media.requirePublicProductUrl(invalid)).status());
  mvc.perform(get("/api/v1/media/products/"+image+"/content")).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
  assertEquals(403,assertThrows(ApiException.class,()->media.upload(buyer.actor,"PRODUCT",null,product,png(),"image/png")).status());
 }
 @Test void concurrentReviewSubmissionsPersistExactlyOneReview()throws Exception{
  var input=new ReviewModels.Input(itemId,5,"并发评价只保留一次",List.of(),true);
  try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
   var gate=new java.util.concurrent.CountDownLatch(1);var jobs=new ArrayList<java.util.concurrent.Future<Boolean>>();
   for(int n=0;n<2;n++)jobs.add(pool.submit(()->{gate.await();try{reviews.create(buyer.actor,input);return true;}catch(ApiException expected){assertEquals(409,expected.status());return false;}}));
   gate.countDown();int winners=0;for(var job:jobs)if(job.get(10,java.util.concurrent.TimeUnit.SECONDS))winners++;assertEquals(1,winners);assertEquals(1,reviews.list(product,1,20).total());
  }
 }
}
