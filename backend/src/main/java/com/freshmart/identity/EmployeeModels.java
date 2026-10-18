package com.freshmart.identity;

import jakarta.validation.constraints.*;
import java.util.List;

public final class EmployeeModels {
 private EmployeeModels() {}
 public record Create(@NotBlank @Pattern(regexp="^1[3-9][0-9]{9}$") String phone,
                      @NotBlank @Size(max=60) String displayName,
                      @NotBlank @Size(min=12,max=128) String temporaryPassword,
                      @NotNull @Size(min=1,max=8) List<@NotBlank String> roles) {}
 public record Roles(@NotNull @Size(min=1,max=8) List<@NotBlank String> roles,
                     @NotBlank @Size(max=500) String reason,
                     @NotNull @Min(0) @Max(9007199254740991L) Long version) {}
 public record Status(@NotBlank @Pattern(regexp="ACTIVE|DISABLED") String status,
                      @NotBlank @Size(max=500) String reason,
                      @NotNull @Min(0) @Max(9007199254740991L) Long version) {}
 public record Employee(boolean mustChangePassword,String employeeId,String userId,String displayName,
                        String phoneMasked,List<String> roles,String status,long version) {}
 public record Role(String code,String name,String description,List<String> permissionKeys) {}
 public record RoleList(List<Role> items) {}
}
