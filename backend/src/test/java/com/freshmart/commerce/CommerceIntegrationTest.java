package com.freshmart.commerce;

import com.freshmart.checkout.*;
import com.freshmart.common.*;
import com.freshmart.identity.AuthenticationService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import static com.freshmart.commerce.CommerceModels.*;
import static com.freshmart.commerce.CommerceService.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.profiles.active=test","spring.datasource.url=jdbc:h2:mem:commerce;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.username=sa","spring.datasource.password=","app.token-secret=commerce-test-secret-not-for-deployment-123456789",
        "app.sandbox-enabled=true","app.sandbox-secret=sandbox-test-secret-not-for-deployment-987654321","app.secure-cookies=false","app.commerce-jobs-enabled=false"})
@AutoConfigureMockMvc
class CommerceIntegrationTest {
    static final AtomicLong PHONES=new AtomicLong(13600000000L);
    static final AtomicLong SLOT_SEQUENCE=new AtomicLong();
    @Autowired CommerceService service;@Autowired CommerceMapper db;@Autowired CheckoutService checkout;@Autowired CheckoutMapper checkoutDb;
    @Autowired AuthenticationService auth;@Autowired JdbcTemplate jdbc;@Autowired ObjectMapper json;@Autowired MockMvc mvc;
    @Autowired SandboxSignature signatures;@Autowired RefundProcessor refunds;@Autowired SandboxRefundGateway gateway;
    RequestActor member,picker,courier;String memberToken,otherToken,pickerToken,sku,batchId;CheckoutModels.AddressView address;CheckoutModels.SlotRow slot;
    @BeforeEach void seed(){
        var m=account("MEMBER");member=m.actor();memberToken=m.token();var p=account("PICKER");picker=p.actor();pickerToken=p.token();courier=account("COURIER").actor();otherToken=account("MEMBER").token();
        address=checkout.createAddress(member.userId(),new CheckoutModels.AddressInput("演示同学","13800138000","上海市","上海市","松江区","东华大学测试地址",true));
        Instant start=LocalDate.now(CheckoutService.ZONE).plusDays(1).atTime(14,0).atZone(CheckoutService.ZONE).toInstant().plusSeconds(SLOT_SEQUENCE.incrementAndGet());
        slot=new CheckoutModels.SlotRow(id("slot"),LocalDate.now(CheckoutService.ZONE).plusDays(1),"14:00–17:00",start,start.plusSeconds(10800),start,30,0,true,0);checkoutDb.insertSlot(slot);
        String cat=id("cat"),product=id("spu");sku=id("sku");batchId=id("batch");
        jdbc.update("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES(?,?,'生鲜','鲜','http://localhost:8080/catalog/S001.jpg')",cat,cat);
        jdbc.update("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url,status) VALUES(?,?,?,'测试鲜虾','独立测试商品','上海','COLD','http://localhost:8080/catalog/S001.jpg','ON_SALE')",product,product,cat);
        jdbc.update("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url,status) VALUES(?,?,?,'500克','500g','GRAM','BY_WEIGHT',500,1200,1000,'http://localhost:8080/catalog/S001.jpg','ACTIVE')",sku,sku,product);
        jdbc.update("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES(?,?,?,'W1',?,?,'NORMAL',10000,0,0)",batchId,sku,batchId,Timestamp.from(Instant.now().minusSeconds(86400)),Timestamp.from(start.plusSeconds(10*86400)));
    }
    record Account(RequestActor actor,String token){}
    Account account(String role){var issued=auth.register(Long.toString(PHONES.incrementAndGet()),"Commerce-test-2026-password!",role);String id=issued.body().user().userId();if(!"MEMBER".equals(role)){jdbc.update("DELETE FROM fm_user_role WHERE user_id=?",id);jdbc.update("INSERT INTO fm_user_role(user_id,role_code) VALUES(?,?)",id,role);}return new Account(new RequestActor(id,Set.of(role),Set.of(),"test"),issued.body().accessToken());}
    CheckoutModels.QuoteView quote(long quantity){return checkout.quote(member.userId(),new CheckoutModels.QuoteRequest(List.of(new CheckoutModels.PurchaseItem(sku,quantity)),address.addressId(),slot.slotId(),null));}
    Map<String,Object> order(long quantity){var q=quote(quantity);return service.create(member,new CreateOrder(q.quoteId(),q.quoteToken(),null));}
    String orderId(Map<String,Object>o){return string(o,"orderId");}
    Map<String,Object> pay(String id){var p=service.prepay(member,new Prepay(id,"ORDER",null));return service.simulate(member,string(p,"paymentId"),new Simulate("SUCCESS",number(p,"version")));}
    Map<String,Object> pick(String id,long actual){var o=db.order(id);var task=service.claim(picker,o.pickTaskId,new Version(o.version));var allocation=db.allocations(id).getFirst();return service.confirmPick(picker,o.pickTaskId,new PickConfirm(List.of(new PickLine(allocation.allocationId,actual,actual==allocation.reservedQuantity?"NORMAL":"WEIGHT_VARIANCE","测试实拣")),number(task,"version")));}
    void processRefunds(String order){for(var r:db.refunds(order)){var claimed=refunds.claim(r.refundId);if(claimed!=null){gateway.execute(claimed);refunds.complete(claimed);}}}
    String key(){return UUID.randomUUID().toString();}
    long stock(String column){return jdbc.queryForObject("SELECT "+column+" FROM fm_inventory_batch WHERE batch_id=?",Long.class,batchId);}

    @Test void createIsAtomicAndHttpIdempotencyDoesNotDoubleReserve()throws Exception{
        var q=quote(500);String key=key(),body=json.writeValueAsString(new CreateOrder(q.quoteId(),q.quoteToken(),null));
        var first=mvc.perform(post("/api/v1/orders").header("Authorization","Bearer "+memberToken).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn();
        var second=mvc.perform(post("/api/v1/orders").header("Authorization","Bearer "+memberToken).header("Idempotency-Key",key).contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn();
        assertEquals(json.readTree(first.getResponse().getContentAsString()).path("data"),json.readTree(second.getResponse().getContentAsString()).path("data"));
        assertEquals(500,stock("reserved"));assertEquals(1,checkoutDb.lockSlot(slot.slotId()).used());
        mvc.perform(post("/api/v1/orders").header("Authorization","Bearer "+memberToken).header("Idempotency-Key",key).contentType("application/json").content(body.replace("\"buyerNote\":null","\"buyerNote\":\"different\""))).andExpect(status().isConflict());
        assertThrows(ApiException.class,()->service.create(member,new CreateOrder(q.quoteId(),q.quoteToken(),null)));
    }
    @Test void shortageRollsBackSlotCouponQuoteAndOrder(){var q=quote(500);jdbc.update("UPDATE fm_inventory_batch SET on_hand=0 WHERE batch_id=?",batchId);
        assertThrows(ApiException.class,()->service.create(member,new CreateOrder(q.quoteId(),q.quoteToken(),null)));
        assertEquals(0,checkoutDb.lockSlot(slot.slotId()).used());assertEquals(0,db.orderCount(member.userId(),null));assertEquals("OPEN",checkoutDb.lockQuote(q.quoteId(),member.userId()).status());}
    @Test void rolesAndOwnershipAreEnforcedAtHttpBoundary()throws Exception{var o=order(500);String id=orderId(o);
        mvc.perform(get("/api/v1/orders/"+id).header("Authorization","Bearer "+otherToken)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/admin/pick-tasks").header("Authorization","Bearer "+memberToken)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/orders").header("Authorization","Bearer "+pickerToken).header("Idempotency-Key",key()).contentType("application/json").content("{}")).andExpect(status().isForbidden());
        pay(id);var row=db.order(id);service.claim(picker,row.pickTaskId,new Version(row.version));var other=account("PICKER");assertEquals(404,assertThrows(ApiException.class,()->service.pickTask(other.actor(),row.pickTaskId)).status());}
    @Test void signedCallbackRejectsTamperAndDuplicateEventIsIdempotent()throws Exception{String id=orderId(order(500));var p=service.prepay(member,new Prepay(id,"ORDER",null));
        var event=new Callback(id("event"),string(p,"paymentId"),id("trade"),"SUCCESS",number(p,"amount"),"CNY",Instant.now());String raw=json.writeValueAsString(event);var sign=signatures.sign(raw);
        mvc.perform(post("/api/v1/payments/sandbox/callback").header("X-Sandbox-Timestamp",sign.timestamp()).header("X-Sandbox-Nonce",sign.nonce()).header("X-Sandbox-Signature","0".repeat(64)).contentType("application/json").content(raw)).andExpect(status().isUnauthorized());
        for(int i=0;i<2;i++)mvc.perform(post("/api/v1/payments/sandbox/callback").header("X-Sandbox-Timestamp",sign.timestamp()).header("X-Sandbox-Nonce",sign.nonce()).header("X-Sandbox-Signature",sign.signature()).contentType("application/json").content(raw)).andExpect(status().isOk()).andExpect(jsonPath("$.data.duplicate").value(i==1));
        assertEquals(number(p,"amount"),db.order(id).paidAmount);assertEquals(500,stock("reserved"));assertEquals(10000,stock("on_hand"));
    }
    @Test void lighterPickingRefundSurvivesChannelCompletionRetry(){String id=orderId(order(500));pay(id);pick(id,480);var row=db.order(id);assertEquals("REFUND_PENDING",row.adjustmentStatus);assertEquals(-40,row.adjustmentDelta);assertEquals(9520,stock("on_hand"));assertEquals(0,stock("reserved"));
        assertThrows(ApiException.class,()->service.dispatch(picker,row.deliveryTaskId,new Dispatch(courier.userId(),row.version)));
        var r=db.refunds(id).getFirst();var claimed=refunds.claim(r.refundId);gateway.execute(claimed);gateway.execute(claimed);refunds.complete(claimed);refunds.complete(claimed);
        assertEquals(40,db.order(id).refundedAmount);assertEquals("REFUNDED",db.order(id).adjustmentStatus);assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_sandbox_refund_receipt WHERE refund_id=?",Integer.class,r.refundId));
    }
    @Test void fullShortageCancelsAndRefundsGoodsAndFreightWithoutPhysicalStockMovement(){String id=orderId(order(500));pay(id);var before=db.order(id);
        var task=service.claim(picker,before.pickTaskId,new Version(before.version));var allocation=db.allocations(id).getFirst();
        service.confirmPick(picker,before.pickTaskId,new PickConfirm(List.of(new PickLine(allocation.allocationId,0L,"SHORTAGE","整批缺货")),number(task,"version")));
        var canceled=db.order(id);assertEquals("CANCELED",canceled.status);assertEquals("CANCELED",canceled.pickStatus);assertEquals("CANCELED",canceled.deliveryStatus);
        assertEquals(10000,stock("on_hand"));assertEquals(0,stock("reserved"));assertEquals(0,checkoutDb.lockSlot(slot.slotId()).used());
        assertEquals(0,db.allocations(id).getFirst().pickedQuantity);assertEquals(0,db.allocations(id).getFirst().reservedQuantity);
        assertEquals(before.paidAmount,db.refunds(id).stream().mapToLong(r->r.amount).sum());assertTrue(before.paidAmount>1000,"全额退款包含原有配送费");
        processRefunds(id);processRefunds(id);assertEquals(before.paidAmount,db.order(id).refundedAmount);assertEquals(1,db.refunds(id).size());
        assertEquals(10000,stock("on_hand"));assertEquals(0,stock("quarantined"));assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM fm_sandbox_refund_receipt WHERE refund_id=?",Integer.class,db.refunds(id).getFirst().refundId));
    }
    @Test void overweightRejectedThenTopUpAndReceiptCloseTheLoop(){String id=orderId(order(500));pay(id);var o=db.order(id);var task=service.claim(picker,o.pickTaskId,new Version(o.version));var a=db.allocations(id).getFirst();String pickId=o.pickTaskId;
        assertThrows(com.freshmart.domain.DomainException.class,()->service.confirmPick(picker,pickId,new PickConfirm(List.of(new PickLine(a.allocationId,551L,"WEIGHT_VARIANCE","实重")),number(task,"version"))));assertEquals(10000,stock("on_hand"));
        service.confirmPick(picker,o.pickTaskId,new PickConfirm(List.of(new PickLine(a.allocationId,550L,"WEIGHT_VARIANCE","实重")),number(task,"version")));o=db.order(id);assertEquals(100,o.adjustmentDelta);
        var locked=o;assertThrows(ApiException.class,()->service.dispatch(picker,locked.deliveryTaskId,new Dispatch(courier.userId(),locked.version)));
        var top=service.prepay(member,new Prepay(id,"TOP_UP",o.adjustmentId));service.simulate(member,string(top,"paymentId"),new Simulate("SUCCESS",number(top,"version")));
        o=db.order(id);var delivery=service.dispatch(picker,o.deliveryTaskId,new Dispatch(courier.userId(),o.version));o=db.order(id);var dispatched=o;
        assertFalse(json.writeValueAsString(delivery).contains("receiptCode"));assertEquals(o.receiptCode,service.get(member,id).get("deliveryReceiptCode"));
        String wrong="000000".equals(o.receiptCode)?"111111":"000000";assertThrows(ApiException.class,()->service.complete(courier,dispatched.deliveryTaskId,new Complete(wrong,null,dispatched.version)));
        service.complete(courier,o.deliveryTaskId,new Complete(o.receiptCode,"测试签收",o.version));assertEquals("FINISHED",db.order(id).status);assertNull(service.get(member,id).get("deliveryReceiptCode"));assertEquals(1,checkoutDb.lockSlot(slot.slotId()).used());
    }
    @Test void expiredOrderLatePaymentNeverResurrectsOrLeaksReservedStock(){String id=orderId(order(500));var p=service.prepay(member,new Prepay(id,"ORDER",null));jdbc.update("UPDATE fm_order SET payment_expires_at=? WHERE order_id=?",Timestamp.from(Instant.now().minusSeconds(1)),id);
        service.expire(id);assertEquals("CLOSED",db.order(id).status);assertEquals(0,stock("reserved"));assertEquals(0,checkoutDb.lockSlot(slot.slotId()).used());
        var event=new Callback(id("event"),string(p,"paymentId"),id("trade"),"SUCCESS",number(p,"amount"),"CNY",Instant.now());service.callback(event,id("nonce"),"a".repeat(64));processRefunds(id);
        assertEquals("CLOSED",db.order(id).status);assertEquals(0,db.order(id).paidAmount);assertEquals("SUCCESS",db.refunds(id).getFirst().status);assertEquals("LATE_PAYMENT",db.refunds(id).getFirst().type);
    }
    @Test void secondSuccessfulAttemptRefundsWithoutSecondFulfillment(){String id=orderId(order(500));var p=service.prepay(member,new Prepay(id,"ORDER",null));service.simulate(member,string(p,"paymentId"),new Simulate("FAILED",number(p,"version")));pay(id);
        service.callback(new Callback(id("event"),string(p,"paymentId"),id("trade"),"SUCCESS",number(p,"amount"),"CNY",Instant.now()),id("nonce"),"b".repeat(64));
        processRefunds(id);assertEquals(number(p,"amount"),db.order(id).paidAmount);assertEquals("PAID",db.order(id).status);assertEquals("DUPLICATE_PAYMENT",db.refunds(id).getFirst().type);assertEquals(0,db.order(id).refundedAmount);
    }
    @Test void cancelPickedGoodsRequiresPhysicalReturnBeforeAvailableAgain(){String id=orderId(order(500));pay(id);pick(id,500);var o=db.order(id);service.cancel(member,id,new ReasonVersion("取消测试",o.version),false);assertEquals(9500,stock("on_hand"));
        o=db.order(id);var a=db.allocations(id).getFirst();service.receiveReturn(picker,id,new ReturnReceive(List.of(new ReturnLine(a.allocationId,450L,50L)),"已实收，50g隔离",o.version));
        assertEquals(10000,stock("on_hand"));assertEquals(50,stock("quarantined"));assertEquals(0,stock("reserved"));processRefunds(id);assertEquals(db.order(id).paidAmount,db.order(id).refundedAmount);
    }
    @Test void concurrentQuotesCannotOverbookLastSlot()throws Exception{jdbc.update("UPDATE fm_delivery_slot SET capacity=1 WHERE slot_id=?",slot.slotId());var q1=quote(500);var q2=quote(500);var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){var results=List.of(q1,q2).stream().map(q->pool.submit(()->{gate.await();try{service.create(member,new CreateOrder(q.quoteId(),q.quoteToken(),null));return true;}catch(ApiException e){return false;}})).toList();gate.countDown();int successes=0;for(var f:results)if(f.get(10,TimeUnit.SECONDS))successes++;assertEquals(1,successes);}
        assertEquals(1,checkoutDb.lockSlot(slot.slotId()).used());assertEquals(500,stock("reserved"));
    }
}
