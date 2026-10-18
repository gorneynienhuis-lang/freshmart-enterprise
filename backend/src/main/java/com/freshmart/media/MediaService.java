package com.freshmart.media;

import com.freshmart.common.*;
import com.freshmart.commerce.CommerceMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service @Transactional public class MediaService {
 private final MediaMapper db;private final CommerceMapper commerce;private final MediaStorage storage;private final ImageSanitizer sanitizer;private final Clock clock;private final byte[] signingKey;private final String publicOrigin;
 public MediaService(MediaMapper db,CommerceMapper commerce,MediaStorage storage,ImageSanitizer sanitizer,Clock clock,@Value("${app.token-secret}")String secret,@Value("${app.public-origin:${app.public-base-url:}}")String origin,@Value("${app.allowed-origins}")String origins){
  this.db=db;this.commerce=commerce;this.storage=storage;this.sanitizer=sanitizer;this.clock=clock;
  this.signingKey=("freshmall:private-media:v1:"+secret).getBytes(StandardCharsets.UTF_8);
  this.publicOrigin=origin(origin.isBlank()?origins.split(",",-1)[0].trim():origin);
 }
 public Map<String,Object> upload(RequestActor actor,String purpose,String orderId,String productId,byte[] bytes,String declaredMime){
  boolean product="PRODUCT".equals(purpose);
  if(product){actor.requireRole("OPERATOR");if(productId!=null){id(productId);if(db.productCount(productId)==0)throw ApiException.notFound();}}
  else{
   actor.requireRole("MEMBER");if(!Set.of("AFTERSALE","REVIEW").contains(purpose))throw ApiException.invalid("图片用途无效");id(orderId);
   var order=commerce.order(orderId);if(order==null)throw ApiException.notFound();actor.requireOwner(order.userId);
   if(order.paidAmount<=0||!Set.of("PAID","PICKING","READY_TO_SHIP","DELIVERING","FINISHED").contains(order.status))throw ApiException.invalid("仅能为本人已付款订单上传图片");
  }
  var raster=sanitizer.clean(bytes,declaredMime);
  db.lockOwner(actor.userId());
  if(db.dayCount(actor.userId(),clock.instant().minus(Duration.ofDays(1)))>=100)throw limit("24小时内最多上传100张图片");
  if(!product&&db.orderCount(actor.userId(),orderId,purpose)>=24)throw limit("同订单同用途最多保留24张图片，请复用已上传图片");
  var row=new MediaRow();row.mediaId=UUID.randomUUID().toString();row.ownerId=actor.userId();row.orderId=product?null:orderId;row.productId=productId;row.purpose=purpose;row.mimeType=raster.mimeType();row.sizeBytes=raster.bytes().length;row.widthPx=raster.width();row.heightPx=raster.height();row.contentSha256=hash(raster.bytes());row.storageKey=storage.put(product?"product":"private",raster.bytes());row.publicKey=product?row.storageKey:null;row.status="READY";row.createdAt=clock.instant();db.insert(row);
  audit(actor,row.mediaId,"media.upload",product?"已验证商品公图并重编码，未保留EXIF":"已绑定本人订单与用途，像素重编码去除元数据");return reference(row,product);
 }
 public Map<String,Object> access(RequestActor actor,String mediaId){
  var row=required(mediaId);authorize(actor,row);content(row,row.storageKey);long expires=clock.instant().plusSeconds(300).getEpochSecond();
  String signature=signature(row.mediaId,actor.userId(),actor.sessionId(),expires);
  String url=publicOrigin+"/api/v1/media/"+row.mediaId+"/content?expiresAt="+expires+"&sessionId="+actor.sessionId()+"&signature="+signature;
  audit(actor,row.mediaId,"media.access.issue","已授权私图，签名绑定主体与会话，300秒有效；不记录签名值");
  return map("mediaId",row.mediaId,"url",url,"expiresAt",Instant.ofEpochSecond(expires));
 }
 @Transactional(readOnly=true) public Content privateContent(RequestActor actor,String mediaId,long expires,String sessionId,String supplied){
  var row=required(mediaId);authorize(actor,row);long now=clock.instant().getEpochSecond();
  if(expires<=now||expires>now+300||!Objects.equals(actor.sessionId(),sessionId)||supplied==null||supplied.length()>100)throw ApiException.notFound();
  String expected=signature(row.mediaId,actor.userId(),actor.sessionId(),expires);
  if(!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),supplied.getBytes(StandardCharsets.US_ASCII)))throw ApiException.notFound();
  return content(row,row.storageKey);
 }
 @Transactional(readOnly=true) public Content publicProduct(String mediaId){var row=required(mediaId);if(!"PRODUCT".equals(row.purpose)||row.publicKey==null)throw ApiException.notFound();return content(row,row.publicKey);}
 @Transactional(readOnly=true) public Content publicReview(String mediaId){var row=required(mediaId);if(!"REVIEW".equals(row.purpose)||row.publicKey==null||db.publishedReview(mediaId)!=1)throw ApiException.notFound();return content(row,row.publicKey);}
 /** Association checks are also called inside the owning business transaction. */
 public List<MediaRow> requireEvidence(RequestActor actor,String orderId,String purpose,List<String> ids){
  if(ids==null||ids.size()>6||new HashSet<>(ids).size()!=ids.size())throw ApiException.invalid("一次最多关联6张不同图片");
  List<MediaRow> result=new ArrayList<>();
  for(String value:ids){id(value);var row=db.lock(value);if(row==null||!"READY".equals(row.status)||!Objects.equals(row.ownerId,actor.userId())||!Objects.equals(row.orderId,orderId)||!purpose.equals(row.purpose))throw ApiException.invalid("图片不存在、未就绪或不属于本人订单的所需用途");content(row,row.storageKey);result.add(row);}
  return result;
 }
 /** Only a REVIEW upload can be explicitly copied to the separately published review scope. */
 public void publishReview(MediaRow row){
  if(!"REVIEW".equals(row.purpose)||row.publicKey!=null)throw ApiException.invalid("图片已发布或用途不允许公开");
  String key=storage.put("review-public",storage.read(row.storageKey));if(db.publish(row.mediaId,key)!=1)throw ApiException.conflict("图片已关联其他评价");row.publicKey=key;
 }
 public String reviewUrl(String mediaId){return publicOrigin+"/api/v1/media/reviews/"+mediaId+"/content";}
 /** No network fetch/SSRF. Private/review media and arbitrary origins cannot become product images. */
 @Transactional(readOnly=true) public void requirePublicProductUrl(String url){
  URI uri;try{uri=URI.create(url);}catch(RuntimeException e){throw ApiException.invalid("商品图片地址不合法");}
  if(!publicOrigin.equals(originOf(uri))||uri.getRawQuery()!=null||uri.getRawFragment()!=null||uri.getUserInfo()!=null)throw ApiException.invalid("商品图片须为本站受控素材");
  String path=uri.getRawPath();
  if(path!=null&&path.matches("/catalog/[A-Za-z0-9_-]{1,100}\\.jpg")&&new ClassPathResource("static"+path).exists())return;
  String prefix="/api/v1/media/products/",suffix="/content";
  if(path!=null&&path.startsWith(prefix)&&path.endsWith(suffix)){String mediaId=path.substring(prefix.length(),path.length()-suffix.length());if(mediaId.matches("[A-Za-z0-9_-]{1,64}")){var row=db.find(mediaId);if(row!=null&&"PRODUCT".equals(row.purpose)&&"READY".equals(row.status)&&row.publicKey!=null){storage.read(row.publicKey);return;}}}
  throw ApiException.invalid("请先上传并使用已就绪的商品公图，不能使用私图或任意外链");
 }
 private void authorize(RequestActor actor,MediaRow row){
  if("PRODUCT".equals(row.purpose))throw ApiException.notFound();
  if(actor.roles().contains("MEMBER")&&actor.userId().equals(row.ownerId))return;
  if(actor.roles().contains("SERVICE")&&"AFTERSALE".equals(row.purpose)&&db.assignedEvidence(row.mediaId,actor.userId())>0)return;
  throw ApiException.notFound();
 }
 private Content content(MediaRow row,String key){byte[] bytes=storage.read(key);if(bytes.length!=row.sizeBytes||!row.contentSha256.equals(hash(bytes)))throw new ApiException(503,1050,"STORAGE_UNAVAILABLE","图片完整性校验失败");return new Content(bytes,row.mimeType);}
 public record Content(byte[] bytes,String mimeType){}
 private Map<String,Object> reference(MediaRow row,boolean product){var result=map("mediaId",row.mediaId,"purpose",row.purpose,"mimeType",row.mimeType,"sizeBytes",row.sizeBytes,"status",row.status,"createdAt",row.createdAt);if(product)result.put("publicUrl",publicOrigin+"/api/v1/media/products/"+row.mediaId+"/content");return result;}
 private MediaRow required(String mediaId){id(mediaId);var row=db.find(mediaId);if(row==null||!"READY".equals(row.status))throw ApiException.notFound();return row;}
 private String signature(String mediaId,String user,String session,long expires){try{var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(signingKey,"HmacSHA256"));return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal((mediaId+"\n"+user+"\n"+session+"\n"+expires).getBytes(StandardCharsets.UTF_8)));}catch(GeneralSecurityException e){throw new IllegalStateException("Media signing unavailable",e);}}
 public static String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 private void audit(RequestActor actor,String media,String operation,String reason){db.audit(UUID.randomUUID().toString(),actor.userId(),operation,media,reason,TraceContext.id(),clock.instant(),String.join(",",actor.roles().stream().sorted().toList()));}
 private static void id(String value){if(value==null||!value.matches("[A-Za-z0-9_-]{1,64}"))throw ApiException.invalid("媒体或订单ID不合法");}
 private static String origin(String value){try{URI uri=URI.create(value);String origin=originOf(uri);if(origin==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||!(uri.getPath()==null||uri.getPath().isEmpty()||uri.getPath().equals("/")))throw new IllegalArgumentException();return origin;}catch(RuntimeException e){throw new IllegalStateException("A trusted HTTP(S) public origin is required for media");}}
 private static String originOf(URI uri){if(!Set.of("http","https").contains(Objects.toString(uri.getScheme(),""))||uri.getHost()==null)return null;return uri.getScheme()+"://"+uri.getHost()+(uri.getPort()<0?"":":"+uri.getPort());}
 private static ApiException limit(String message){return new ApiException(429,1029,"RATE_LIMITED",message);}
 private static Map<String,Object> map(Object... items){var result=new LinkedHashMap<String,Object>();for(int n=0;n<items.length;n+=2)result.put((String)items[n],items[n+1]);return result;}
}
