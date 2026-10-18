package com.freshmart.commerce;

import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;
import static com.freshmart.commerce.CommerceModels.*;

@Mapper
public interface CommerceMapper {
    @Select("SELECT * FROM fm_order WHERE order_id=#{id}") OrderRow order(String id);
    // One owner-scoped query for all lines, using the same actual delivery basis as ReviewService.
    @Select("SELECT a.order_item_id,COALESCE(SUM(a.picked_quantity),0) AS delivered_quantity,CASE WHEN COUNT(r.review_id)>0 THEN TRUE ELSE FALSE END AS reviewed FROM fm_order o JOIN fm_order_allocation a ON a.order_id=o.order_id LEFT JOIN fm_review r ON r.order_id=o.order_id AND r.order_item_id=a.order_item_id AND r.member_id=o.user_id WHERE o.order_id=#{order} AND o.user_id=#{member} GROUP BY a.order_item_id ORDER BY a.order_item_id")
    List<OrderItemReviewState> orderItemReviewStates(@Param("order")String order,@Param("member")String member);
    @Select("SELECT * FROM fm_order WHERE order_id=#{id} FOR UPDATE") OrderRow lockOrder(String id);
    @Select("SELECT * FROM fm_order WHERE pick_task_id=#{id}") OrderRow byPick(String id);
    @Select("SELECT * FROM fm_order WHERE delivery_task_id=#{id}") OrderRow byDelivery(String id);
    @Select("<script>SELECT * FROM fm_order WHERE 1=1 <if test='user!=null'>AND user_id=#{user}</if><if test='status!=null'>AND status=#{status}</if><if test='orderNo!=null'>AND order_no=#{orderNo}</if> ORDER BY created_at DESC,order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> orders(@Param("user") String user,@Param("status") String status,@Param("limit") int limit,@Param("offset") long offset,@Param("orderNo")String orderNo);
    @Select("<script>SELECT COUNT(*) FROM fm_order WHERE 1=1 <if test='user!=null'>AND user_id=#{user}</if><if test='status!=null'>AND status=#{status}</if></script>")
    long orderCount(@Param("user") String user,@Param("status") String status);
    @Select("<script>SELECT COUNT(*) FROM fm_order WHERE 1=1 <if test='user!=null'>AND user_id=#{user}</if><if test='status!=null'>AND status=#{status}</if><if test='orderNo!=null'>AND order_no=#{orderNo}</if></script>")
    long filteredOrderCount(@Param("user") String user,@Param("status") String status,@Param("orderNo")String orderNo);
    String SUPPORT_SCOPE="(EXISTS(SELECT 1 FROM fm_aftersale a WHERE a.order_id=o.order_id AND a.assignee_id=#{actor} AND a.member_id&lt;&gt;#{actor}) OR EXISTS(SELECT 1 FROM fm_delivery_exception e WHERE e.order_id=o.order_id AND e.assignee_id=#{actor} AND o.user_id&lt;&gt;#{actor}) OR EXISTS(SELECT 1 FROM fm_cancellation_request c WHERE c.order_id=o.order_id AND c.assignee_id=#{actor} AND c.member_id&lt;&gt;#{actor}))";
    @Select("<script>SELECT * FROM fm_order o WHERE "+SUPPORT_SCOPE+"<if test='status!=null'> AND o.status=#{status}</if><if test='orderNo!=null'> AND o.order_no=#{orderNo}</if> ORDER BY o.created_at DESC,o.order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> supportOrders(@Param("actor")String actor,@Param("status")String status,@Param("limit")int limit,@Param("offset")long offset,@Param("orderNo")String orderNo);
    @Select("<script>SELECT COUNT(*) FROM fm_order o WHERE "+SUPPORT_SCOPE+"<if test='status!=null'> AND o.status=#{status}</if><if test='orderNo!=null'> AND o.order_no=#{orderNo}</if></script>")
    long supportOrderCount(@Param("actor")String actor,@Param("status")String status,@Param("orderNo")String orderNo);
    @Select("SELECT (SELECT COUNT(*) FROM fm_aftersale WHERE order_id=#{order} AND assignee_id=#{actor} AND member_id != #{actor}) + (SELECT COUNT(*) FROM fm_delivery_exception e JOIN fm_order o ON o.order_id=e.order_id WHERE e.order_id=#{order} AND e.assignee_id=#{actor} AND o.user_id != #{actor}) + (SELECT COUNT(*) FROM fm_cancellation_request WHERE order_id=#{order} AND assignee_id=#{actor} AND member_id != #{actor})")
    int supportScope(@Param("order")String order,@Param("actor")String actor);
    String PICK_SCOPE="paid_at IS NOT NULL AND (picker_id IS NULL OR picker_id=#{actor})";
    @Select("<script>SELECT * FROM fm_order WHERE "+PICK_SCOPE+"<if test='status!=null'> AND pick_status=#{status}</if> ORDER BY created_at,order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> pickOrders(@Param("actor")String actor,@Param("status")String status,@Param("limit")int limit,@Param("offset")long offset);
    @Select("<script>SELECT COUNT(*) FROM fm_order WHERE "+PICK_SCOPE+"<if test='status!=null'> AND pick_status=#{status}</if></script>")
    long pickCount(@Param("actor")String actor,@Param("status")String status);
    String DELIVERY_SUPPORT_SCOPE="(o.delivery_status='EXCEPTION' AND EXISTS(SELECT 1 FROM fm_delivery_exception e WHERE e.order_id=o.order_id AND e.assignee_id=#{actor} AND e.status='OPEN' AND o.user_id&lt;&gt;#{actor}))";
    String DELIVERY_SCOPE="(o.status IN ('READY_TO_SHIP','DELIVERING','FINISHED') OR o.dispatched_at IS NOT NULL) AND ((#{picker}=TRUE AND o.picker_id=#{actor}) OR (#{courier}=TRUE AND o.courier_id=#{actor}) OR (#{support}=TRUE AND "+DELIVERY_SUPPORT_SCOPE+"))";
    @Select("<script>SELECT o.* FROM fm_order o WHERE "+DELIVERY_SCOPE+"<if test='status!=null'> AND o.delivery_status=#{status}</if> ORDER BY o.created_at,o.order_id LIMIT #{limit} OFFSET #{offset}</script>")
    List<OrderRow> deliveryOrders(@Param("actor")String actor,@Param("picker")boolean picker,@Param("courier")boolean courier,@Param("support")boolean support,@Param("status")String status,@Param("limit")int limit,@Param("offset")long offset);
    @Select("<script>SELECT COUNT(*) FROM fm_order o WHERE "+DELIVERY_SCOPE+"<if test='status!=null'> AND o.delivery_status=#{status}</if></script>")
    long deliveryCount(@Param("actor")String actor,@Param("picker")boolean picker,@Param("courier")boolean courier,@Param("support")boolean support,@Param("status")String status);
    @Select("SELECT COUNT(*) FROM fm_delivery_exception e JOIN fm_order o ON o.order_id=e.order_id WHERE e.order_id=#{order} AND e.assignee_id=#{actor} AND e.status='OPEN' AND o.delivery_status='EXCEPTION' AND o.user_id != #{actor}")
    int deliverySupportScope(@Param("order")String order,@Param("actor")String actor);
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
    @Select("SELECT * FROM fm_order_allocation WHERE order_id=#{id} AND retired=FALSE ORDER BY sku_id,batch_id,allocation_id") List<AllocationRow> allocations(String id);
    @Update("UPDATE fm_order_allocation SET reserved_quantity=#{reservedQuantity},picked_quantity=#{pickedQuantity},returned_quantity=#{returnedQuantity},version=#{version} WHERE allocation_id=#{allocationId}") void updateAllocation(AllocationRow row);
    @Insert("INSERT INTO fm_inventory_movement(movement_id,order_id,allocation_id,batch_id,type,on_hand_delta,reserved_delta,quarantined_delta,reason,actor_id,created_at) VALUES(#{id},#{order},#{allocation},#{batch},#{type},#{hand},#{reserved},#{quarantine},#{reason},#{actor},#{now})")
    void movement(@Param("id")String id,@Param("order")String order,@Param("allocation")String allocation,@Param("batch")String batch,@Param("type")String type,@Param("hand")long hand,@Param("reserved")long reserved,@Param("quarantine")long quarantine,@Param("reason")String reason,@Param("actor")String actor,@Param("now")Instant now);
    @Select("SELECT * FROM fm_payment WHERE payment_id=#{id}") PaymentRow payment(String id);
    @Select("SELECT * FROM fm_payment WHERE payment_id=#{id} FOR UPDATE") PaymentRow lockPayment(String id);
    @Select("SELECT * FROM fm_payment WHERE order_id=#{id} ORDER BY payment_id") List<PaymentRow> payments(String id);
    @Insert("INSERT INTO fm_payment(payment_id,order_id,user_id,adjustment_id,purpose,status,amount,refunded_amount,refund_reserved,accepted,expires_at,created_at,version) VALUES(#{paymentId},#{orderId},#{userId},#{adjustmentId},#{purpose},#{status},#{amount},0,0,false,#{expiresAt},#{createdAt},0)") void insertPayment(PaymentRow row);
    @Update("UPDATE fm_payment SET status=#{status},refunded_amount=#{refundedAmount},refund_reserved=#{refundReserved},channel_trade_no=#{channelTradeNo},accepted=#{accepted},paid_at=#{paidAt},version=#{version} WHERE payment_id=#{paymentId}") void updatePayment(PaymentRow row);
    @Select("SELECT COUNT(*) FROM fm_aftersale WHERE aftersale_id=#{id} AND reviewer_id=#{reviewer}") int matchesReviewer(@Param("id")String id,@Param("reviewer")String reviewer);
    @Select("SELECT aftersale_id FROM fm_aftersale WHERE aftersale_id=#{id} AND reviewer_id=#{reviewer} AND status IN ('APPROVED','REFUNDING') FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) String validRefundApproval(@Param("id")String id,@Param("reviewer")String reviewer);
    @Select("SELECT * FROM fm_payment_event WHERE event_id=#{id} FOR UPDATE") EventRow event(String id);
    @Insert("INSERT INTO fm_payment_event(event_id,payment_id,nonce,request_hash,accepted,created_at) VALUES(#{eventId},#{paymentId},#{nonce},#{requestHash},#{accepted},#{createdAt})") void insertEvent(EventRow row);
    @Select("SELECT * FROM fm_refund WHERE refund_id=#{id}") RefundRow refund(String id);
    @Select("SELECT * FROM fm_refund WHERE refund_id=#{id} FOR UPDATE") RefundRow lockRefund(String id);
    @Select("SELECT * FROM fm_refund WHERE order_id=#{id} ORDER BY created_at,refund_id") List<RefundRow> refunds(String id);
    @Select("SELECT * FROM fm_refund WHERE order_id=#{id} ORDER BY refund_id FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) List<RefundRow> lockRefundsForOrder(String id);
    @Insert("INSERT INTO fm_refund(refund_id,order_id,payment_id,business_key,aftersale_id,adjustment_id,type,amount,status,reason,reviewer_id,executor_id,created_at,version) VALUES(#{refundId},#{orderId},#{paymentId},#{businessKey},#{aftersaleId},#{adjustmentId},#{type},#{amount},#{status},#{reason},#{reviewerId},#{executorId},#{createdAt},0)") void insertRefund(RefundRow row);
    @Update("UPDATE fm_refund SET status=#{status},executor_id=#{executorId},last_error=#{lastError},completed_at=#{completedAt},version=#{version} WHERE refund_id=#{refundId}") void updateRefund(RefundRow row);
    @Insert("INSERT INTO fm_outbox(event_id,business_key,event_type,aggregate_id,payload,status,attempt_count,available_at,created_at) VALUES(#{id},#{key},'SANDBOX_REFUND',#{refund},'{}','PENDING',0,#{now},#{now})")
    void enqueueRefund(@Param("id")String id,@Param("key")String key,@Param("refund")String refund,@Param("now")Instant now);
    @Select("SELECT o.aggregate_id FROM fm_outbox o LEFT JOIN fm_refund r ON r.refund_id=o.aggregate_id LEFT JOIN fm_sandbox_refund_receipt c ON c.refund_id=r.refund_id AND c.payment_id=r.payment_id AND c.amount=r.amount AND c.channel_refund_no=r.refund_id WHERE o.event_type='SANDBOX_REFUND' AND (o.status IN ('PENDING','PROCESSING') OR (o.status='DEAD' AND c.refund_id IS NOT NULL)) AND (o.available_at<=#{now} OR c.refund_id IS NOT NULL) AND (o.lease_until IS NULL OR o.lease_until<=#{now}) ORDER BY o.created_at,o.event_id LIMIT 50") List<String> dueRefunds(Instant now);
    @Select("SELECT event_id,status,attempt_count,cycle_attempt_count,available_at,lease_until,lease_token,lease_generation FROM fm_outbox WHERE event_type='SANDBOX_REFUND' AND business_key=CONCAT('refund:',#{id}) AND aggregate_id=#{id} FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) RefundProcessor.OutboxLease lockRefundOutbox(String id);
    @Update("UPDATE fm_outbox SET status='PROCESSING',attempt_count=attempt_count+1,cycle_attempt_count=cycle_attempt_count+1,lease_until=#{lease},lease_token=#{token},lease_generation=lease_generation+1 WHERE event_type='SANDBOX_REFUND' AND business_key=CONCAT('refund:',#{id}) AND aggregate_id=#{id} AND lease_generation=#{generation} AND attempt_count<2147483647 AND lease_generation<9007199254740991 AND (status IN ('PENDING','PROCESSING') OR (status='DEAD' AND #{receipt}=TRUE)) AND (available_at<=#{now} OR #{receipt}=TRUE) AND (lease_until IS NULL OR lease_until<=#{now})")
    int claimRefund(@Param("id")String id,@Param("generation")long generation,@Param("token")String token,@Param("now")Instant now,@Param("lease")Instant lease,@Param("receipt")boolean receipt);
    @Update("UPDATE fm_outbox SET status=#{status},available_at=#{next},last_error_code=#{code},failed_at=#{failed},completed_at=#{completed},lease_until=NULL WHERE event_type='SANDBOX_REFUND' AND business_key=CONCAT('refund:',#{id}) AND aggregate_id=#{id} AND status='PROCESSING' AND lease_token=#{token} AND lease_generation=#{generation} AND lease_until>#{now}")
    int finishRefundClaim(@Param("id")String id,@Param("token")String token,@Param("generation")long generation,@Param("now")Instant now,@Param("status")String status,@Param("next")Instant next,@Param("code")String code,@Param("failed")Instant failed,@Param("completed")Instant completed);
    @Update("UPDATE fm_outbox SET status='PENDING',cycle_attempt_count=0,available_at=#{now},last_error_code=NULL,failed_at=NULL,lease_until=NULL,lease_token=#{token},lease_generation=lease_generation+1 WHERE event_type='SANDBOX_REFUND' AND business_key=CONCAT('refund:',#{id}) AND aggregate_id=#{id} AND status='DEAD' AND lease_generation=#{generation} AND lease_generation<9007199254740991")
    int recoverRefundOutbox(@Param("id")String id,@Param("generation")long generation,@Param("token")String token,@Param("now")Instant now);
    @Select("SELECT u.user_id FROM fm_user u JOIN fm_auth_session s ON s.user_id=u.user_id JOIN fm_user_role r ON r.user_id=u.user_id AND r.role_code='FINANCE' WHERE u.user_id=#{actor} AND u.status='ACTIVE' AND u.must_change_password=FALSE AND s.session_id=#{session} AND s.status='ACTIVE' AND s.access_expires_at>#{now} FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
    String currentFinanceSession(@Param("actor")String actor,@Param("session")String session,@Param("now")Instant now);
    @Select("SELECT u.user_id FROM fm_user u JOIN fm_user_role r ON r.user_id=u.user_id WHERE u.user_id=#{id} AND u.status='ACTIVE' AND u.must_change_password=FALSE AND r.role_code='FINANCE' FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) String authorizedRefundExecutor(String id);
    @Insert("INSERT INTO fm_sandbox_refund_receipt(refund_id,payment_id,amount,channel_refund_no,completed_at) VALUES(#{refundId},#{paymentId},#{amount},#{refundId},#{completedAt}) ON DUPLICATE KEY UPDATE refund_id=refund_id") void sandboxReceipt(RefundRow row);
    @Select("SELECT * FROM fm_sandbox_refund_receipt WHERE refund_id=#{id} FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) RefundProcessor.ChannelReceipt refundReceipt(String id);
    @Select("SELECT amount FROM fm_sandbox_refund_receipt WHERE refund_id=#{id}") Long receiptAmount(String id);
    @Insert("INSERT INTO fm_sandbox_refund_fault(refund_id,mode,remaining_failures,triggered_count,updated_at) VALUES(#{id},#{mode},#{count},0,#{now}) ON DUPLICATE KEY UPDATE mode=#{mode},remaining_failures=#{count},updated_at=#{now}")
    void armRefundFault(@Param("id")String id,@Param("mode")String mode,@Param("count")int count,@Param("now")Instant now);
    @Select("SELECT refund_id,mode,remaining_failures,triggered_count FROM fm_sandbox_refund_fault WHERE refund_id=#{id} FOR UPDATE") SandboxRefundFaults.Plan lockRefundFault(String id);
    @Update("UPDATE fm_sandbox_refund_fault SET remaining_failures=remaining_failures-1,triggered_count=triggered_count+1,updated_at=#{now} WHERE refund_id=#{id} AND triggered_count=#{triggered} AND remaining_failures>0")
    int consumeRefundFault(@Param("id")String id,@Param("triggered")int triggered,@Param("now")Instant now);
    @Insert("INSERT INTO fm_audit_event(event_id,actor_id,actor_roles_snapshot,operation,resource_type,resource_id,reason,before_summary,after_summary,trace_id,created_at,outcome) VALUES(#{id},#{actor},#{roles},#{operation},'REFUND',#{resource},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{before,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{after,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{trace},#{now},#{outcome})")
    void refundAudit(@Param("id")String id,@Param("actor")String actor,@Param("roles")String roles,@Param("operation")String operation,@Param("resource")String resource,@Param("reason")String reason,@Param("before")String before,@Param("after")String after,@Param("trace")String trace,@Param("now")Instant now,@Param("outcome")String outcome);
    @Select("SELECT role_code FROM fm_user_role WHERE user_id=#{actor} ORDER BY role_code FOR UPDATE") @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE) List<String> refundActorRoles(String actor);
    @Select("SELECT role_code FROM fm_user_role WHERE user_id=#{actor} ORDER BY role_code") List<String> actorRoles(String actor);
    @Insert("INSERT INTO fm_audit_event(event_id,actor_id,operation,resource_type,resource_id,reason,trace_id,created_at,actor_roles_snapshot,outcome) VALUES(#{id},#{actor},#{operation},'ORDER',#{resource},#{reason,typeHandler=com.freshmart.audit.SafeAuditTextHandler},#{trace},#{now},#{roles},#{outcome})")
    void audit(@Param("id")String id,@Param("actor")String actor,@Param("operation")String operation,@Param("resource")String resource,@Param("reason")String reason,@Param("trace")String trace,@Param("now")Instant now,@Param("roles")String roles,@Param("outcome")String outcome);
    @Select("SELECT COUNT(*) FROM fm_order WHERE paid_at>=#{from} AND paid_at<#{to}") long paidOrders(@Param("from")Instant from,@Param("to")Instant to);
    @Select("SELECT COALESCE(SUM(amount),0) FROM fm_payment WHERE status='SUCCESS' AND paid_at>=#{from} AND paid_at<#{to}") long captured(@Param("from")Instant from,@Param("to")Instant to);
    @Select("SELECT COALESCE(SUM(amount),0) FROM fm_refund WHERE status='SUCCESS' AND completed_at>=#{from} AND completed_at<#{to}") long refunded(@Param("from")Instant from,@Param("to")Instant to);
    @Select("SELECT COUNT(*) FROM fm_order WHERE status IN ('PAID','PICKING')") long pendingPicks();
    @Select("SELECT COUNT(*) FROM fm_inventory_batch WHERE lifecycle_status='NORMAL' AND expires_at>#{now} AND expires_at<=#{near} AND on_hand-reserved-quarantined>0") long nearBatches(@Param("now")Instant now,@Param("near")Instant near);
    @Select("SELECT COUNT(*) FROM (SELECT s.sku_id FROM fm_sku s LEFT JOIN fm_inventory_batch b ON b.sku_id=s.sku_id AND b.lifecycle_status='NORMAL' AND b.expires_at>#{now} WHERE s.status='ACTIVE' GROUP BY s.sku_id,s.base_unit HAVING COALESCE(SUM(b.on_hand-b.reserved-b.quarantined),0)<CASE WHEN s.base_unit='GRAM' THEN 5000 ELSE 10 END) low_skus") long lowSkus(Instant now);
}
