package com.freshmart.finance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;

/** A verified event snapshot, separate from the payment/order bookkeeping projections. */
@Service
public class ChannelLedger {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public ChannelLedger(JdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void recordPayment(String eventId, String paymentId, String tradeNo, String status, long amount, Instant occurredAt) {
        if (!java.util.Set.of("SUCCESS", "FAILED").contains(status) || amount <= 0)
            throw new IllegalArgumentException("Invalid verified channel event");
        jdbc.update("INSERT INTO fm_sandbox_payment_receipt(event_id,payment_id,channel_trade_no,status,amount,occurred_at,recorded_at) VALUES(?,?,?,?,?,?,?)",
                eventId, paymentId, tradeNo, status, amount, Timestamp.from(occurredAt), Timestamp.from(clock.instant()));
    }
}
