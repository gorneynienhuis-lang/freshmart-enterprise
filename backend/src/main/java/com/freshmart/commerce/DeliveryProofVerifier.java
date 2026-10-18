package com.freshmart.commerce;

import com.freshmart.common.ApiException;
import com.freshmart.identity.IdentityMapper;
import com.freshmart.identity.TokenCodec;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;

@Service
public class DeliveryProofVerifier {
    private final IdentityMapper db;private final Clock clock;
    public DeliveryProofVerifier(IdentityMapper db,Clock clock){this.db=db;this.clock=clock;}
    /** Failed attempts persist even when the surrounding delivery transaction is rejected. Never log the proof. */
    @Transactional(propagation=Propagation.REQUIRES_NEW,noRollbackFor=ApiException.class)
    public void verify(String orderId,String actorId,String expected,String actual){
        String key=TokenCodec.hash("delivery-proof:"+orderId+":"+actorId);var now=clock.instant();db.initializeThrottle(key,now);var limit=db.lockThrottle(key);
        if(limit.blockedUntil()!=null&&limit.blockedUntil().isAfter(now))throw new ApiException(429,1029,"RATE_LIMITED","签收码尝试过多，请稍后重试");
        if(expected==null||actual==null||!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),actual.getBytes(StandardCharsets.UTF_8))){
            boolean expired=limit.windowStartedAt().plusSeconds(900).isBefore(now);int count=expired?1:limit.failedCount()+1;
            db.updateThrottle(key,count,expired?now:limit.windowStartedAt(),count>=5?now.plusSeconds(900):null);
            throw new ApiException(422,1211,"PROOF_INVALID","签收凭证不正确");
        }
        db.updateThrottle(key,0,now,null);
    }
}
