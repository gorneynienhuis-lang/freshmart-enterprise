package com.freshmart.checkout;

import com.freshmart.common.*;
import com.freshmart.domain.DomainException;
import com.freshmart.domain.pricing.PriceMode;
import com.freshmart.domain.pricing.PricingCalculator;
import com.freshmart.identity.TokenCodec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import static com.freshmart.checkout.CheckoutModels.*;

@Service
@Transactional
public class CheckoutService {
 public static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
 private final CheckoutMapper mapper;
 private final ObjectMapper json;
 private final TokenCodec tokens;
 private final Clock clock;
 private final int nearDays,discountBps;
 private final long freight,freeThreshold;
 private final Set<String> districts;
 private final PricingCalculator calculator=new PricingCalculator();
 public CheckoutService(CheckoutMapper mapper,ObjectMapper json,TokenCodec tokens,Clock clock,
  @Value("${app.near-expiry-days:3}") int nearDays,@Value("${app.near-expiry-discount-basis-points:9000}") int discountBps,
  @Value("${app.standard-freight:600}") long freight,@Value("${app.free-shipping-threshold:9900}") long freeThreshold,
  @Value("${app.delivery-districts:松江区,长宁区}") String districts){
  this.mapper=mapper;this.json=json;this.tokens=tokens;this.clock=clock;this.nearDays=nearDays;this.discountBps=discountBps;this.freight=freight;this.freeThreshold=freeThreshold;this.districts=Set.copyOf(Arrays.asList(districts.split(",")));
  if(nearDays<1||discountBps<1||discountBps>10000||freight<0||freeThreshold<0)throw new IllegalStateException("Invalid checkout policy");
 }
 @Transactional(readOnly=true) public List<AddressView> addresses(String user){return mapper.addresses(user).stream().map(this::addressView).toList();}
 public AddressView createAddress(String user,AddressInput in){
  lockUser(user);var existing=mapper.addresses(user);if(existing.size()>=20)throw ApiException.invalid("最多保存20个收货地址");
  String id=id();Instant now=clock.instant();boolean makeDefault=in.isDefault()||existing.isEmpty();
  if(makeDefault)mapper.clearDefault(user,id,now);
  var row=new AddressRow(id,user,in.recipientName().trim(),in.phone(),in.province().trim(),in.city().trim(),in.district().trim(),in.detail().trim(),makeDefault,serviceable(in),false,0,now,now);
  mapper.insertAddress(row);audit(user,"ADDRESS_CREATE","ADDRESS",id,"创建本人收货地址");return addressView(row);
 }
 public AddressView updateAddress(String user,String id,AddressUpdateRequest in){
  lockUser(user);var old=ownAddress(id,user,true);checkVersion(old.version(),in.version());Instant now=clock.instant();
  boolean makeDefault=in.isDefault();if(makeDefault)mapper.clearDefault(user,id,now);
  var row=new AddressRow(id,user,in.recipientName().trim(),in.phone(),in.province().trim(),in.city().trim(),in.district().trim(),in.detail().trim(),makeDefault,serviceable(in.input()),false,old.version(),old.createdAt(),now);
  if(mapper.updateAddress(row)!=1)throw ApiException.conflict("地址已变更");
  ensureDefault(user,now);audit(user,"ADDRESS_UPDATE","ADDRESS",id,"修改本人收货地址");return addressView(ownAddress(id,user,false));
 }
 public CommandResult deleteAddress(String user,String id,long version){
  lockUser(user);var old=ownAddress(id,user,true);checkVersion(old.version(),version);
  if(mapper.deleteAddress(id,user,version,clock.instant())!=1)throw ApiException.conflict("地址已变更");
  ensureDefault(user,clock.instant());audit(user,"ADDRESS_DELETE","ADDRESS",id,"删除本人收货地址");return new CommandResult(true,id,version+1,"地址已删除");
 }
 private void ensureDefault(String user,Instant now){var all=mapper.addresses(user);if(!all.isEmpty()&&all.stream().noneMatch(AddressRow::isDefault))mapper.makeDefault(all.getFirst().addressId(),user,now);}
 @Transactional(readOnly=true) public CartView cart(String user){
  var items=new ArrayList<CartItemView>();long total=0,count=0;Instant now=clock.instant();
  for(var item:mapper.cartItems(user)){
   var sku=mapper.sku(item.skuId());if(sku==null)continue;
   var batches=isSaleable(sku)?mapper.availableBatchesAt(sku.skuId(),now,now.plus(Duration.ofDays(nearDays)),false,false,now):List.<BatchRow>of();
   long available=available(batches);long nearAvailable=available(batches.stream().filter(b->!b.expiresAt().isAfter(now.plus(Duration.ofDays(nearDays)))).toList());
   long unit=nearAvailable>=item.quantity()?Math.min(sku.memberPrice(),discount(sku.price())):sku.memberPrice();
   long amount=amount(sku.priceMode(),unit,item.quantity(),sku.priceUnitGram());
   String stock=available==0?"SOLD_OUT":available<=(sku.baseUnit().equals("GRAM")?5000:5)?"LOW":"IN_STOCK";
   items.add(new CartItemView(item.cartItemId(),sku.skuId(),sku.productId(),sku.productName(),sku.unitLabel(),sku.baseUnit(),item.quantity(),unit,amount,item.selected(),stock,sku.imageUrl(),item.version()));
   if(item.selected()){total=add(total,amount);count++;}
  }
  var row=mapper.cart(user);return new CartView(List.copyOf(items),count,total,row==null?0:row.version());
 }
 public CartView addCartItem(String user,CartAddRequest in){
  lockUser(user);mapper.ensureCart(user);mapper.lockCart(user);var sku=requireSku(in.skuId());var old=mapper.cartSku(in.skuId(),user);
  if(old==null&&mapper.cartItems(user).size()>=100)throw ApiException.invalid("购物车最多100种商品");
  long quantity=old==null?in.quantity():add(old.quantity(),in.quantity());checkStock(sku,quantity,clock.instant(),false);
  if(old==null)mapper.insertCartItem(new CartItemRow(id(),user,in.skuId(),quantity,in.selected(),0));
  else if(mapper.updateCartItem(new CartItemRow(old.cartItemId(),user,in.skuId(),quantity,in.selected(),old.version()))!=1)throw ApiException.conflict("购物车已变更");
  mapper.bumpCart(user);return cart(user);
 }
 public CartView updateCartItem(String user,String id,CartUpdateRequest in){
  lockUser(user);var old=mapper.cartItem(id,user);if(old==null)throw ApiException.notFound();checkVersion(old.version(),in.version());mapper.lockCart(user);
  if(in.selected())checkStock(requireSku(old.skuId()),in.quantity(),clock.instant(),false);
  if(mapper.updateCartItem(new CartItemRow(id,user,old.skuId(),in.quantity(),in.selected(),old.version()))!=1)throw ApiException.conflict("购物车已变更");mapper.bumpCart(user);return cart(user);
 }
 public CartView deleteCartItem(String user,String id,long version){lockUser(user);var old=mapper.cartItem(id,user);if(old==null)throw ApiException.notFound();checkVersion(old.version(),version);mapper.lockCart(user);if(mapper.deleteCartItem(id,user,version)!=1)throw ApiException.conflict("购物车已变更");mapper.bumpCart(user);return cart(user);}
 @Transactional(readOnly=true) public List<SlotView> slots(String user,LocalDate date,String addressId){
  var address=ownAddress(addressId,user,false);validateDate(date);return mapper.slots(date).stream().map(s->slotView(s,isServiceable(address))).toList();
 }
 /** Called on application start and hourly; GET does not manufacture inventory or slot data. */
 public void initializeSlots(){
  LocalDate day=clock.instant().atZone(ZONE).toLocalDate();int[] starts={9,14,18},ends={12,17,21};
  for(int d=0;d<2;d++)for(int n=0;n<3;n++){LocalDate date=day.plusDays(d);Instant start=date.atTime(starts[n],0).atZone(ZONE).toInstant(),end=date.atTime(ends[n],0).atZone(ZONE).toInstant();String id="slot-"+date.format(DateTimeFormatter.BASIC_ISO_DATE)+"-"+(n+1);mapper.insertSlot(new SlotRow(id,date,String.format("%02d:00–%02d:00",starts[n],ends[n]),start,end,start,30,0,true,0));}
 }
 @Transactional(readOnly=true) public List<CouponView> coupons(String user){return mapper.coupons(user).stream().map(c->new CouponView(c.couponId(),c.name(),c.discountAmount(),c.minGoodsAmount(),"AVAILABLE".equals(c.status())&&!c.expiresAt().isAfter(clock.instant())?"EXPIRED":c.status(),c.expiresAt().toString(),c.version())).toList();}
 /** Registration integration point. Unique user/campaign plus the user row lock makes grants exactly-once. */
 public void claimNewcomerCoupon(String user){
  lockUser(user);var c=mapper.newcomerCampaign();if(c==null||!c.enabled()||mapper.couponCount(c.campaignId(),user)>0)return;
  Instant now=clock.instant();String id=id();mapper.insertCoupon(new CouponRow(id,user,c.campaignId(),c.name(),c.discountAmount(),c.minGoodsAmount(),"AVAILABLE",now.plus(Duration.ofDays(c.validityDays())),null,0,now));
  audit(user,"NEWCOMER_COUPON_GRANT","COUPON",id,"配置活动 "+c.campaignId()+" 版本 "+c.version());
 }
 public QuoteView quote(String user,QuoteRequest request){
  Instant now=clock.instant(),nearAt=now.plus(Duration.ofDays(nearDays));var address=ownAddress(request.addressId(),user,false);
  if(!isServiceable(address))throw slotUnavailable("地址不在当前配送范围");var slot=mapper.slot(request.slotId());
  if(slot==null)throw ApiException.notFound();validateDate(slot.slotDate());if(!slotView(slot,true).available())throw slotUnavailable("配送时段已截止或无余量");
  CouponRow coupon=null;if(request.couponId()!=null){coupon=mapper.coupon(request.couponId(),user);if(coupon==null)throw ApiException.notFound();if(!coupon.status().equals("AVAILABLE")||!coupon.expiresAt().isAfter(now))throw invalidState("优惠券不可用");}
  var quantities=new TreeMap<String,Long>();for(var item:request.items())quantities.merge(item.skuId(),item.quantity(),CheckoutService::add);
  var skus=new TreeMap<String,SkuRow>();var near=new HashMap<String,Boolean>();var inputs=new ArrayList<PricingCalculator.LineInput>();long reference=0,member=0;
  for(var item:quantities.entrySet()){
   var sku=requireSku(item.getKey());long quantity=item.getValue();var batches=mapper.availableBatchesAt(sku.skuId(),slot.endAt(),nearAt,false,false,now);
   if(available(batches)<quantity)throw insufficientStock(true);
   long nearAvailable=available(batches.stream().filter(b->!b.expiresAt().isAfter(nearAt)).toList());boolean nearOnly=nearAvailable>=quantity&&discount(sku.price())<sku.memberPrice();
   long unit=nearOnly?discount(sku.price()):sku.memberPrice();boolean weight=sku.priceMode().equals("BY_WEIGHT");
   skus.put(sku.skuId(),sku);near.put(sku.skuId(),nearOnly);inputs.add(new PricingCalculator.LineInput(sku.skuId(),PriceMode.valueOf(sku.priceMode()),unit,quantity,weight?quantity:0,weight?sku.priceUnitGram():0,true));
   reference=add(reference,amount(sku.priceMode(),sku.price(),quantity,sku.priceUnitGram()));member=add(member,amount(sku.priceMode(),sku.memberPrice(),quantity,sku.priceUnitGram()));
  }
  PricingCalculator.Quote priced;
  try{priced=calculator.quote(inputs,coupon==null?Optional.empty():Optional.of(new PricingCalculator.Coupon(coupon.discountAmount(),coupon.minGoodsAmount())),new PricingCalculator.FreightPolicy(freeThreshold,freight));}
  catch(DomainException ex){throw ApiException.invalid("金额超限或未满足优惠券门槛");}
  String id=id(),token=tokens.randomToken();Instant expires=now.plusSeconds(300).isBefore(slot.cutoffAt())?now.plusSeconds(300):slot.cutoffAt();
  var lines=new ArrayList<QuoteLineView>();var rows=new ArrayList<QuoteLineRow>();
  for(var line:priced.lines()){
   var in=line.input();var sku=skus.get(in.skuId());boolean isNear=near.get(in.skuId()),weight=sku.priceMode().equals("BY_WEIGHT");Long grams=weight?in.estimatedGram():null,priceGrams=weight?in.priceUnitGram():null,nearPrice=isNear?in.unitPrice():null;
   lines.add(new QuoteLineView(sku.skuId(),sku.productId(),sku.productName(),sku.baseUnit(),sku.priceMode(),in.quantity(),grams,priceGrams,in.unitPrice(),line.couponAllocationAmount(),line.payableAmount(),sku.price(),sku.memberPrice(),nearPrice));
   rows.add(new QuoteLineRow(id,sku.skuId(),sku.productId(),sku.productName(),sku.baseUnit(),sku.priceMode(),in.quantity(),grams,priceGrams,in.unitPrice(),sku.price(),sku.memberPrice(),nearPrice,line.couponAllocationAmount(),line.payableAmount(),sku.version(),isNear,nearAt));
  }
  var price=new PriceSummary(reference,member,member-priced.goodsAmount(),priced.couponDiscountAmount(),priced.goodsPayableAmount(),priced.freightAmount(),priced.payableAmount(),freeThreshold,Math.max(0,freeThreshold-priced.goodsPayableAmount()));
  var view=new QuoteView(id,token,expires.toString(),List.copyOf(lines),price,slotView(slot,true),addressView(address),0);
  mapper.insertQuote(new QuoteRow(id,user,TokenCodec.hash(token),address.addressId(),address.version(),slot.slotId(),coupon==null?null:coupon.couponId(),coupon==null?null:coupon.version(),"OPEN",expires,0,json.writeValueAsString(view),policyFingerprint(),now));
  rows.forEach(mapper::insertQuoteLine);return view;
 }
 /** Caller must retain the surrounding order transaction; this method never reserves stock itself. */
 public QuoteSnapshot lockQuoteForOrder(String user,String quoteId,String quoteToken){
  var row=mapper.lockQuote(quoteId,user);if(row==null)throw ApiException.notFound();
  if(quoteToken==null||!MessageDigest.isEqual(row.tokenHash().getBytes(StandardCharsets.US_ASCII),TokenCodec.hash(quoteToken).getBytes(StandardCharsets.US_ASCII)))throw ApiException.notFound();
  if(!row.expiresAt().isAfter(clock.instant()))throw new ApiException(409,1203,"QUOTE_EXPIRED","报价已过期，请重新结算");
  if(!row.status().equals("OPEN"))throw invalidState("报价已被使用");
  return new QuoteSnapshot(row,json.readValue(row.snapshotJson(),QuoteView.class),mapper.quoteLines(quoteId));
 }
 /** After caller locks address and stable SKU IDs, reject changed prices/policy instead of silently charging more. */
 public void validateForOrder(QuoteSnapshot snapshot){
  if(!snapshot.row().policyFingerprint().equals(policyFingerprint()))throw ApiException.conflict("价格规则已变更，请重新报价");
  var a=ownAddress(snapshot.row().addressId(),snapshot.row().userId(),true);if(a.version()!=snapshot.row().addressVersion()||!isServiceable(a))throw ApiException.conflict("地址已变更，请重新报价");
  var slot=mapper.lockSlot(snapshot.row().slotId());var quotedSlot=snapshot.view().slot();if(slot==null||!slot.startAt().equals(Instant.parse(quotedSlot.startAt()))||!slot.endAt().equals(Instant.parse(quotedSlot.endAt()))||!slot.cutoffAt().equals(Instant.parse(quotedSlot.cutoffAt())))throw ApiException.conflict("配送时段已变更，请重新报价");
  for(var line:snapshot.lines()){var s=mapper.lockSku(line.skuId());if(!isSaleable(s)||s.version()!=line.skuVersion()||s.price()!=line.referenceUnitPrice()||s.memberPrice()!=line.memberUnitPrice()||!s.priceMode().equals(line.priceMode())||!Objects.equals(s.priceUnitGram(),line.priceUnitGram()))throw ApiException.conflict("商品价格或规格已变更，请重新报价");}
 }
 public AddressView addressView(AddressRow row){return new AddressView(row.addressId(),row.recipientName(),row.phone(),row.province(),row.city(),row.district(),row.detail(),row.isDefault(),isServiceable(row),row.version());}
 public SlotView slotView(SlotRow s,boolean serviceable){String reason=!serviceable||!s.enabled()?"OUT_OF_SERVICE":!clock.instant().isBefore(s.cutoffAt())?"CUTOFF":s.used()>=s.capacity()?"FULL":null;return new SlotView(s.slotId(),s.slotDate().toString(),s.label(),s.startAt().toString(),s.endAt().toString(),s.cutoffAt().toString(),Math.max(0,s.capacity()-s.used()),reason==null,reason,s.version());}
 private String policyFingerprint(){return TokenCodec.hash(nearDays+":"+discountBps+":"+freight+":"+freeThreshold+":"+new TreeSet<>(districts));}
 private boolean serviceable(AddressInput in){return "上海市".equals(in.province().trim())&&"上海市".equals(in.city().trim())&&districts.contains(in.district().trim());}
 private boolean isServiceable(AddressRow row){return "上海市".equals(row.province())&&"上海市".equals(row.city())&&districts.contains(row.district());}
 private void validateDate(LocalDate date){LocalDate today=clock.instant().atZone(ZONE).toLocalDate();if(date.isBefore(today)||date.isAfter(today.plusDays(1)))throw ApiException.invalid("仅支持当天或次日预约");}
 private AddressRow ownAddress(String id,String user,boolean lock){var a=lock?mapper.lockAddress(id,user):mapper.address(id,user);if(a==null)throw ApiException.notFound();return a;}
 private void lockUser(String user){if(mapper.lockUser(user)==null)throw ApiException.notFound();}
 private SkuRow requireSku(String id){var s=mapper.sku(id);if(!isSaleable(s))throw ApiException.notFound();return s;}
 private static boolean isSaleable(SkuRow s){return s!=null&&s.categoryEnabled()&&s.status().equals("ACTIVE")&&s.productStatus().equals("ON_SALE");}
 private void checkStock(SkuRow sku,long quantity,Instant end,boolean quote){if(available(mapper.availableBatchesAt(sku.skuId(),end,end.plus(Duration.ofDays(nearDays)),false,false,clock.instant()))<quantity)throw insufficientStock(quote);}
 private static long available(List<BatchRow> rows){BigInteger n=BigInteger.ZERO;for(var row:rows)n=n.add(BigInteger.valueOf(row.available()));return n.min(BigInteger.valueOf(MAX)).longValueExact();}
 private long discount(long price){return BigInteger.valueOf(price).multiply(BigInteger.valueOf(discountBps)).add(BigInteger.valueOf(5000)).divide(BigInteger.valueOf(10000)).longValueExact();}
 private static long amount(String mode,long unit,long quantity,Long grams){try{return mode.equals("BY_WEIGHT")?PricingCalculator.weightedAmount(unit,quantity,grams):bounded(BigInteger.valueOf(unit).multiply(BigInteger.valueOf(quantity)));}catch(DomainException ex){throw ApiException.invalid("金额超出允许范围");}}
 private static long add(long a,long b){return bounded(BigInteger.valueOf(a).add(BigInteger.valueOf(b)));}
 private static long bounded(BigInteger value){if(value.signum()<0||value.compareTo(BigInteger.valueOf(MAX))>0)throw ApiException.invalid("数量或金额超出允许范围");return value.longValueExact();}
 private static void checkVersion(long actual,long expected){if(actual!=expected)throw ApiException.conflict("资源已变更，请刷新后重试");}
 private static ApiException insufficientStock(boolean quote){return new ApiException(422,quote?1101:1201,"INSUFFICIENT_STOCK","可售库存不足或无法覆盖配送窗口");}
 private static ApiException slotUnavailable(String reason){return new ApiException(422,1202,"SLOT_UNAVAILABLE",reason);}
 private static ApiException invalidState(String reason){return new ApiException(409,1007,"INVALID_STATE",reason);}
 private void audit(String actor,String operation,String type,String resource,String reason){mapper.audit(id(),actor,operation,type,resource,reason,TraceContext.id(),clock.instant());}
 private static String id(){return UUID.randomUUID().toString();}
}
