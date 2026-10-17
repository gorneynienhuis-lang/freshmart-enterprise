package com.freshmart.common;
import org.slf4j.Logger;import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MissingServletRequestParameterException;
@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log=LoggerFactory.getLogger(ApiExceptionHandler.class);
  @ExceptionHandler(ApiException.class) public ResponseEntity<ApiEnvelope<ApiError>> api(ApiException e){var builder=ResponseEntity.status(e.status());if(e.status()==429)builder.header("Retry-After","900");return builder.body(ApiEnvelope.error(e.code(),e.getMessage(),ApiError.of(e.errorKey())));}
  @ExceptionHandler(MethodArgumentNotValidException.class) public ResponseEntity<ApiEnvelope<ApiError>> invalid(MethodArgumentNotValidException e){var details=e.getBindingResult().getFieldErrors().stream().map(f->new ApiError.Detail(f.getField(),f.getDefaultMessage()==null?"不合法":f.getDefaultMessage())).toList();return ResponseEntity.badRequest().body(ApiEnvelope.error(1001,"请求参数不合法",new ApiError("VALIDATION_ERROR",false,details)));}
  @ExceptionHandler({HttpMessageNotReadableException.class,ConstraintViolationException.class,HandlerMethodValidationException.class,MethodArgumentTypeMismatchException.class,MissingServletRequestParameterException.class}) public ResponseEntity<ApiEnvelope<ApiError>> malformed(Exception e){return api(ApiException.invalid("请求格式或参数不合法"));}
  @ExceptionHandler(NoResourceFoundException.class) public ResponseEntity<ApiEnvelope<ApiError>> missing(NoResourceFoundException e){return api(ApiException.notFound());}
  @ExceptionHandler(DataIntegrityViolationException.class) public ResponseEntity<ApiEnvelope<ApiError>> duplicate(DataIntegrityViolationException e){return api(ApiException.conflict("数据冲突，请刷新后重试"));}
  @ExceptionHandler(Exception.class) public ResponseEntity<ApiEnvelope<ApiError>> unexpected(Exception e){log.error("Unhandled request error traceId={} type={}",TraceContext.id(),e.getClass().getSimpleName());return ResponseEntity.internalServerError().body(ApiEnvelope.error(1050,"系统暂时不可用",new ApiError("INTERNAL_ERROR",true,List.of())));}
}
