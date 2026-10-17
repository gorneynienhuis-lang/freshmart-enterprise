package com.freshmart.command;

import java.time.LocalDateTime;
import org.apache.ibatis.annotations.*;

@Mapper
public interface CommandMapper {
    @Insert("""
        INSERT INTO fm_idempotency(actor_id,route,idempotency_key,request_hash,status,created_at,expires_at)
        VALUES(#{actor},#{route},#{key},#{hash},'PENDING',#{now},#{expires})
        ON DUPLICATE KEY UPDATE idempotency_key=idempotency_key
        """)
    void ensure(@Param("actor") String actor, @Param("route") String route,
                @Param("key") String key, @Param("hash") String hash,
                @Param("now") LocalDateTime now, @Param("expires") LocalDateTime expires);

    @Select("""
        SELECT request_hash,status,result_json FROM fm_idempotency
        WHERE actor_id=#{actor} AND route=#{route} AND idempotency_key=#{key} FOR UPDATE
        """)
    CommandRow lock(@Param("actor") String actor, @Param("route") String route, @Param("key") String key);

    @Update("""
        UPDATE fm_idempotency SET status='COMPLETED',result_json=#{result}
        WHERE actor_id=#{actor} AND route=#{route} AND idempotency_key=#{key} AND status='PENDING'
        """)
    int complete(@Param("actor") String actor, @Param("route") String route,
                 @Param("key") String key, @Param("result") String result);

    record CommandRow(String requestHash, String status, String resultJson) {}
}
