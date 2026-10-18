package com.freshmart.commerce;

import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;
import static com.freshmart.commerce.CommerceModels.*;

@Mapper
public interface CommerceMapper {
    @Select("SELECT * FROM fm_order WHERE order_id=#{id}") OrderRow order(String id);
    @Select("SELECT * FROM fm_order WHERE order_id=#{id} FOR UPDATE") OrderRow lockOrder(String id);
    @Select("SELECT * FROM fm_order WHERE pick_task_id=#{id}") OrderRow byPick(String id);
    @Select("SELECT * FROM fm_order WHERE delivery_task_id=#{id}") OrderRow byDelivery(String id);
    @Select("<script>SELECT * FROM fm_order WHERE 1=1 <if test='user!=null'>AND user_id=#{user}</if><if test='status!=null'>AND status=#{status}</if> ORDER BY created_at DESC,order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> orders(@Param("user") String user,@Param("status") String status,@Param("limit") int limit,@Param("offset") long offset);
    @Select("<script>SELECT COUNT(*) FROM fm_order WHERE 1=1 <if test='user!=null'>AND user_id=#{user}</if><if test='status!=null'>AND status=#{status}</if></script>")
    long orderCount(@Param("user") String user,@Param("status") String status);
    String SUPPORT_SCOPE="EXISTS(SELECT 1 FROM fm_aftersale a WHERE a.order_id=o.order_id AND a.assignee_id=#{actor} AND a.member_id&lt;&gt;#{actor})";
    @Select("<script>SELECT * FROM fm_order o WHERE "+SUPPORT_SCOPE+"<if test='status!=null'> AND o.status=#{status}</if> ORDER BY o.created_at DESC,o.order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> supportOrders(@Param("actor")String actor,@Param("status")String status,@Param("limit")int limit,@Param("offset")long offset);
    @Select("<script>SELECT COUNT(*) FROM fm_order o WHERE "+SUPPORT_SCOPE+"<if test='status!=null'> AND o.status=#{status}</if></script>")
    long supportOrderCount(@Param("actor")String actor,@Param("status")String status);
    @Select("SELECT COUNT(*) FROM fm_aftersale WHERE order_id=#{order} AND assignee_id=#{actor} AND member_id != #{actor}")
    int supportScope(@Param("order")String order,@Param("actor")String actor);
    String PICK_SCOPE="paid_at IS NOT NULL AND (picker_id IS NULL OR picker_id=#{actor})";
    @Select("<script>SELECT * FROM fm_order WHERE "+PICK_SCOPE+"<if test='status!=null'> AND pick_status=#{status}</if> ORDER BY created_at,order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> pickOrders(@Param("actor")String actor,@Param("status")String status,@Param("limit")int limit,@Param("offset")long offset);
    @Select("<script>SELECT COUNT(*) FROM fm_order WHERE "+PICK_SCOPE+"<if test='status!=null'> AND pick_status=#{status}</if></script>")
    long pickCount(@Param("actor")String actor,@Param("status")String status);
    String DELIVERY_SCOPE="(o.status IN ('READY_TO_SHIP','DELIVERING','FINISHED') OR o.dispatched_at IS NOT NULL) AND ((#{picker}=TRUE AND o.picker_id=#{actor}) OR (#{courier}=TRUE AND o.courier_id=#{actor}) OR (#{support}=TRUE AND "+SUPPORT_SCOPE+"))";
    @Select("<script>SELECT o.* FROM fm_order o WHERE "+DELIVERY_SCOPE+"<if test='status!=null'> AND o.delivery_status=#{status}</if> ORDER BY o.created_at,o.order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> deliveryOrders(@Param("actor")String actor,@Param("picker")boolean picker,@Param("courier")boolean courier,@Param("support")boolean support,@Param("status")String status,@Param("limit")int limit,@Param("offset")long offset);
    @Select("<script>SELECT COUNT(*) FROM fm_order o WHERE "+DELIVERY_SCOPE+"<if test='status!=null'> AND o.delivery_status=#{status}</if></script>")
    long deliveryCount(@Param("actor")String actor,@Param("picker")boolean picker,@Param("courier")boolean courier,@Param("support")boolean support,@Param("status")String status);
    @Insert("""
      INSERT INTO fm_order(order_id,order_no,user_id,quote_id,slot_id,coupon_id,status,snapshot_json,payable_amount,paid_amount,
      refunded_amount,adjustment_status,adjustment_delta,pick_task_id,pick_status,delivery_task_id,delivery_status,slot_held,
      created_at,updated_at,payment_expires_at,paid_at,version)
      VALUES(#{orderId},#{orderNo},#{userId},#{quoteId},#{slotId},#{couponId},#{status},#{snapshotJson},#{payableAmount},#{paidAmount},
      #{refundedAmount},#{adjustmentStatus},#{adjustmentDelta},#{pickTaskId},#{pickStatus},#{deliveryTaskId},#{deliveryStatus},#{slotHeld},
      #{createdAt},#{updatedAt},#{paymentExpiresAt},#{paidAt},#{version})
      """) void insertOrder(OrderRow row);
    @Update("""
      UPDATE fm_order SET status=#{status},snapshot_json=#{snapshotJson},paid_amount=#{paidAmount},refunded_amount=#{refundedAmount},
      accepted_payment_id=#{acceptedPaymentId},adjustment_id=#{adjustmentId},adjustment_status=#{adjustmentStatus},adjustment_delta=#{adjustmentDelta},
      adjustment_expires_at=#{adjustmentExpiresAt},topup_payment_id=#{topupPaymentId},adjustment_json=#{adjustmentJson},
      picker_id=#{pickerId},pick_status=#{pickStatus},courier_id=#{courierId},delivery_status=#{deliveryStatus},receipt_code=#{receiptCode},
      slot_held=#{slotHeld},updated_at=#{updatedAt},paid_at=#{paidAt},dispatched_at=#{dispatchedAt},finished_at=#{finishedAt},version=#{version}
      WHERE order_id=#{orderId}
      """) void updateOrder(OrderRow row);
    @Select("SELECT * FROM fm_order WHERE (status='PENDING_PAY' AND payment_expires_at<=#{now}) OR (status='READY_TO_SHIP' AND adjustment_status='TOP_UP_PENDING' AND adjustment_expires_at<=#{now}) ORDER BY order_id LIMIT 100")
    List<OrderRow> dueOrders(Instant now);
    @Select("SELECT user_id FROM fm_user WHERE user_id=#{id} FOR UPDATE") String lockUser(String id);
    @Select("SELECT COUNT(*) FROM fm_user u JOIN fm_user_role r ON r.user_id=u.user_id WHERE u.user_id=#{id} AND u.status='ACTIVE' AND r.role_code=#{role}")
    int activeRole(@Param("id")String id,@Param("role")String role);
    @Update("UPDATE fm_delivery_slot SET used=used+1,version=version+1 WHERE slot_id=#{id} AND used<capacity") int reserveSlot(String id);
    @Update("UPDATE fm_delivery_slot SET used=used-1,version=version+1 WHERE slot_id=#{id} AND used>0") int releaseSlot(String id);
    @Update("UPDATE fm_coupon SET status='LOCKED',locked_order_id=#{order},version=version+1 WHERE coupon_id=#{id} AND status='AVAILABLE'") int lockCoupon(@Param("id")String id,@Param("order")String order);
    @Update("UPDATE fm_coupon SET status='USED',version=version+1 WHERE coupon_id=#{id} AND status='LOCKED' AND locked_order_id=#{order}") int useCoupon(@Param("id")String id,@Param("order")String order);
    @Update("UPDATE fm_coupon SET status=CASE WHEN expires_at<=#{now} THEN 'EXPIRED' ELSE 'AVAILABLE' END,locked_order_id=NULL,version=version+1 WHERE coupon_id=#{id} AND status='LOCKED' AND locked_order_id=#{order}")
    int releaseCoupon(@Param("id")String id,@Param("order")String order,@Param("now")Instant now);
    @Select("SELECT batch_id,sku_id,batch_no,lifecycle_status,on_hand,reserved,quarantined,received_at,expires_at,version FROM fm_inventory_batch WHERE batch_id=#{id} FOR UPDATE") BatchRow lockBatch(String id);
    @Select("<script>SELECT batch_id,sku_id,batch_no,lifecycle_status,on_hand,reserved,quarantined,received_at,expires_at,version FROM fm_inventory_batch WHERE sku_id=#{sku} AND lifecycle_status='NORMAL' AND expires_at&gt;#{end} <if test='near!=null'>AND expires_at&lt;=#{near}</if> ORDER BY expires_at,received_at,batch_id FOR UPDATE</script>")
    List<BatchRow> lockBatches(@Param("sku")String sku,@Param("end")Instant end,@Param("near")Instant near);
    @Update("UPDATE fm_inventory_batch SET on_hand=on_hand+#{hand},reserved=reserved+#{reserved},quarantined=quarantined+#{quarantine},version=version+1,updated_at=#{now} WHERE batch_id=#{id} AND version=#{version}")
    int moveBatch(@Param("id")String id,@Param("hand")long hand,@Param("reserved")long reserved,@Param("quarantine")long quarantine,@Param("version")long version,@Param("now")Instant now);
    @Insert("INSERT INTO fm_order_allocation(allocation_id,order_id,order_item_id,sku_id,batch_id,batch_no,base_unit,reserved_quantity,picked_quantity,returned_quantity,version) VALUES(#{allocationId},#{orderId},#{orderItemId},#{skuId},#{batchId},#{batchNo},#{baseUnit},#{reservedQuantity},#{pickedQuantity},#{returnedQuantity},#{version})") void insertAllocation(AllocationRow row);
    @Select("SELECT * FROM fm_order_allocation WHERE order_id=#{id} ORDER BY sku_id,batch_id,allocation_id") List<AllocationRow> allocations(String id);
    @Update("UPDATE fm_order_allocation SET reserved_quantity=#{reservedQuantity},picked_quantity=#{pickedQuantity},returned_quantity=#{returnedQuantity},version=#{version} WHERE allocation_id=#{allocationId}") void updateAllocation(AllocationRow row);
    @Insert("INSERT INTO fm_inventory_movement(movement_id,order_id,allocation_id,batch_id,type,on_hand_delta,reserved_delta,quarantined_delta,reason,actor_id,created_at) VALUES(#{id},#{order},#{allocation},#{batch},#{type},#{hand},#{reserved},#{quarantine},#{reason},#{actor},#{now})")
    void movement(@Param("id")String id,@Param("order")String order,@Param("allocation")String allocation,@Param("batch")String batch,@Param("type")String type,@Param("hand")long hand,@Param("reserved")long reserved,@Param("quarantine")long quarantine,@Param("reason")String reason,@Param("actor")String actor,@Param("now")Instant now);
    @Select("SELECT * FROM fm_payment WHERE payment_id=#{id}") PaymentRow payment(String id);
    @Select("SELECT * FROM fm_payment WHERE payment_id=#{id} FOR UPDATE") PaymentRow lockPayment(String id);
    @Select("SELECT * FROM fm_payment WHERE order_id=#{id} ORDER BY payment_id") List<PaymentRow> payments(String id);
    @Insert("INSERT INTO fm_payment(payment_id,order_id,user_id,adjustment_id,purpose,status,amount,refunded_amount,refund_reserved,accepted,expires_at,created_at,version) VALUES(#{paymentId},#{orderId},#{userId},#{adjustmentId},#{purpose},#{status},#{amount},0,0,false,#{expiresAt},#{createdAt},0)") void insertPayment(PaymentRow row);
    @Update("UPDATE fm_payment SET status=#{status},refunded_amount=#{refundedAmount},refund_reserved=#{refundReserved},channel_trade_no=#{channelTradeNo},accepted=#{accepted},paid_at=#{paidAt},version=#{version} WHERE payment_id=#{paymentId}") void updatePayment(PaymentRow row);
    @Select("SELECT COUNT(*) FROM fm_aftersale WHERE aftersale_id=#{id} AND reviewer_id=#{reviewer}") int matchesReviewer(@Param("id")String id,@Param("reviewer")String reviewer);
    @Select("SELECT * FROM fm_payment_event WHERE event_id=#{id} FOR UPDATE") EventRow event(String id);
    @Insert("INSERT INTO fm_payment_event(event_id,payment_id,nonce,request_hash,accepted,created_at) VALUES(#{eventId},#{paymentId},#{nonce},#{requestHash},#{accepted},#{createdAt})") void insertEvent(EventRow row);
    @Select("SELECT * FROM fm_refund WHERE refund_id=#{id}") RefundRow refund(String id);
    @Select("SELECT * FROM fm_refund WHERE refund_id=#{id} FOR UPDATE") RefundRow lockRefund(String id);
    @Select("SELECT * FROM fm_refund WHERE order_id=#{id} ORDER BY created_at,refund_id") List<RefundRow> refunds(String id);
    @Insert("INSERT INTO fm_refund(refund_id,order_id,payment_id,business_key,aftersale_id,adjustment_id,type,amount,status,reason,reviewer_id,executor_id,created_at,version) VALUES(#{refundId},#{orderId},#{paymentId},#{businessKey},#{aftersaleId},#{adjustmentId},#{type},#{amount},#{status},#{reason},#{reviewerId},#{executorId},#{createdAt},0)") void insertRefund(RefundRow row);
    @Update("UPDATE fm_refund SET status=#{status},executor_id=#{executorId},last_error=#{lastError},completed_at=#{completedAt},version=#{version} WHERE refund_id=#{refundId}") void updateRefund(RefundRow row);
    @Insert("INSERT INTO fm_outbox(event_id,business_key,event_type,aggregate_id,payload,status,attempt_count,available_at,created_at) VALUES(#{id},#{key},'SANDBOX_REFUND',#{refund},'{}','PENDING',0,#{now},#{now})")
    void enqueueRefund(@Param("id")String id,@Param("key")String key,@Param("refund")String refund,@Param("now")Instant now);
    @Select("SELECT aggregate_id FROM fm_outbox WHERE event_type='SANDBOX_REFUND' AND status IN ('PENDING','PROCESSING') AND available_at<=#{now} AND (lease_until IS NULL OR lease_until<=#{now}) ORDER BY available_at,event_id LIMIT 50") List<String> dueRefunds(Instant now);
    @Update("UPDATE fm_outbox SET status='PROCESSING',attempt_count=attempt_count+1,lease_until=#{lease} WHERE event_type='SANDBOX_REFUND' AND aggregate_id=#{id} AND status IN ('PENDING','PROCESSING') AND (lease_until IS NULL OR lease_until<=#{now})") int claimRefund(@Param("id")String id,@Param("now")Instant now,@Param("lease")Instant lease);
    @Update("UPDATE fm_outbox SET status='COMPLETED',completed_at=#{now},lease_until=NULL WHERE event_type='SANDBOX_REFUND' AND aggregate_id=#{id}") void completeOutbox(@Param("id")String id,@Param("now")Instant now);
    @Update("UPDATE fm_outbox SET status='PENDING',last_error_code='SANDBOX_RETRY',available_at=#{next},lease_until=NULL WHERE event_type='SANDBOX_REFUND' AND aggregate_id=#{id} AND status<>'COMPLETED'") void retryOutbox(@Param("id")String id,@Param("next")Instant next);
    @Insert("INSERT INTO fm_sandbox_refund_receipt(refund_id,payment_id,amount,channel_refund_no,completed_at) VALUES(#{refundId},#{paymentId},#{amount},#{refundId},#{completedAt}) ON DUPLICATE KEY UPDATE refund_id=refund_id") void sandboxReceipt(RefundRow row);
    @Select("SELECT amount FROM fm_sandbox_refund_receipt WHERE refund_id=#{id}") Long receiptAmount(String id);
    @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at) VALUES(#{id},#{actor},#{operation},'ORDER',#{resource},#{reason},#{trace},#{now})")
    void audit(@Param("id")String id,@Param("actor")String actor,@Param("operation")String operation,@Param("resource")String resource,@Param("reason")String reason,@Param("trace")String trace,@Param("now")Instant now);
    @Select("SELECT COUNT(*) FROM fm_order WHERE paid_at>=#{from} AND paid_at<#{to}") long paidOrders(@Param("from")Instant from,@Param("to")Instant to);
    @Select("SELECT COALESCE(SUM(amount),0) FROM fm_payment WHERE status='SUCCESS' AND paid_at>=#{from} AND paid_at<#{to}") long captured(@Param("from")Instant from,@Param("to")Instant to);
    @Select("SELECT COALESCE(SUM(amount),0) FROM fm_refund WHERE status='SUCCESS' AND completed_at>=#{from} AND completed_at<#{to}") long refunded(@Param("from")Instant from,@Param("to")Instant to);
    @Select("SELECT COUNT(*) FROM fm_order WHERE status IN ('PAID','PICKING')") long pendingPicks();
    @Select("SELECT COUNT(*) FROM fm_inventory_batch WHERE lifecycle_status='NORMAL' AND expires_at>#{now} AND expires_at<=#{near} AND on_hand-reserved-quarantined>0") long nearBatches(@Param("now")Instant now,@Param("near")Instant near);
    @Select("SELECT COUNT(*) FROM (SELECT s.sku_id FROM fm_sku s LEFT JOIN fm_inventory_batch b ON b.sku_id=s.sku_id AND b.lifecycle_status='NORMAL' AND b.expires_at>#{now} WHERE s.status='ACTIVE' GROUP BY s.sku_id,s.base_unit HAVING COALESCE(SUM(b.on_hand-b.reserved-b.quarantined),0)<CASE WHEN s.base_unit='GRAM' THEN 5000 ELSE 10 END) low_skus") long lowSkus(Instant now);
}
