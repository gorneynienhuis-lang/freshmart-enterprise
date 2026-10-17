package com.freshmart.identity;
import java.time.Instant;
public record UserRow(String userId,String phone,String passwordHash,String displayName,String status,boolean mustChangePassword,long version,Instant createdAt,Instant updatedAt){}
