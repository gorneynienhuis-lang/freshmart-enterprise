package com.freshmart.review;
import com.freshmart.common.*;
import com.freshmart.commerce.CommerceMapper;
import com.freshmart.media.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.util.*;

@Service @Transactional public class ReviewService {
 private final ReviewMapper db;private final CommerceMapper commerce;private final MediaService media;private final MediaMapper mediaDb;private final ObjectMapper json;private final Clock clock;
 public ReviewService(ReviewMapper db,CommerceMapper commerce,MediaService media,MediaMapper mediaDb,ObjectMapper json,Clock clock){this.db=db;this.commerce=commerce;this.media=media;this.mediaDb=mediaDb;this.json=json;this.clock=clock;}
 @SuppressWarnings("unchecked") public Map<String,Object> create(RequestActor actor,ReviewModels.Input input){
  actor.requireRole("MEMBER");String orderId=db.orderId(input.orderItemId());if(orderId==null)throw ApiException.notFound();var order=commerce.lockOrder(orderId);if(order==null)throw ApiException.notFound();actor.requireOwner(order.userId);
  if(!"FINISHED".equals(order.status)||db.delivered(orderId,input.orderItemId())<=0)throw new ApiException(409,1007,"INVALID_STATE","仅本人已完成且实际收到的订单行可以评价");
  if(db.exists(input.orderItemId())!=0)throw ApiException.conflict("该订单行已经评价，每行仅能评价一次");
  if(input.rating()==null||input.rating()<1||input.rating()>5||input.content()==null||input.content().isBlank()||input.content().length()>1000||input.anonymous()==null)throw ApiException.invalid("评分或评价内容不合法");
  var snapshot=json.readValue(order.snapshotJson,Map.class);var items=(List<Map<String,Object>>)snapshot.get("items");var item=items.stream().filter(i->input.orderItemId().equals(i.get("orderItemId"))).findFirst().orElseThrow(ApiException::notFound);
  String product=Objects.toString(item.get("productId"),"");if(product.isBlank())throw ApiException.notFound();
  var images=media.requireEvidence(actor,orderId,"REVIEW",input.imageMediaIds());
  var row=new ReviewModels.Row();row.reviewId=UUID.randomUUID().toString();row.orderItemId=input.orderItemId();row.orderId=orderId;row.productId=product;row.memberId=actor.userId();row.rating=input.rating();row.content=input.content().trim();row.anonymous=input.anonymous();row.displayName=maskedName(db.displayName(actor.userId()),row.anonymous);row.createdAt=clock.instant();db.insert(row);
  for(var image:images){media.publishReview(image);db.image(row.reviewId,image.mediaId);}
  db.audit(UUID.randomUUID().toString(),actor.userId(),row.reviewId,TraceContext.id(),clock.instant(),String.join(",",actor.roles().stream().sorted().toList()),"本人已完成且实际交付订单行，一行一评；显式选择评价图授权净化副本公开");return view(row);
 }
 @Transactional(readOnly=true) public PageResult<Map<String,Object>> list(String product,int page,int size){
  if(product==null||!product.matches("[A-Za-z0-9_-]{1,64}"))throw ApiException.notFound();if(page<1||size<1||size>100)throw ApiException.invalid("分页范围不合法");if(db.visibleProduct(product)==0)throw ApiException.notFound();
  return new PageResult<>(page,size,db.count(product),db.list(product,size,(long)(page-1)*size).stream().map(this::view).toList());
 }
 private Map<String,Object> view(ReviewModels.Row row){var result=new LinkedHashMap<String,Object>();result.put("reviewId",row.reviewId);result.put("productId",row.productId);result.put("displayName",row.displayName);result.put("rating",row.rating);result.put("content",row.content);result.put("imageUrls",mediaDb.reviewImages(row.reviewId).stream().map(media::reviewUrl).toList());result.put("createdAt",row.createdAt);return result;}
 private static String maskedName(String name,boolean anonymous){if(anonymous||name==null||name.isBlank())return "匿名用户";int first=name.codePointAt(0);return new String(Character.toChars(first))+"**";}
}
