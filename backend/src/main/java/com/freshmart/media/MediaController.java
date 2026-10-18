package com.freshmart.media;
import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;

@RestController @RequestMapping("/api/v1") public class MediaController {
 private final MediaService service;private final IdempotencyService commands;private final ObjectMapper json;
 public MediaController(MediaService service,IdempotencyService commands,ObjectMapper json){this.service=service;this.commands=commands;this.json=json;}
 @PostMapping(value="/media/images",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
 public ApiEnvelope<?> upload(@RequestParam String purpose,@RequestParam String orderId,@RequestPart MultipartFile file,HttpServletRequest request)throws IOException{return upload(request,purpose,orderId,null,file);}
 @PostMapping(value="/admin/media/images",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
 public ApiEnvelope<?> product(@RequestParam(required=false)String productId,@RequestPart MultipartFile file,HttpServletRequest request)throws IOException{return upload(request,"PRODUCT",null,productId==null||productId.isBlank()?null:productId,file);}
 @GetMapping("/media/{mediaId}/access") public ApiEnvelope<?> access(@PathVariable String mediaId,HttpServletRequest request){return ApiEnvelope.ok(service.access(RequestActor.current(request),mediaId));}
 @GetMapping("/media/{mediaId}/content") public ResponseEntity<byte[]> privateContent(@PathVariable String mediaId,@RequestParam long expiresAt,@RequestParam String sessionId,@RequestParam String signature,HttpServletRequest request){return response(service.privateContent(RequestActor.current(request),mediaId,expiresAt,sessionId,signature),false);}
 @GetMapping("/media/products/{mediaId}/content") public ResponseEntity<byte[]> productContent(@PathVariable String mediaId){return response(service.publicProduct(mediaId),true);}
 @GetMapping("/media/reviews/{mediaId}/content") public ResponseEntity<byte[]> reviewContent(@PathVariable String mediaId){return response(service.publicReview(mediaId),true);}
 @SuppressWarnings("unchecked") private ApiEnvelope<?> upload(HttpServletRequest request,String purpose,String orderId,String productId,MultipartFile file)throws IOException{
  if(file.getSize()<1||file.getSize()>ImageSanitizer.MAX_BYTES)throw ApiException.invalid("图片最多6MiB");byte[] bytes;try(var stream=file.getInputStream()){bytes=stream.readNBytes(ImageSanitizer.MAX_BYTES+1);}if(bytes.length>ImageSanitizer.MAX_BYTES)throw ApiException.invalid("图片最多6MiB");
  String mime=file.getContentType();var body=new java.util.LinkedHashMap<String,Object>();body.put("purpose",purpose);body.put("orderId",orderId);body.put("productId",productId);body.put("mimeType",mime);body.put("sourceSha256",MediaService.hash(bytes));
  var actor=RequestActor.current(request);return ApiEnvelope.ok(commands.execute(actor.userId(),request.getMethod()+" "+request.getRequestURI(),CommandHeaders.requireIdempotencyKey(request),json.writeValueAsString(body),Map.class,()->service.upload(actor,purpose,orderId,productId,bytes,mime)));
 }
 private static ResponseEntity<byte[]> response(MediaService.Content value,boolean publicImage){return ResponseEntity.ok().contentType(MediaType.parseMediaType(value.mimeType())).header("X-Content-Type-Options","nosniff").header("Content-Disposition","inline").cacheControl(publicImage?CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePublic():CacheControl.noStore()).body(value.bytes());}
}
