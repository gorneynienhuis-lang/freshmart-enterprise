package com.freshmart.checkout;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
/** Durable rolling slots. Duplicate initialization never resets configured capacity or usage. */
@Component @EnableScheduling
public class CheckoutSchedule {
 private final CheckoutService checkout;
 public CheckoutSchedule(CheckoutService checkout){this.checkout=checkout;}
 @EventListener(ApplicationReadyEvent.class) public void initialize(){checkout.initializeSlots();}
 @Scheduled(cron="0 0 * * * *",zone="Asia/Shanghai") public void refresh(){checkout.initializeSlots();}
}
