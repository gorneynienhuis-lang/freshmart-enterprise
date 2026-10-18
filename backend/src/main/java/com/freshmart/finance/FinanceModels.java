package com.freshmart.finance;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class FinanceModels {
    private FinanceModels() {}
    public record Request(@NotNull LocalDate businessDate) {}
    public record Difference(String resourceType,String resourceId,String type,long bookAmount,Long channelAmount,long differenceAmount,String description) {}
    public record Reconciliation(String reconciliationId,LocalDate businessDate,String status,long paymentCount,long paymentAmount,long refundCount,long refundAmount,long differenceAmount,long differenceCount,Instant createdAt,Instant completedAt,List<Difference> differences,boolean detailsTruncated) {}
    public record MoneyRow(String id,String paymentId,String orderId,String reference,long amount) {}
    public record OrderBalance(String orderId,long paidAmount,long refundedAmount,long ledgerPaid,long ledgerRefunded) {}
}
