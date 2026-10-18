package com.freshmart.aftersale;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
public final class AfterSaleModels {
 private AfterSaleModels(){}
 public static final long MAX=9007199254740991L;
 public static class CaseRow {
  public String aftersaleId,orderId,memberId,caseType,reason,status,assigneeId,reviewerId,reviewComment;
  public long requestedAmount,approvedAmount,version;
  public Instant appliedAt,updatedAt;
 }
 public static class LineRow {
  public String aftersaleId,orderItemId;
  public long quantity,requestedAmount,approvedAmount,refundedAmount;
 }
 public record LineInput(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String orderItemId,@NotNull @Min(1) @Max(MAX) Long quantity,@NotNull @Min(0) @Max(MAX) Long requestedAmount){}
 public record ApplyRequest(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}") String orderId,@NotBlank @Pattern(regexp="QUALITY|SHORTAGE|LATE") String type,@NotBlank @Size(max=1000) String reason,@NotEmpty @Size(max=100) List<@Valid LineInput> items,@NotNull @Size(max=6) List<@Pattern(regexp="[A-Za-z0-9_-]{1,64}") String> evidenceMediaIds){}
 public record ApproveRequest(@NotEmpty @Size(max=100) List<@Valid LineInput> approvedItems,@NotBlank @Size(max=500) String comment,@NotNull @Min(0) @Max(MAX) Long version){}
 public record ReviewRequest(@NotBlank @Size(max=500) String comment,@NotNull @Min(0) @Max(MAX) Long version){}
 public record ReasonVersion(@NotNull @Min(0) @Max(MAX) Long version,@NotBlank @Size(max=500) String reason){}
 public record Version(@NotNull @Min(0) @Max(MAX) Long version){}
}
