package com.freshmart.identity;

import com.freshmart.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.*;

/** Persistent account and socket-peer limits. Never trusts client-supplied forwarding headers. */
@Component
public class LoginThrottlePolicy {
    private final IdentityMapper mapper;
    private final Clock clock;
    private final Rule account, peer;

    public LoginThrottlePolicy(IdentityMapper mapper, Clock clock,
            @Value("${app.login-account-max-failures:5}") int accountFailures,
            @Value("${app.login-account-window-seconds:60}") long accountWindow,
            @Value("${app.login-account-block-seconds:900}") long accountBlock,
            @Value("${app.login-ip-max-failures:50}") int peerFailures,
            @Value("${app.login-ip-window-seconds:60}") long peerWindow,
            @Value("${app.login-ip-block-seconds:60}") long peerBlock) {
        this.mapper=mapper; this.clock=clock;
        account=new Rule(accountFailures, accountWindow, accountBlock);
        peer=new Rule(peerFailures, peerWindow, peerBlock);
    }
    public record Rule(int maxFailures, long windowSeconds, long blockSeconds) {
        public Rule {
            if(maxFailures<1||maxFailures>1000||windowSeconds<1||windowSeconds>86400||blockSeconds<1||blockSeconds>86400)
                throw new IllegalStateException("Invalid bounded login throttling policy");
        }
    }
    public record Locked(String accountHash, ThrottleRow account, String peerHash, ThrottleRow peer) {}

    /** Call only inside login's noRollbackFor=ApiException transaction. Lock order is account then peer. */
    public Locked lock(String phone, String remoteAddress) {
        Instant now=clock.instant();
        String accountHash=TokenCodec.hash("login:"+phone);
        mapper.initializeThrottle(accountHash,now); ThrottleRow accountState=mapper.lockThrottle(accountHash);
        String peerHash=remoteAddress==null?null:TokenCodec.hash("login-peer:"+remoteAddress);
        ThrottleRow peerState=null;
        if(peerHash!=null) { mapper.initializeThrottle(peerHash,now); peerState=mapper.lockThrottle(peerHash); }
        long retry=Math.max(remaining(accountState,now),remaining(peerState,now));
        if(retry>0)throw new Limited(retry);
        return new Locked(accountHash,accountState,peerHash,peerState);
    }
    public void failure(Locked locked) {
        Instant now=clock.instant();
        failed(locked.accountHash(),locked.account(),account,now);
        if(locked.peerHash()!=null)failed(locked.peerHash(),locked.peer(),peer,now);
    }
    public void success(Locked locked) {
        // A valid account cannot reset a shared peer's accumulated failed attempts.
        mapper.updateThrottle(locked.accountHash(),0,clock.instant(),null);
    }
    private void failed(String hash, ThrottleRow state, Rule rule, Instant now) {
        boolean expired=!state.windowStartedAt().plusSeconds(rule.windowSeconds()).isAfter(now);
        int count=expired?1:Math.min(rule.maxFailures(),state.failedCount()+1);
        mapper.updateThrottle(hash,count,expired?now:state.windowStartedAt(),count>=rule.maxFailures()?now.plusSeconds(rule.blockSeconds()):null);
    }
    private static long remaining(ThrottleRow state, Instant now) {
        if(state==null||state.blockedUntil()==null||!state.blockedUntil().isAfter(now))return 0;
        long millis=Duration.between(now,state.blockedUntil()).toMillis();return Math.max(1,(millis+999)/1000);
    }
    private static final class Limited extends ApiException {
        private final long seconds;
        Limited(long seconds) {super(429,1029,"RATE_LIMITED","登录尝试过多，请稍后重试");this.seconds=seconds;}
        @Override public long retryAfterSeconds(){return seconds;}
    }
}
