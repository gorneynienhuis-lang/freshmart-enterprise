# v0.1 编写基线

2026-10-18。Codex 根据用户“统一规则并直接推进”的授权制定的工程基线；不冒称所有产品取舍已由用户逐条确认。工程取舍与视觉确认边界见 `../collab/codex/DECISIONS-001.md`。本文件优先于 Claude 早期草案，随后由同版本业务规则、状态模型及 OpenAPI 展开。

- 工程目录沿用 `fresh-mall/`。React + Vite + TypeScript（用户在 Claude 会话已选择）；后端模块化单体 Java 21 / Spring Boot 4.1 / MySQL 8.4 / Redis，依赖具体补丁版本在实施时核实并锁定。所有 UI、品牌、页面布局、PPT 属于 Claude；后端、数据库、部署、正式文档初稿属于 Codex。
- 单自营门店、单仓配送；单币种 CNY。公开 API `/api/v1`，运营接口 `/api/v1/admin`。对外所有 ID 为字符串（内部可 bigint），业务码独立。金额整数分，重量整数克，数量基础单位 `PIECE` 或 `GRAM`。`priceMode` 为 `BY_PIECE` / `BY_WEIGHT`，称重单价明确 `priceUnitGram`（默认 500），禁止直接用克乘每斤价。
- 响应 `{code:0,message:"ok",data:...,traceId:"...",timestamp:"2026-10-18T02:30:00+08:00"}`，错误使用真实 HTTP 4xx/5xx 和非零整数业务码；分页 `{page,size,total,items}`。业务时区 `Asia/Shanghai`；传输 RFC3339。订单支付期限创建后 15 分钟。时段 09–12 / 14–17 / 18–21，容量默认30，可配置。预约只接受尚未截止且有容量的时段。
- `GUEST` 非持久角色；注册账户 `MEMBER`，员工 `PICKER/COURIER/OPERATOR/SERVICE/FINANCE/ADMIN`。员工身份与购物权限独立，ADMIN 不自动拥有一切业务权限，不能绕过金额、库存、审计约束；可以显式给同一账号 MEMBER 权限。客服审核，财务执行退款，禁止同一人审核并执行同笔人工售后退款。自动称重退差与晚付退款按系统规则执行并审计。
- 支付使用沙箱，无真实收费；注册即基础会员，付费会员不在 v0.1，会员成交价与参考原价明确展示。新人券可以与会员价叠加；临期单价与会员单价取低，商品优惠后再计算券，再算运费。运费默认600分，优惠后商品实付满9900分免运费；门槛按下单快照，称重不回溯增收运费。最终价格由后端报价，客户端不提交可信金额。
- 批次台账唯一库存真相；available=onHand-reserved-quarantined，必须非负。按FEFO且 delivery window结束前不过期的批次分配。NORMAL/QUARANTINED/DISPOSED为生命周期；freshness NORMAL/NEAR_EXPIRY/EXPIRED 为按时钟计算的派生属性。临期阈值可配默认3天。付款只确认资金，库存保持预占；实际拣货最终确认后预占与onHand一起扣减，库存流水记录出库。该选择取代旧草案“支付即物理扣库存”，确保在库量有统一含义。
- 下单事务同时锁定报价、券、FEFO批次预占和配送名额，任一失败全部回滚。超时/取消释放未出库预占及名额（名额只在取消时释放，完成不回填历史容量）。支付回调不重新FEFO分配。拣货变化需显式重新分配且原子校验，不能暗中换批。已拣待发的取消须完成实物回库质检才恢复可售量。
- 订单状态仅 `PENDING_PAY/PAID/PICKING/READY_TO_SHIP/DELIVERING/FINISHED/CANCELED/CLOSED`。退款是独立实体，部分退款不改变履约状态。未付可取消；已付仅在发货前（含READY_TO_SHIP）可请求取消，进入 CANCELED 并异步退款；配送中不支持普通取消，只能客服异常处理与售后。
- 支付单 `INIT/PENDING/SUCCESS/FAILED/CLOSED`；退款单 `PENDING/PROCESSING/SUCCESS/FAILED`。支付单成功后不改成REFUNDED，退款金额另算。订单支付尝试可多次，成功入账最多一次；补款绑定差额单。晚付不复活关单，触发唯一原路退款。回调服务端验签、验金额/币种/绑定关系，以渠道事件ID和支付单资金账唯一键防重。
- 售后 `APPLIED/APPROVED/REJECTED/REFUNDING/COMPLETED/CANCELED`；可对已完成订单7天内提出，按订单行和实付金额封顶；品质退赔不回可售库存。履约前缺货、称重差额由履约调整流程处理，不冒充售后。
- 称重差额 `NONE/REFUND_PENDING/REFUNDED/TOP_UP_PENDING/SETTLED/CANCELED`。估重预付，实重半入取整到分（逐订单行），最多超估重10%；超过限值拒绝拣货提交。多退少补，补款必须另建支付单且成功后方可发货；补款期限10分钟且不能晚于时段开始，过期取消未发货整单、退款已收金额并按实际库存阶段恢复，禁止静默扣款。允许部分缺货，实际量可0，须SHORTAGE原因并释放对应预占；全单实际0取消且退全部实收含运费。称重运费不变，券固定按原成交比例分摊后不超过重算行额，退差不重复退券份额。
- 支持订单行多批次：独立 allocation，不把 batchNo 塞成单字段。品质退款记录售后损耗归因，不凭退款再减一次已出库库存。库存盘点/损耗调整要理由、版本号及审计。
- 变更命令使用 Idempotency-Key（创建订单/支付/退款/售后/库存变更/称重/发货等），按主体+路由+键持久化请求哈希及结果；同键不同体409；回调用渠道事件幂等。资源 version 乐观锁，不用前端按钮控制替代服务端状态与授权。
- access token短效15分钟内存持有，refresh token以HttpOnly/Secure cookie（本地http仅开发例外）轮换7天，后端可吊销。Cookie变更端点校验Origin/CSRF；CORS显式allowlist，不允许*+credentials。对越权他人资源返回404；未认证401；无操作权限403。
- v0.1 是可评审契约，非系统已经实现或已通过测试的声明。测试/压测/可用率未执行就写“待执行”，不得编结果。原始 A/B/C 文件只读保存，不把旧表库存直接导入生产。
