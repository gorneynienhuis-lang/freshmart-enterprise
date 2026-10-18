package com.freshmart.finance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import static com.freshmart.finance.FinanceModels.*;

@Repository
public class FinanceRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public FinanceRepository(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc; this.json=json; }
    public List<MoneyRow> payments(Instant from,Instant to) {
        return jdbc.query("SELECT payment_id,order_id,channel_trade_no,amount FROM fm_payment WHERE status='SUCCESS' AND paid_at>=? AND paid_at<? ORDER BY payment_id",
                (r,i)->new MoneyRow(r.getString("payment_id"),r.getString("payment_id"),r.getString("order_id"),r.getString("channel_trade_no"),r.getLong("amount")),Timestamp.from(from),Timestamp.from(to));
    }
    public List<MoneyRow> channelPayments(Instant from,Instant to) {
        // Retransmitted success events for the same trade count once, on its first recorded day.
        return jdbc.query("SELECT payment_id,channel_trade_no,MAX(amount) AS amount FROM fm_sandbox_payment_receipt WHERE status='SUCCESS' GROUP BY payment_id,channel_trade_no HAVING MIN(recorded_at)>=? AND MIN(recorded_at)<? ORDER BY payment_id,channel_trade_no",
                (r,i)->new MoneyRow(r.getString("payment_id"),r.getString("payment_id"),null,r.getString("channel_trade_no"),r.getLong("amount")),Timestamp.from(from),Timestamp.from(to));
    }
    public List<MoneyRow> refunds(Instant from,Instant to) {
        return jdbc.query("SELECT refund_id,payment_id,order_id,amount FROM fm_refund WHERE status='SUCCESS' AND completed_at>=? AND completed_at<? ORDER BY refund_id",
                (r,i)->new MoneyRow(r.getString("refund_id"),r.getString("payment_id"),r.getString("order_id"),null,r.getLong("amount")),Timestamp.from(from),Timestamp.from(to));
    }
    public List<MoneyRow> channelRefunds(Instant from,Instant to) {
        return jdbc.query("SELECT refund_id,payment_id,channel_refund_no,amount FROM fm_sandbox_refund_receipt WHERE completed_at>=? AND completed_at<? ORDER BY refund_id",
                (r,i)->new MoneyRow(r.getString("refund_id"),r.getString("payment_id"),null,r.getString("channel_refund_no"),r.getLong("amount")),Timestamp.from(from),Timestamp.from(to));
    }
    public List<OrderBalance> orderBalances(Instant from,Instant to) {
        return jdbc.query("SELECT o.order_id,o.paid_amount,o.refunded_amount,COALESCE((SELECT SUM(p.amount) FROM fm_payment p WHERE p.order_id=o.order_id AND p.status='SUCCESS' AND p.accepted=TRUE),0) AS ledger_paid,COALESCE((SELECT SUM(r.amount) FROM fm_refund r JOIN fm_payment p ON p.payment_id=r.payment_id WHERE r.order_id=o.order_id AND r.status='SUCCESS' AND p.accepted=TRUE),0) AS ledger_refunded FROM fm_order o WHERE EXISTS(SELECT 1 FROM fm_payment p WHERE p.order_id=o.order_id AND p.paid_at>=? AND p.paid_at<?) OR EXISTS(SELECT 1 FROM fm_refund r WHERE r.order_id=o.order_id AND r.completed_at>=? AND r.completed_at<?)",
                (r,i)->new OrderBalance(r.getString("order_id"),r.getLong("paid_amount"),r.getLong("refunded_amount"),r.getLong("ledger_paid"),r.getLong("ledger_refunded")),Timestamp.from(from),Timestamp.from(to),Timestamp.from(from),Timestamp.from(to));
    }
    public void insert(Reconciliation r,String actor) {
        jdbc.update("INSERT INTO fm_reconciliation(reconciliation_id,business_date,created_by,status,payment_count,payment_amount,refund_count,refund_amount,difference_amount,difference_count,details_json,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                r.reconciliationId(),r.businessDate(),actor,r.status(),r.paymentCount(),r.paymentAmount(),r.refundCount(),r.refundAmount(),r.differenceAmount(),r.differenceCount(),json.writeValueAsString(r),Timestamp.from(r.createdAt()),Timestamp.from(r.completedAt()));
    }
    public long count(LocalDate date) { return date==null ? jdbc.queryForObject("SELECT COUNT(*) FROM fm_reconciliation",Long.class) : jdbc.queryForObject("SELECT COUNT(*) FROM fm_reconciliation WHERE business_date=?",Long.class,date); }
    public List<Reconciliation> list(LocalDate date,int page,int size) {
        var args=new ArrayList<Object>();String where="";if(date!=null){where=" WHERE business_date=?";args.add(date);}args.add(size);args.add((long)(page-1)*size);
        return jdbc.query("SELECT details_json FROM fm_reconciliation"+where+" ORDER BY created_at DESC,reconciliation_id DESC LIMIT ? OFFSET ?",(rs,i)->json.readValue(rs.getString(1),Reconciliation.class),args.toArray());
    }
}
