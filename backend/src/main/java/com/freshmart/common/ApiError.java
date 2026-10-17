package com.freshmart.common;
import java.util.List;
public record ApiError(String errorKey,boolean retryable,List<Detail> details){
  public record Detail(String field,String reason){}
  public static ApiError of(String key){return new ApiError(key,false,List.of());}
}
