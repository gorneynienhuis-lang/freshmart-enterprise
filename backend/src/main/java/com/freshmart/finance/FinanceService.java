package com.freshmart.finance;

import com.freshmart.audit.AuditRecorder;
import com.freshmart.common.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import static com.freshmart.finance.FinanceModels.*;

@Service
public class FinanceService {
    private static final ZoneId ZONE=ZoneId.of("Asia/Shanghai");
    private static final long MAX_SAFE=9007199254740991L;
    private final FinanceRepository repository;
    private final AuditRecorder audit;
    private final Clock clock;
    public FinanceService(FinanceRepository repository,AuditRecorder audit,Clock clock) { this.repository=repository;this.audit=audit;this.clock=clock; }
    @Transactional(readOnly=true)
    public PageResult<Reconciliation> list(RequestActor actor,LocalDate date,int page,int size) {
        actor.requirePermission("reconciliation.read");
        if(page<1||size<1||size>100)throw ApiException.invalid("分页参数无效");
        return new PageResult<>(page,size,repository.count(date),repository.list(date,page,size));
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public Reconciliation reconcile(RequestActor actor,LocalDate date) {
        actor.requirePermission("reconciliation.run");
        LocalDate today=LocalDate.now(clock.withZone(ZONE));
        if(date==null||date.isAfter(today)||date.isBefore(today.minusDays(366)))throw ApiException.invalid("对账日期须为最近366天内已开始的业务日");
        Instant from=date.atStartOfDay(ZONE).toInstant(),to=date.plusDays(1).atStartOfDay(ZONE).toInstant();
        var payments=repository.payments(from,to);var channelPayments=repository.channelPayments(from,to);
        var refunds=repository.refunds(from,to);var channelRefunds=repository.channelRefunds(from,to);
        var differences=new ArrayList<Difference>();
        compare("PAYMENT",payments,channelPayments,differences);compare("REFUND",refunds,channelRefunds,differences);
        for(var order:repository.orderBalances(from,to)) {
            if(order.paidAmount()!=order.ledgerPaid())differences.add(new Difference("ORDER",order.orderId(),"ORDER_PAID_MISMATCH",order.paidAmount(),order.ledgerPaid(),safe(order.paidAmount()-order.ledgerPaid()),"订单已付与已接受支付流水不一致"));
            if(order.refundedAmount()!=order.ledgerRefunded())differences.add(new Difference("ORDER",order.orderId(),"ORDER_REFUND_MISMATCH",order.refundedAmount(),order.ledgerRefunded(),safe(order.refundedAmount()-order.ledgerRefunded()),"订单已退与已接受支付的成功退款不一致"));
        }
        long captured=total(payments),returned=total(refunds),channelCaptured=total(channelPayments),channelReturned=total(channelRefunds);
        Instant now=clock.instant();
        var report=new Reconciliation(UUID.randomUUID().toString(),date,"COMPLETED",payments.size(),captured,refunds.size(),returned,safe((captured-returned)-(channelCaptured-channelReturned)),differences.size(),now,now,List.copyOf(differences.subList(0,Math.min(200,differences.size()))),differences.size()>200);
        repository.insert(report,actor.userId());
        audit.record(actor,"reconciliation.create","RECONCILIATION",report.reconciliationId(),"SUCCESS","生成沙箱日对账快照；不更改订单、支付或退款账目");
        return report;
    }
    private void compare(String type,List<MoneyRow> books,List<MoneyRow> receipts,List<Difference> differences) {
        Map<String,Long> bookAmounts=aggregate(books),channelAmounts=aggregate(receipts);
        Set<String> ids=new TreeSet<>(bookAmounts.keySet());ids.addAll(channelAmounts.keySet());
        for(String id:ids) {
            Long book=bookAmounts.get(id),channel=channelAmounts.get(id);
            if(book==null)differences.add(new Difference(type,id,"MISSING_LEDGER",0,channel,safe(-channel),"存在渠道凭证，缺少对应成功账目"));
            else if(channel==null)differences.add(new Difference(type,id,"MISSING_CHANNEL",book,null,book,"缺少独立成功渠道凭证（含历史记录）；不能视为已核平"));
            else if(!book.equals(channel))differences.add(new Difference(type,id,"AMOUNT_MISMATCH",book,channel,safe(book-channel),"账目与渠道凭证金额不一致"));
        }
        if("PAYMENT".equals(type)) {
            Map<String,String> trades=new HashMap<>();for(var receipt:receipts)trades.putIfAbsent(receipt.id(),receipt.reference());
            for(var book:books)if(trades.containsKey(book.id())&&!Objects.equals(book.reference(),trades.get(book.id())))differences.add(new Difference(type,book.id(),"REFERENCE_MISMATCH",book.amount(),channelAmounts.get(book.id()),0,"渠道交易引用与账目不一致"));
        }
    }
    private Map<String,Long> aggregate(List<MoneyRow> rows) {Map<String,Long> result=new TreeMap<>();for(var row:rows)result.merge(row.id(),row.amount(),(a,b)->safe(Math.addExact(a,b)));return result;}
    private long total(List<MoneyRow> rows) {long total=0;for(var row:rows)total=safe(Math.addExact(total,row.amount()));return total;}
    private long safe(long value) {if(value < -MAX_SAFE || value > MAX_SAFE)throw ApiException.invalid("对账金额超出接口整数范围");return value;}
}
