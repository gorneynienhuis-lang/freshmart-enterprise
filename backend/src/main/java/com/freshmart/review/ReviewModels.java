package com.freshmart.review;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
public final class ReviewModels {
 private ReviewModels(){}
 public record Input(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}")String orderItemId,@NotNull @Min(1) @Max(5)Integer rating,@NotBlank @Size(max=1000)String content,@NotNull @Size(max=6)List<@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{1,64}")String> imageMediaIds,@NotNull Boolean anonymous){}
 public static class Row{public String reviewId,orderItemId,orderId,productId,memberId,content,displayName;public int rating;public boolean anonymous;public Instant createdAt;}
}
