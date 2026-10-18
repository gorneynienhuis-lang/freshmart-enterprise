package com.freshmart.common;
public class ApiException extends RuntimeException {
  private final int status,code; private final String errorKey;
  public ApiException(int status,int code,String errorKey,String message){super(message);this.status=status;this.code=code;this.errorKey=errorKey;}
  public int status(){return status;} public int code(){return code;} public String errorKey(){return errorKey;}
  public long retryAfterSeconds(){return 900;}
  public static ApiException unauthorized(){return new ApiException(401,1002,"UNAUTHENTICATED","需要重新登录");}
  public static ApiException forbidden(){return new ApiException(403,1003,"FORBIDDEN","无操作权限或来源校验失败");}
  public static ApiException notFound(){return new ApiException(404,1004,"NOT_FOUND","资源不存在");}
  public static ApiException invalid(String message){return new ApiException(400,1001,"VALIDATION_ERROR",message);}
  public static ApiException conflict(String message){return new ApiException(409,1009,"VERSION_CONFLICT",message);}
}
