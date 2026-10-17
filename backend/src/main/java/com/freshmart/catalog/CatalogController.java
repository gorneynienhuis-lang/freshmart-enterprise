package com.freshmart.catalog;
import com.freshmart.common.*;import org.springframework.web.bind.annotation.*;
import java.util.List;import java.util.Map;
@RestController @RequestMapping("/api/v1")
public class CatalogController {
 private final CatalogService catalog;public CatalogController(CatalogService catalog){this.catalog=catalog;}
 @GetMapping("/categories")public ApiEnvelope<Map<String,List<CatalogService.CategoryView>>> categories(){return ApiEnvelope.ok(Map.of("items",catalog.categories()));}
 @GetMapping("/home")public ApiEnvelope<CatalogService.HomeView> home(){return ApiEnvelope.ok(catalog.home());}
 @GetMapping("/products")public ApiEnvelope<PageResult<CatalogService.ProductView>> products(@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size,@RequestParam(required=false)String categoryId,@RequestParam(required=false)String keyword,@RequestParam(defaultValue="false")boolean nearExpiry,@RequestParam(defaultValue="RECOMMENDED")String sort){return ApiEnvelope.ok(catalog.products(page,size,categoryId,keyword,nearExpiry,sort));}
 @GetMapping("/products/{productId}")public ApiEnvelope<CatalogService.ProductView> product(@PathVariable String productId){return ApiEnvelope.ok(catalog.product(productId));}
 @GetMapping("/products/{productId}/reviews")public ApiEnvelope<PageResult<Map<String,Object>>> reviews(@PathVariable String productId,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return ApiEnvelope.ok(catalog.reviews(productId,page,size));}
}
