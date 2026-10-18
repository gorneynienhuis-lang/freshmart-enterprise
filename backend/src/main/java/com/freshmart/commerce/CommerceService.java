package com.freshmart.commerce;

import com.freshmart.checkout.CheckoutService;
import com.freshmart.checkout.CheckoutMapper;
import com.freshmart.common.*;
import com.freshmart.domain.pricing.*;
import com.freshmart.identity.TokenCodec;
import com.freshmart.finance.ChannelLedger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.security.SecureRandom;
import java.util.*;
import static com.freshmart.commerce.CommerceModels.*;
import static com.freshmart.domain.DomainChecks.*;

/** Every stock/slot/coupon/money mutation is enclosed in a database transaction and protected by row locks. */
@Service
public class CommerceService {
    private final CommerceMapper db;
    private final CheckoutService checkout;
    private final CheckoutMapper checkoutDb;
    private final ObjectMapper json;
    private final Clock clock;
    private final SandboxSignature sandbox;
    private final DeliveryProofVerifier proofs;
    private final ChannelLedger channelLedger;
    private final com.freshmart.support.CancellationSupportService cancellationSupport;
    private final PricingCalculator prices = new PricingCalculator();
    private final SecureRandom random = new SecureRandom();
    public CommerceService(CommerceMapper db,CheckoutService checkout,CheckoutMapper checkoutDb,ObjectMapper json,
                           Clock clock,SandboxSignature sandbox,DeliveryProofVerifier proofs,ChannelLedger channelLedger,com.freshmart.support.CancellationSupportService cancellationSupport) {
        this.db=db;this.checkout=checkout;this.checkoutDb=checkoutDb;this.json=json;this.clock=clock;this.sandbox=sandbox;this.proofs=proofs;this.channelLedger=channelLedger;this.cancellationSupport=cancellationSupport;
    }

    @Transactional
    public Map<String,Object> create(RequestActor actor,CreateOrder request) {
        actor.requireRole("MEMBER"); db.lockUser(actor.userId());
        var quote=checkout.lockQuoteForOrder(actor.userId(),request.quoteId(),request.quoteToken());
        var q=quote.row();
        checkoutDb.lockAddress(q.addressId(),actor.userId());
        var slot=object(checkoutDb.lockSlot(q.slotId()));
        if(slot.isEmpty() || !Boolean.TRUE.equals(slot.get("enabled")) || !clock.instant().isBefore(instant(slot.get("cutoffAt")))
                || number(slot,"used")>=number(slot,"capacity")) throw new ApiException(422,1202,"SLOT_UNAVAILABLE","配送时段已截止或约满，请重新选择");
        if(q.couponId()!=null) {
            var coupon=object(checkoutDb.lockCoupon(q.couponId(),actor.userId()));
            if(!"AVAILABLE".equals(coupon.get("status")) || !clock.instant().isBefore(instant(coupon.get("expiresAt")))
                    || number(coupon,"version")!=q.couponVersion()) throw ApiException.conflict("优惠券状态已变化，请重新报价");
        }
        for(var line:quote.lines()) checkoutDb.lockSku(line.skuId());
        checkout.validateForOrder(quote);
        var view=object(quote.view()); var price=child(view,"price");
        OrderRow order=new OrderRow();
        order.orderId=id("ord");order.orderNo="FM"+UUID.randomUUID().toString().replace("-","");order.userId=actor.userId();
        order.quoteId=q.quoteId();order.slotId=q.slotId();order.couponId=q.couponId();order.payableAmount=number(price,"payableAmount");
        order.status=order.payableAmount==0?"PAID":"PENDING_PAY";order.pickStatus="UNASSIGNED";order.deliveryStatus="PENDING_DISPATCH";
        order.adjustmentStatus="NONE";order.pickTaskId=id("pick");order.deliveryTaskId=id("del");order.slotHeld=true;
        order.createdAt=clock.instant();order.updatedAt=order.createdAt;order.paymentExpiresAt=order.createdAt.plusSeconds(900);
        if(order.payableAmount==0)order.paidAt=order.createdAt;
        List<Map<String,Object>> items=new ArrayList<>();
        for(var line:quote.lines()) {
            var sku=object(checkoutDb.lockSku(line.skuId()));
            items.add(map("orderItemId",id("oi"),"skuId",line.skuId(),"productId",line.productId(),"productName",line.productName(),
                    "unitLabel",sku.get("unitLabel"),"imageUrl",sku.get("imageUrl"),"baseUnit",line.baseUnit(),"priceMode",line.priceMode(),
                    "quantity",line.quantity(),"estimatedGram",line.estimatedGram(),"actualGram",null,"priceUnitGram",line.priceUnitGram(),
                    "unitPrice",line.unitPrice(),"couponAllocationAmount",line.couponAllocationAmount(),"originalPayableAmount",line.linePayableAmount(),
                    "finalPayableAmount",null,"refundedAmount",0));
        }
        order.snapshotJson=json.writeValueAsString(map("items",items,"price",price,"address",view.get("address"),"slot",view.get("slot"),"buyerNote",request.buyerNote()));
        db.insertOrder(order);
        if(db.reserveSlot(order.slotId)!=1)throw new ApiException(422,1202,"SLOT_UNAVAILABLE","配送名额已被预约");
        if(order.couponId!=null && db.lockCoupon(order.couponId,order.orderId)!=1)throw ApiException.conflict("优惠券不可用");
        int index=0;
        for(var line:quote.lines()) {
            long remaining=line.quantity();
            for(var batch:db.lockBatches(line.skuId(),instant(slot.get("endAt")),line.nearExpiryOnly()?line.nearExpiryCutoffAt():null)) {
                if(batch.receivedAt().isAfter(clock.instant()))continue;
                long amount=Math.min(remaining,batch.onHand()-batch.reserved()-batch.quarantined());if(amount<=0)continue;
                AllocationRow allocation=new AllocationRow();allocation.allocationId=id("alloc");allocation.orderId=order.orderId;
                allocation.orderItemId=(String)items.get(index).get("orderItemId");allocation.skuId=line.skuId();allocation.batchId=batch.batchId();
                allocation.batchNo=batch.batchNo();allocation.baseUnit=line.baseUnit();allocation.reservedQuantity=amount;
                move(order,allocation,batch,0,amount,0,"RESERVE","下单预占",actor.userId());db.insertAllocation(allocation);
                remaining-=amount;if(remaining==0)break;
            }
            if(remaining>0)throw stock("所选配送时段可用库存不足，请重新报价");index++;
        }
        if(checkoutDb.consumeQuote(q.quoteId(),q.version())!=1)throw ApiException.conflict("报价已被使用");
        if(order.payableAmount==0 && order.couponId!=null) db.useCoupon(order.couponId,order.orderId);
        audit(order,actor.userId(),"order.create","报价与库存、券、配送名额已原子锁定");
        return orderView(order);
    }

    @Transactional(readOnly=true)
    public Map<String,Object> get(RequestActor actor,String id) { actor.requireRole("MEMBER");return orderView(owned(actor,id,false)); }
    @Transactional(readOnly=true)
    public Map<String,Object> status(RequestActor actor,String id) {
        actor.requireRole("MEMBER");var o=owned(actor,id,false);
        return map("orderId",o.orderId,"status",o.status,"paidAmount",o.paidAmount,"refundedAmount",o.refundedAmount,
                "weightAdjustmentStatus",o.adjustmentStatus,"version",o.version,"updatedAt",o.updatedAt,"allowedActions","FINISHED".equals(o.status)?memberActions(o,orderItemViews(o,snapshot(o),true)):actions(o));
    }
    @Transactional(readOnly=true)
    public Map<String,Object> list(RequestActor actor,String status,int page,int size,boolean admin) {
        return list(actor,status,page,size,admin,null);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> list(RequestActor actor,String status,int page,int size,boolean admin,String orderNo) {
        if(admin)actor.requireAnyRole("OPERATOR","SERVICE","FINANCE");else actor.requireRole("MEMBER");
        if(orderNo!=null&&(!admin||!orderNo.matches("[A-Za-z0-9_-]{1,64}")))throw ApiException.invalid("订单号格式不合法");
        paging(page,size);validOrderStatus(status);String user=admin?null:actor.userId();
        if(admin&&actor.roles().contains("SERVICE")&&!actor.roles().contains("OPERATOR")&&!actor.roles().contains("FINANCE"))
            return map("page",page,"size",size,"total",db.supportOrderCount(actor.userId(),status,orderNo),"items",db.supportOrders(actor.userId(),status,size,(long)(page-1)*size,orderNo).stream().map(o->adminView(o,actor)).toList());
        return map("page",page,"size",size,"total",db.filteredOrderCount(user,status,orderNo),"items",db.orders(user,status,size,(long)(page-1)*size,orderNo).stream()
                .map(o->admin?adminView(o,actor):orderView(o)).toList());
    }
    @Transactional(readOnly=true)
    public Map<String,Object> adminOrder(RequestActor actor,String id) {
        actor.requireAnyRole("OPERATOR","SERVICE","FINANCE");var o=required(db.order(id));
        if(!actor.roles().contains("OPERATOR")&&!actor.roles().contains("FINANCE"))requireSupportScope(o,actor);return adminView(o,actor);
    }
    @Transactional
    public Map<String,Object> cancel(RequestActor actor,String id,ReasonVersion request,boolean admin) {
        if(admin)actor.requireRole("SERVICE");else actor.requireRole("MEMBER");
        var o=admin?required(db.lockOrder(id)):owned(actor,id,true);if(admin){if(actor.userId().equals(o.userId))throw ApiException.forbidden();requireSupportScope(o,actor);}version(o.version,request.version());
        cancelLocked(o,actor.userId(),request.reason(),false);
        return admin?adminView(o,actor):orderView(o);
    }
    void cancelLocked(OrderRow o,String actor,String reason,boolean timeout) {
        if(!Set.of("PENDING_PAY","PAID","PICKING","READY_TO_SHIP").contains(o.status))throw invalidState("该订单当前不能取消");
        checkoutDb.lockSlot(o.slotId);
        if(o.couponId!=null)checkoutDb.lockCoupon(o.couponId,o.userId);
        if(o.slotHeld){if(db.releaseSlot(o.slotId)!=1)throw new IllegalStateException("Slot conservation failed");o.slotHeld=false;}
        if("PENDING_PAY".equals(o.status)&&o.couponId!=null)db.releaseCoupon(o.couponId,o.orderId,clock.instant());
        var allocations=db.allocations(o.orderId);
        lockSkus(allocations);
        for(var a:allocations) {
            if(a.reservedQuantity>0){var batch=db.lockBatch(a.batchId);move(o,a,batch,0,-a.reservedQuantity,0,"RELEASE",reason,actor);
                a.reservedQuantity=0;a.version=nextVersion(a.version);db.updateAllocation(a);}
        }
        o.status=timeout&&o.paidAmount==0?"CLOSED":"CANCELED";o.pickStatus="CANCELED";o.deliveryStatus="CANCELED";
        if(o.adjustmentId!=null)o.adjustmentStatus="CANCELED";
        for(var p:db.payments(o.orderId)) {
            if("SUCCESS".equals(p.status)&&p.accepted) {
                long available=p.amount-p.refundedAmount-p.refundReserved;
                if(available>0)reserveRefund(o,p,available,"CANCEL",null,"cancel:"+o.orderId+":"+p.paymentId,reason);
            } else if(!"SUCCESS".equals(p.status)){p.status="CLOSED";p.version=nextVersion(p.version);db.updatePayment(p);}
        }
        cancellationSupport.resolveOpen(o.orderId,actor,timeout?"订单超时关闭或取消，取消协助自动结束":"订单已取消，取消协助结束");
        touch(o);audit(o,actor,timeout?"order.expire":"order.cancel",reason);
    }

    @Transactional
    public Map<String,Object> prepay(RequestActor actor,Prepay request) {
        actor.requireRole("MEMBER");var o=owned(actor,request.orderId(),true);
        long amount;Instant deadline;
        if("ORDER".equals(request.purpose())) {
            if(request.adjustmentId()!=null)throw ApiException.invalid("预付款不绑定差额单");
            if(!"PENDING_PAY".equals(o.status)||!clock.instant().isBefore(o.paymentExpiresAt))throw invalidState("订单不可支付或已超时");
            amount=o.payableAmount;deadline=o.paymentExpiresAt;
        }else{
            if(!"READY_TO_SHIP".equals(o.status)||!"TOP_UP_PENDING".equals(o.adjustmentStatus)||!Objects.equals(o.adjustmentId,request.adjustmentId())
                    ||!clock.instant().isBefore(o.adjustmentExpiresAt))throw invalidState("补款不可用或已超时");
            amount=o.adjustmentDelta;deadline=o.adjustmentExpiresAt;
        }
        if(amount<=0)throw invalidState("零额订单无需渠道支付");
        for(var existing:db.payments(o.orderId))if("PENDING".equals(existing.status)&&existing.purpose.equals(request.purpose())
                &&Objects.equals(existing.adjustmentId,request.adjustmentId())&&clock.instant().isBefore(existing.expiresAt))return paymentView(existing);
        PaymentRow p=new PaymentRow();p.paymentId=id("pay");p.orderId=o.orderId;p.userId=o.userId;p.adjustmentId=request.adjustmentId();
        p.purpose=request.purpose();p.amount=amount;p.status="PENDING";p.expiresAt=deadline;p.createdAt=clock.instant();db.insertPayment(p);
        if("TOP_UP".equals(p.purpose)){o.topupPaymentId=p.paymentId;touch(o);}
        audit(o,actor.userId(),"payment.create","创建沙箱支付尝试");return paymentView(p);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> payment(RequestActor actor,String id) {
        actor.requireRole("MEMBER");var p=db.payment(id);if(p==null)throw ApiException.notFound();actor.requireOwner(p.userId);return paymentView(p);
    }
    @Transactional
    public Map<String,Object> simulate(RequestActor actor,String id,Simulate request) {
        actor.requireRole("MEMBER");sandbox.requireEnabled();var lookup=db.payment(id);if(lookup==null)throw ApiException.notFound();actor.requireOwner(lookup.userId);
        var o=required(db.lockOrder(lookup.orderId));var p=db.lockPayment(id);version(p.version,request.version());
        if(!"PENDING".equals(p.status))throw invalidState("只允许模拟尚未完成的支付");
        var event=new Callback(id("evt"),p.paymentId,"trade_"+p.paymentId,request.outcome(),p.amount,"CNY",clock.instant());
        var body=json.writeValueAsString(event);var signed=sandbox.sign(body);sandbox.verify(body,signed.timestamp(),signed.nonce(),signed.signature());
        applyEvent(o,p,event,signed.nonce(),TokenCodec.hash(body));return paymentView(db.payment(id));
    }
    @Transactional
    public Map<String,Object> callback(Callback event,String nonce,String hash) {
        var lookup=db.payment(event.paymentId());if(lookup==null)throw ApiException.notFound();
        var o=required(db.lockOrder(lookup.orderId));var p=db.lockPayment(event.paymentId());return applyEvent(o,p,event,nonce,hash);
    }
    private Map<String,Object> applyEvent(OrderRow o,PaymentRow p,Callback e,String nonce,String hash) {
        var previous=db.event(e.eventId());
        if(previous!=null) {
            if(!previous.requestHash().equals(hash)||!previous.paymentId().equals(p.paymentId))throw mismatch("渠道事件编号与内容不一致");
            return map("eventId",e.eventId(),"accepted",previous.accepted(),"duplicate",true);
        }
        if(e.amount()!=p.amount || !"CNY".equals(e.currency()) || e.occurredAt().isAfter(clock.instant().plusSeconds(300)))
            throw mismatch("支付金额、币种或渠道时间不一致");
        channelLedger.recordPayment(e.eventId(),p.paymentId,e.channelTradeNo(),e.status(),e.amount(),e.occurredAt());
        boolean accepted=false;
        if("SUCCESS".equals(e.status())) {
            if("SUCCESS".equals(p.status)) {
                if(!Objects.equals(p.channelTradeNo,e.channelTradeNo()))throw mismatch("同支付单出现不同渠道流水");accepted=p.accepted;
            }else{
                p.status="SUCCESS";p.channelTradeNo=e.channelTradeNo();p.paidAt=clock.instant();p.version=nextVersion(p.version);
                if("ORDER".equals(p.purpose)&&"PENDING_PAY".equals(o.status)&&clock.instant().isBefore(o.paymentExpiresAt)) {
                    o.status="PAID";o.paidAmount=add(o.paidAmount,p.amount);o.acceptedPaymentId=p.paymentId;o.paidAt=clock.instant();p.accepted=true;accepted=true;
                    if(o.couponId!=null&&db.useCoupon(o.couponId,o.orderId)!=1)throw new IllegalStateException("Locked coupon missing");
                } else if("TOP_UP".equals(p.purpose)&&"READY_TO_SHIP".equals(o.status)&&"TOP_UP_PENDING".equals(o.adjustmentStatus)
                        &&Objects.equals(o.adjustmentId,p.adjustmentId)&&p.amount==o.adjustmentDelta&&clock.instant().isBefore(o.adjustmentExpiresAt)) {
                    o.adjustmentStatus="SETTLED";o.topupPaymentId=p.paymentId;o.paidAmount=add(o.paidAmount,p.amount);p.accepted=true;accepted=true;
                }
                db.updatePayment(p);
                if(!accepted) {
                    if("PENDING_PAY".equals(o.status)&&!clock.instant().isBefore(o.paymentExpiresAt))cancelLocked(o,"SYSTEM","支付超时，关闭订单",true);
                    if("READY_TO_SHIP".equals(o.status)&&"TOP_UP_PENDING".equals(o.adjustmentStatus)&&!clock.instant().isBefore(o.adjustmentExpiresAt))cancelLocked(o,"SYSTEM","补款超时，取消未发货订单",true);
                    String type=("CLOSED".equals(o.status)||"CANCELED".equals(o.status))?"LATE_PAYMENT":"DUPLICATE_PAYMENT";
                    reserveRefund(o,p,p.amount,type,null,"abnormal:"+p.paymentId,"异常实收原路退回，不恢复履约");
                }
                touch(o);audit(o,"SANDBOX_CHANNEL","payment.success",accepted?"渠道已验证并入账":"渠道实收已记录并安排原路退款");
            }
        }else if(!"SUCCESS".equals(p.status)) {p.status="FAILED";p.version=nextVersion(p.version);db.updatePayment(p);audit(o,"SANDBOX_CHANNEL","payment.failed","沙箱渠道确认失败");}
        db.insertEvent(new EventRow(e.eventId(),p.paymentId,nonce,hash,accepted,clock.instant()));
        return map("eventId",e.eventId(),"accepted",accepted,"duplicate",false);
    }

    @Transactional(readOnly=true)
    public Map<String,Object> pickTasks(RequestActor actor,String status,int page,int size) {
        actor.requireRole("PICKER");paging(page,size);
        if(status!=null&&!Set.of("UNASSIGNED","CLAIMED","COMPLETED","CANCELED").contains(status))throw ApiException.invalid("拣货状态不合法");
        return map("page",page,"size",size,"total",db.pickCount(actor.userId(),status),"items",db.pickOrders(actor.userId(),status,size,(long)(page-1)*size).stream().map(this::pickView).toList());
    }
    @Transactional(readOnly=true)
    public Map<String,Object> pickTask(RequestActor actor,String taskId) {actor.requireRole("PICKER");return pickView(pickOrder(actor,taskId,false));}
    @Transactional
    public Map<String,Object> claim(RequestActor actor,String taskId,Version request) {
        actor.requireRole("PICKER");var o=pickOrder(actor,taskId,true);version(o.version,request.version());
        if(!"PAID".equals(o.status)||!"UNASSIGNED".equals(o.pickStatus))throw invalidState("该拣货任务不可领取");
        o.pickerId=actor.userId();o.pickStatus="CLAIMED";o.status="PICKING";touch(o);audit(o,actor.userId(),"pick.claim","领取拣货任务");return pickView(o);
    }
    @Transactional
    public Map<String,Object> confirmPick(RequestActor actor,String taskId,PickConfirm request) {
        actor.requireRole("PICKER");var o=pickOrder(actor,taskId,true);version(o.version,request.version());
        if(!actor.userId().equals(o.pickerId))throw ApiException.notFound();
        if(!"PICKING".equals(o.status))throw invalidState("当前订单不处于拣货中");
        var allocations=db.allocations(o.orderId);var submitted=new HashMap<String,PickLine>();
        for(var line:request.allocations())if(submitted.put(line.allocationId(),line)!=null)throw ApiException.invalid("重复批次分配");
        if(submitted.size()!=allocations.size())throw ApiException.invalid("必须提交全部分配且不允许多余分配");
        var snapshot=snapshot(o);var items=items(snapshot);Map<String,Long> actuals=new HashMap<>();Map<String,String> reasons=new HashMap<>();
        for(var allocation:allocations) {
            var line=submitted.get(allocation.allocationId);if(line==null)throw ApiException.invalid("分配不属于该订单");
            if(line.actualQuantity()==0&&!"SHORTAGE".equals(line.reasonCode()))throw ApiException.invalid("零量必须注明缺货");
            if("PIECE".equals(allocation.baseUnit)&&line.actualQuantity()>allocation.reservedQuantity)throw ApiException.invalid("按件商品不得多拣");
            if(line.actualQuantity()!=allocation.reservedQuantity&&"NORMAL".equals(line.reasonCode()))throw ApiException.invalid("实拣变化必须说明原因");
            if("PIECE".equals(allocation.baseUnit)&&line.actualQuantity()<allocation.reservedQuantity&&!"SHORTAGE".equals(line.reasonCode()))throw ApiException.invalid("按件减量必须说明缺货");
            actuals.merge(allocation.skuId,line.actualQuantity(),Math::addExact);
            reasons.merge(allocation.skuId,line.reasonCode(),(a,b)->"SHORTAGE".equals(a)||"SHORTAGE".equals(b)?"SHORTAGE":"WEIGHT_VARIANCE");
        }
        var original=pricingSnapshot(snapshot);var result=prices.recalculate(original,items.stream().map(item->new PricingCalculator.ActualLine(
                string(item,"skuId"),actuals.get(string(item,"skuId")),PricingCalculator.ReasonCode.valueOf(reasons.get(string(item,"skuId"))))).toList());
        if(result.cancelOrder()) {
            cancelLocked(o,actor.userId(),"全单缺货，取消并退还全部已收金额",false);
            return map("task",pickView(o),"orderStatus",o.status,"weightAdjustment",adjustmentView(o));
        }
        Instant slotStart=instant(child(snapshot,"slot").get("startAt"));Instant deadline=clock.instant().plusSeconds(600);
        if(slotStart.isBefore(deadline))deadline=slotStart;
        if(result.deltaAmount()>0&&!clock.instant().isBefore(deadline))throw invalidState("已无补款时间，请调整实拣或取消订单");
        List<Map<String,Object>> adjustmentLines=new ArrayList<>();
        for(var repriced:result.lines()) {
            var item=items.stream().filter(i->string(i,"skuId").equals(repriced.skuId())).findFirst().orElseThrow();
            item.put("finalPayableAmount",repriced.payableAmount());if("GRAM".equals(item.get("baseUnit")))item.put("actualGram",repriced.actualQuantity());
            if(repriced.actualQuantity()!=number(item,"quantity"))adjustmentLines.add(map("orderItemId",item.get("orderItemId"),"estimatedGram",item.get("estimatedGram"),
                    "actualGram",item.get("actualGram"),"priceUnitGram",item.get("priceUnitGram"),"unitPrice",item.get("unitPrice"),"originalPayableAmount",item.get("originalPayableAmount"),
                    "recalculatedPayableAmount",repriced.payableAmount(),"deltaAmount",repriced.deltaAmount(),"baseUnit",item.get("baseUnit"),"priceMode",item.get("priceMode"),
                    "estimatedQuantity",item.get("quantity"),"actualQuantity",repriced.actualQuantity(),"reasonCode",reasons.get(repriced.skuId())));
        }
        Instant slotEnd=instant(child(snapshot,"slot").get("endAt"));
        // Full-shortage cancellation acquires slot before SKU locks; take SKU locks only on the pick-out path.
        lockSkus(allocations);
        for(var a:allocations) {
            var line=submitted.get(a.allocationId);var batch=db.lockBatch(a.batchId);
            if(!"NORMAL".equals(batch.lifecycleStatus())||!batch.expiresAt().isAfter(clock.instant())||!batch.expiresAt().isAfter(slotEnd))throw stock("批次失效，须重新分配或取消");
            long extra=Math.max(0,line.actualQuantity()-a.reservedQuantity);
            if(extra>batch.onHand()-batch.reserved()-batch.quarantined())throw stock("称重增加所需库存不足");
            move(o,a,batch,-line.actualQuantity(),-a.reservedQuantity,0,"PICK_OUT",line.reason(),actor.userId());
            a.reservedQuantity=0;a.pickedQuantity=line.actualQuantity();a.version=nextVersion(a.version);db.updateAllocation(a);
        }
        o.snapshotJson=json.writeValueAsString(snapshot);o.status="READY_TO_SHIP";o.pickStatus="COMPLETED";
        o.adjustmentId=id("wa");o.adjustmentDelta=result.deltaAmount();o.adjustmentJson=json.writeValueAsString(adjustmentLines);
        o.adjustmentStatus=result.deltaAmount()==0?"NONE":result.deltaAmount()<0?"REFUND_PENDING":"TOP_UP_PENDING";
        if(result.deltaAmount()>0)o.adjustmentExpiresAt=deadline;
        if(result.deltaAmount()<0)reserveAcrossPayments(o,-result.deltaAmount(),"WEIGHT_DIFFERENCE",o.adjustmentId,"weight:"+o.adjustmentId,"称重及缺货净退差");
        touch(o);audit(o,actor.userId(),"pick.confirm","冻结实拣并原子出库、生成金额差额");
        return map("task",pickView(o),"orderStatus",o.status,"weightAdjustment",adjustmentView(o));
    }

    @Transactional(readOnly=true)
    public Map<String,Object> deliveryTasks(RequestActor actor,String status,int page,int size) {
        actor.requireAnyRole("PICKER","COURIER","SERVICE");paging(page,size);
        if(status!=null&&!Set.of("PENDING_DISPATCH","DELIVERING","COMPLETED","EXCEPTION","CANCELED").contains(status))throw ApiException.invalid("配送状态不合法");
        boolean picker=actor.roles().contains("PICKER"),courier=actor.roles().contains("COURIER"),support=actor.roles().contains("SERVICE");
        return map("page",page,"size",size,"total",db.deliveryCount(actor.userId(),picker,courier,support,status),"items",db.deliveryOrders(actor.userId(),picker,courier,support,status,size,(long)(page-1)*size).stream().map(this::deliveryView).toList());
    }
    @Transactional(readOnly=true)
    public Map<String,Object> deliveryTask(RequestActor actor,String id){return deliveryView(deliveryOrder(actor,id,false));}
    @Transactional
    public Map<String,Object> dispatch(RequestActor actor,String id,Dispatch request) {
        actor.requireRole("PICKER");var o=deliveryOrder(actor,id,true);if(!actor.userId().equals(o.pickerId))throw ApiException.notFound();version(o.version,request.version());
        if(!"READY_TO_SHIP".equals(o.status)||!Set.of("NONE","REFUNDED","SETTLED").contains(o.adjustmentStatus))throw invalidState("须完成拣货并结清补退差额才可发货");
        if(db.activeRole(request.courierId(),"COURIER")!=1)throw ApiException.invalid("配送员不可用");
        o.courierId=request.courierId();o.deliveryStatus="DELIVERING";o.status="DELIVERING";o.dispatchedAt=clock.instant();
        o.receiptCode=String.format(Locale.ROOT,"%06d",random.nextInt(1_000_000));cancellationSupport.resolveOpen(o.orderId,"SYSTEM","订单已交接配送，取消协助自动结束；未取消已发货订单");touch(o);audit(o,actor.userId(),"delivery.dispatch","出库交接给配送员");return deliveryView(o);
    }
    @Transactional
    public Map<String,Object> complete(RequestActor actor,String id,Complete request) {
        actor.requireRole("COURIER");var o=deliveryOrder(actor,id,true);actor.requireOwner(o.courierId);version(o.version,request.version());
        if(!"DELIVERING".equals(o.status)||!"DELIVERING".equals(o.deliveryStatus))throw invalidState("当前不可确认签收");
        proofs.verify(o.orderId,actor.userId(),o.receiptCode,request.proofCode());
        o.status="FINISHED";o.deliveryStatus="COMPLETED";o.finishedAt=clock.instant();o.receiptCode=null;
        touch(o);audit(o,actor.userId(),"delivery.complete","一次性签收凭证已验证");return deliveryView(o);
    }
    @Transactional
    public Map<String,Object> receiveReturn(RequestActor actor,String id,ReturnReceive request) {
        actor.requireRole("PICKER");var o=required(db.lockOrder(id));version(o.version,request.version());
        if(!"CANCELED".equals(o.status))throw invalidState("仅取消订单可登记实物回库");
        if(!actor.userId().equals(o.pickerId))throw ApiException.notFound();
        var allocations=db.allocations(o.orderId);lockSkus(allocations);Set<String> seen=new HashSet<>();
        for(var line:request.allocations()) {
            if(!seen.add(line.allocationId()))throw ApiException.invalid("重复回库分配");
            var a=allocations.stream().filter(x->x.allocationId.equals(line.allocationId())).findFirst().orElseThrow(ApiException::notFound);
            long total=add(line.passedQuantity(),line.quarantinedQuantity());
            if(total<=0||total>a.pickedQuantity-a.returnedQuantity)throw ApiException.invalid("回库量超出待回实物");
            var batch=db.lockBatch(a.batchId);
            if(!"NORMAL".equals(batch.lifecycleStatus()))throw invalidState("非正常批次不能直接回库，须人工处理");
            if(line.passedQuantity()>0&&!batch.expiresAt().isAfter(clock.instant()))throw invalidState("已过期商品不能恢复可售");
            move(o,a,batch,total,0,total,"RETURN_QUARANTINE",request.inspectionNote(),actor.userId());
            if(line.passedQuantity()>0)move(o,a,db.lockBatch(a.batchId),0,0,-line.passedQuantity(),"RETURN_PASS",request.inspectionNote(),actor.userId());
            a.returnedQuantity+=total;a.version=nextVersion(a.version);db.updateAllocation(a);
        }
        touch(o);audit(o,actor.userId(),"return.receive","实物回库并记录质检");return map("accepted",true,"resourceId",o.orderId,"version",o.version,"message","已登记实物与质检结果");
    }

    @Transactional(readOnly=true)
    public Map<String,Object> refund(RequestActor actor,String id) {
        actor.requireRole("MEMBER");var r=db.refund(id);if(r==null)throw ApiException.notFound();owned(actor,r.orderId,false);return refundView(r);
    }
    @Transactional
    public void expire(String id) {
        var o=db.lockOrder(id);if(o==null)return;
        if("PENDING_PAY".equals(o.status)&&!clock.instant().isBefore(o.paymentExpiresAt))cancelLocked(o,"SYSTEM","未支付订单到期关闭",true);
        else if("READY_TO_SHIP".equals(o.status)&&"TOP_UP_PENDING".equals(o.adjustmentStatus)&&!clock.instant().isBefore(o.adjustmentExpiresAt))
            cancelLocked(o,"SYSTEM","补款超时，取消未发货订单并安排退款与实物回库",true);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> dashboard(RequestActor actor,LocalDate date) {
        actor.requireAnyRole("OPERATOR","FINANCE");ZoneId zone=ZoneId.of("Asia/Shanghai");if(date==null)date=LocalDate.now(clock.withZone(zone));
        Instant from=date.atStartOfDay(zone).toInstant(),to=date.plusDays(1).atStartOfDay(zone).toInstant();long captured=db.captured(from,to),refunded=db.refunded(from,to);
        return map("businessDate",date.toString(),"paidOrderCount",db.paidOrders(from,to),"capturedPaymentAmount",captured,
                "successfulRefundAmount",refunded,"netCollectedAmount",captured-refunded,"pendingPickCount",actor.roles().contains("FINANCE")?null:db.pendingPicks(),
                "nearExpiryBatchCount",actor.roles().contains("FINANCE")?null:db.nearBatches(clock.instant(),clock.instant().plusSeconds(259200)),"lowStockSkuCount",actor.roles().contains("FINANCE")?null:db.lowSkus(clock.instant()),"generatedAt",clock.instant());
    }

    void reserveAcrossPayments(OrderRow o,long amount,String type,String adjustment,String key,String reason) {
        long remaining=amount;
        for(var p:db.payments(o.orderId))if("SUCCESS".equals(p.status)&&p.accepted) {
            long part=Math.min(remaining,p.amount-p.refundedAmount-p.refundReserved);
            if(part>0){reserveRefund(o,p,part,type,adjustment,key+":"+p.paymentId,reason);remaining-=part;}
            if(remaining==0)break;
        }
        if(remaining!=0)throw invalidState("剩余可退资金不足");
    }
    RefundRow reserveRefund(OrderRow o,PaymentRow p,long amount,String type,String adjustment,String key,String reason) {
        if(amount<=0||amount>p.amount-p.refundedAmount-p.refundReserved)throw invalidState("退款预算不足");
        RefundRow r=new RefundRow();r.refundId=id("ref");r.orderId=o.orderId;r.paymentId=p.paymentId;r.businessKey=key;r.type=type;
        r.adjustmentId=adjustment;r.amount=amount;r.status="PENDING";r.reason=reason;r.createdAt=clock.instant();r.executorId="SYSTEM";
        db.insertRefund(r);p.refundReserved=add(p.refundReserved,amount);p.version=nextVersion(p.version);db.updatePayment(p);
        db.enqueueRefund(id("evt"),"refund:"+r.refundId,r.refundId,clock.instant());return r;
    }
    private void lockSkus(List<AllocationRow> allocations){allocations.stream().map(a->a.skuId).distinct().sorted().forEach(checkoutDb::lockSku);}
    void move(OrderRow o,AllocationRow a,BatchRow b,long hand,long reserved,long quarantine,String type,String reason,String actor) {
        nextVersion(b.version());
        if(db.moveBatch(b.batchId(),hand,reserved,quarantine,b.version(),clock.instant())!=1)throw ApiException.conflict("批次已变化");
        db.movement(id("mov"),o.orderId,a.allocationId,a.batchId,type,hand,reserved,quarantine,reason,actor,clock.instant());
    }
    void requireSupportScope(OrderRow o,RequestActor actor){if(db.supportScope(o.orderId,actor.userId())==0)throw ApiException.notFound();}
    void touch(OrderRow o){o.updatedAt=clock.instant();o.version=nextVersion(o.version);db.updateOrder(o);}
    void audit(OrderRow o,String actor,String operation,String reason){db.audit(id("audit"),actor,operation,o.orderId,reason,TraceContext.id(),clock.instant(),String.join(",",db.actorRoles(actor)),"payment.failed".equals(operation)?"FAILED":"SUCCESS");}
    OrderRow owned(RequestActor actor,String id,boolean lock){var o=required(lock?db.lockOrder(id):db.order(id));actor.requireOwner(o.userId);return o;}
    OrderRow pickOrder(RequestActor actor,String id,boolean lock){var row=required(db.byPick(id));var o=lock?required(db.lockOrder(row.orderId)):row;if(o.paidAt==null)throw ApiException.notFound();if(o.pickerId!=null&&!actor.userId().equals(o.pickerId))throw ApiException.notFound();return o;}
    OrderRow deliveryOrder(RequestActor actor,String id,boolean lock){actor.requireAnyRole("PICKER","COURIER","SERVICE");var row=required(db.byDelivery(id));var o=lock?required(db.lockOrder(row.orderId)):row;
        if(!(actor.roles().contains("PICKER")&&actor.userId().equals(o.pickerId))&&!(actor.roles().contains("COURIER")&&actor.userId().equals(o.courierId))&&!(actor.roles().contains("SERVICE")&&db.deliverySupportScope(o.orderId,actor.userId())>0))throw ApiException.notFound();
        if(!Set.of("READY_TO_SHIP","DELIVERING","FINISHED","CANCELED").contains(o.status))throw ApiException.notFound();return o;}
    private List<Map<String,Object>> orderItemViews(OrderRow order,Map<String,Object> snapshot,boolean owner) {
        Map<String,OrderItemReviewState> states=new HashMap<>();
        if(owner)for(var state:db.orderItemReviewStates(order.orderId,order.userId))states.put(state.orderItemId(),state);
        return items(snapshot).stream().map(stored->{
            Map<String,Object> view=new LinkedHashMap<>(stored);view.remove("reviewed");view.remove("reviewable");
            if(owner){var state=states.get(string(stored,"orderItemId"));boolean reviewed=state!=null&&state.reviewed();view.put("reviewed",reviewed);view.put("reviewable","FINISHED".equals(order.status)&&state!=null&&state.deliveredQuantity()>0&&!reviewed);}
            return view;
        }).toList();
    }
    private List<String> memberActions(OrderRow order,List<Map<String,Object>> itemViews){var result=new ArrayList<>(actions(order));if(itemViews.stream().anyMatch(item->Boolean.TRUE.equals(item.get("reviewable"))))result.add("REVIEW");return result;}
    Map<String,Object> orderView(OrderRow o){var s=snapshot(o);var itemViews=orderItemViews(o,s,true);var view=map("orderId",o.orderId,"orderNo",o.orderNo,"status",o.status,"currency","CNY","items",itemViews,"price",s.get("price"),
            "paidAmount",o.paidAmount,"refundedAmount",o.refundedAmount,"address",s.get("address"),"slot",s.get("slot"),"weightAdjustment",adjustmentView(o),"refunds",db.refunds(o.orderId).stream().map(this::refundView).toList(),
            "buyerNote",s.get("buyerNote"),"createdAt",o.createdAt,"paymentExpiresAt",o.paymentExpiresAt,"paidAt",o.paidAt,"finishedAt",o.finishedAt,"version",o.version,"allowedActions",memberActions(o,itemViews),
            "deliveryReceiptCode","DELIVERING".equals(o.status)?o.receiptCode:null);var support=cancellationSupport.latest(o.orderId);if(support!=null)view.put("cancellationSupport",support);return view;}
    Map<String,Object> adminView(OrderRow o,RequestActor actor){var s=snapshot(o);var contact=masked(s);if(actor.roles().contains("FINANCE"))contact.remove("region");var view=map("orderId",o.orderId,"orderNo",o.orderNo,"memberId",o.userId,"status",o.status,
            "items",orderItemViews(o,s,false),"price",s.get("price"),"paidAmount",o.paidAmount,"refundedAmount",o.refundedAmount,"contact",contact,"slot",s.get("slot"),"weightAdjustment",adjustmentView(o),
            "refunds",db.refunds(o.orderId).stream().map(this::refundView).toList(),"createdAt",o.createdAt,"version",o.version,"allowedActions",actor.roles().contains("SERVICE")&&db.supportScope(o.orderId,actor.userId())>0&&actions(o).contains("CANCEL")?List.of("CANCEL"):List.of());if(!actor.roles().contains("FINANCE")){var support=cancellationSupport.latest(o.orderId);if(support!=null)view.put("cancellationSupport",support);}return view;}
    Map<String,Object> pickView(OrderRow o){var s=snapshot(o);return map("taskId",o.pickTaskId,"orderId",o.orderId,"status",o.pickStatus,"pickerId",o.pickerId,"items",orderItemViews(o,s,false),
            "allocations",db.allocations(o.orderId).stream().map(a->map("allocationId",a.allocationId,"orderItemId",a.orderItemId,"batchId",a.batchId,"batchNo",a.batchNo,"baseUnit",a.baseUnit,
                    "reservedQuantity",a.reservedQuantity,"pickedQuantity",a.pickedQuantity,"returnedQuantity",a.returnedQuantity,"version",a.version)).toList(),"slot",s.get("slot"),"version",o.version);}
    Map<String,Object> deliveryView(OrderRow o){var s=snapshot(o);return map("taskId",o.deliveryTaskId,"orderId",o.orderId,"status",o.deliveryStatus,"courierId",o.courierId,"contact",masked(s),"slot",s.get("slot"),"dispatchedAt",o.dispatchedAt,"completedAt",o.finishedAt,"version",o.version);}
    Map<String,Object> paymentView(PaymentRow p){return map("paymentId",p.paymentId,"orderId",p.orderId,"adjustmentId",p.adjustmentId,"purpose",p.purpose,"channel","SANDBOX","status",p.status,
            "amount",p.amount,"currency","CNY","expiresAt",p.expiresAt,"version",p.version,"allowedActions",sandbox.enabled()&&"PENDING".equals(p.status)&&clock.instant().isBefore(p.expiresAt)?List.of("SIMULATE_PAYMENT"):List.of());}
    Map<String,Object> refundView(RefundRow r){return map("refundId",r.refundId,"orderId",r.orderId,"paymentId",r.paymentId,"aftersaleId",r.aftersaleId,"adjustmentId",r.adjustmentId,"type",r.type,"amount",r.amount,"currency","CNY","status",r.status,"reason",r.reason,"createdAt",r.createdAt,"completedAt",r.completedAt,"version",r.version);}
    Map<String,Object> adjustmentView(OrderRow o){if(o.adjustmentId==null)return null;var refunds=db.refunds(o.orderId).stream().filter(r->o.adjustmentId.equals(r.adjustmentId)).toList();return map("adjustmentId",o.adjustmentId,
            "status",o.adjustmentStatus,"deltaAmount",o.adjustmentDelta,"lines",o.adjustmentJson==null?List.of():json.readValue(o.adjustmentJson,List.class),"topUpPaymentId",o.topupPaymentId,"refundId",refunds.isEmpty()?null:refunds.getFirst().refundId,"expiresAt",o.adjustmentExpiresAt,"version",o.version);}
    private List<String> actions(OrderRow o){List<String>a=new ArrayList<>();if("PENDING_PAY".equals(o.status)&&clock.instant().isBefore(o.paymentExpiresAt))a.add("PAY");if(Set.of("PENDING_PAY","PAID","PICKING","READY_TO_SHIP").contains(o.status))a.add("CANCEL");
        if("READY_TO_SHIP".equals(o.status)&&"TOP_UP_PENDING".equals(o.adjustmentStatus)&&clock.instant().isBefore(o.adjustmentExpiresAt))a.add("TOP_UP");if("FINISHED".equals(o.status)&&o.finishedAt!=null&&clock.instant().isBefore(o.finishedAt.plus(Duration.ofDays(7)))&&o.paidAmount>o.refundedAmount)a.add("APPLY_AFTERSALE");return a;}
    private Map<String,Object> masked(Map<String,Object>s){var a=child(s,"address");String name=string(a,"recipientName"),phone=string(a,"phone");return map("recipientName",name.substring(0,1)+"**","phoneMasked",phone.length()>=7?phone.substring(0,3)+"****"+phone.substring(phone.length()-4):"****","region",""+a.get("province")+a.get("city")+a.get("district"));}
    PricingCalculator.Quote pricingSnapshot(Map<String,Object>s){var lines=items(s).stream().map(i->{boolean weight="BY_WEIGHT".equals(i.get("priceMode"));var in=new PricingCalculator.LineInput(string(i,"skuId"),PriceMode.valueOf(string(i,"priceMode")),number(i,"unitPrice"),number(i,"quantity"),weight?number(i,"estimatedGram"):0,weight?number(i,"priceUnitGram"):0,true);long net=number(i,"originalPayableAmount"),coupon=number(i,"couponAllocationAmount");return new PricingCalculator.QuotedLine(in,add(net,coupon),coupon,net);}).toList();
        var p=child(s,"price");long net=number(p,"goodsPayableAmount"),coupon=number(p,"couponDiscountAmount"),freight=number(p,"freightAmount");return new PricingCalculator.Quote(lines,add(net,coupon),coupon,net,freight,number(p,"payableAmount"));}
    @SuppressWarnings("unchecked") Map<String,Object> snapshot(OrderRow o){return json.readValue(o.snapshotJson,Map.class);}
    @SuppressWarnings("unchecked") Map<String,Object> object(Object value){return value==null?Map.of():json.convertValue(value,Map.class);}
    @SuppressWarnings("unchecked") static Map<String,Object> child(Map<String,Object>map,String key){return (Map<String,Object>)map.get(key);}
    @SuppressWarnings("unchecked") static List<Map<String,Object>> items(Map<String,Object>s){return (List<Map<String,Object>>)s.get("items");}
    static Map<String,Object> map(Object...entries){Map<String,Object>m=new LinkedHashMap<>();for(int i=0;i<entries.length;i+=2)m.put((String)entries[i],entries[i+1]);return m;}
    static String string(Map<String,Object>m,String key){return (String)m.get(key);}static long number(Map<String,Object>m,String key){return ((Number)m.get(key)).longValue();}
    static Instant instant(Object v){return v instanceof Instant i?i:OffsetDateTime.parse(v.toString()).toInstant();}
    static String id(String prefix){return prefix+"_"+UUID.randomUUID().toString();}
    static OrderRow required(OrderRow o){if(o==null)throw ApiException.notFound();return o;}
    static void version(long actual,long expected){if(expected<0||expected>MAX_SAFE)throw ApiException.invalid("版本超出安全整数范围");if(actual<0||actual>MAX_SAFE)throw new IllegalStateException("Persisted resource version exceeds contract range");if(actual!=expected)throw ApiException.conflict("版本已变化，请刷新后重试");}
    static long nextVersion(long current){if(current<0||current>=MAX_SAFE)throw ApiException.conflict("资源版本已达到安全上限，不能继续变更");return current+1;}
    static void paging(int page,int size){if(page<1||size<1||size>100)throw ApiException.invalid("分页范围不合法");}
    static void validOrderStatus(String status){if(status!=null&&!Set.of("PENDING_PAY","PAID","PICKING","READY_TO_SHIP","DELIVERING","FINISHED","CANCELED","CLOSED").contains(status))throw ApiException.invalid("订单状态不合法");}
    private static <T> Map<String,Object> page(List<T>all,int page,int size,java.util.function.Function<T,Map<String,Object>>view){return map("page",page,"size",size,"total",all.size(),"items",all.stream().skip((long)(page-1)*size).limit(size).map(view).toList());}
    static ApiException conflict(String key,int code,String message){return new ApiException(409,code,key,message);}
    static ApiException stock(String message){return new ApiException(422,1201,"INSUFFICIENT_STOCK",message);}
    static ApiException invalidState(String message){return conflict("INVALID_STATE",1007,message);}
    static ApiException mismatch(String message){return new ApiException(422,1302,"PAYMENT_MISMATCH",message);}
}
