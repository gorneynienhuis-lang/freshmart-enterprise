package com.freshmart.common;
import java.time.OffsetDateTime;
import java.time.ZoneId;
public record ApiEnvelope<T>(int code,String message,T data,String traceId,String timestamp) {
  public static <T> ApiEnvelope<T> ok(T data){return new ApiEnvelope<>(0,"ok",data,TraceContext.id(),OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).toString());}
  public static <T> ApiEnvelope<T> error(int code,String message,T data){return new ApiEnvelope<>(code,message,data,TraceContext.id(),OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).toString());}
}
