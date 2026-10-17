# 生鲜业务规则 v0.1

版本：0.1.0；更新：2026-10-18；状态：Codex 已定工程演示基线，实施与测试待执行。

以 [BASELINE.md](BASELINE.md) 为权威；字段和枚举见 [glossary.md](glossary.md)，事务守卫见 [state-models.md](state-models.md)。用户负责视觉界面确认，其余业务工程规则按授权直接确定。本文件参数是可配置的演示默认值，非现实运营承诺。

## BR-01 范围与权限

单自营门店、单仓、CNY、预约配送、沙箱收款。注册即长期基础会员。v0.1 不做付费等级、余额钱包、积分商城、秒杀、拼团和跨店订单；营销限基础会员价、临期价、新人券及统一免邮门槛。

账户只操作自己的购物车、地址、订单、支付、售后和评价。越权他人资源404，未认证401，无操作权限403。员工权限显式授予，ADMIN无隐式全权。人工售后退款由客服审核、财务执行，reviewerId≠executorId；自动退差、晚付退款由受限系统规则执行并审计。

参考原价与会员成交价明确区分。公开API不暴露批次预占、仓位、员工信息；v0.1用户API不返回批次追溯摘要，内部仍保留订单行与批次关联。商品储存方式按真实属性，鲜活与冷藏不得混用。

## BR-02 单位与时间

金额整数分，重量整数克。BY_PIECE库存单位PIECE，BY_WEIGHT库存单位GRAM。同SKU全部批次同单位。quantity是正整数购买份数；称重SKU明确配置estimatedGramPerUnit和priceUnitGram（均>0），估量E=quantity×estimatedGramPerUnit。不得从“约600g/条”的显示文字解析数值。实际重量必须整数克。

业务时区Asia/Shanghai，RFC3339传输。now<deadline才有效，到点失效。订单支付期限=createTime+15分钟。日期型到期日导入为下一天00:00的排他expiresAt，例如2026-10-20到期表示2026-10-21T00:00:00+08:00起不可售；精确到期时间直接保留。

freshness：now≥expiresAt为EXPIRED；否则expiresAt−now≤阈值为NEAR_EXPIRY，其余NORMAL。阈值默认72小时，可配置。已过期不可售；临期仍需覆盖配送窗口。种子数据须声明业务基准时钟或按可注入Clock生成相对日期，禁止直接沿用旧表过期日期。

## BR-03 批次权威账与FEFO

每批满足onHand≥0、reserved≥0、quarantined≥0、reserved+quarantined≤onHand；available=onHand−reserved−quarantined。reserved等于有效RESERVED allocation总量。SKU库存由批次派生，不独立维护第三套数。

可分配批次须SKU上架、batch.lifecycle=NORMAL、available>0、now<expiresAt，且slot.endAt<expiresAt，保证配送窗口结束时未失效。按(expiresAt,receivedAt,batchId)升序FEFO，前批不足取后批，合计不足整单拒绝。一个订单行可以有多个allocation，逐条记录batchId、baseUnit、reservedQuantity、pickedQuantity、版本及来源事件。

付款不重新分批。拣货换批必须显式提交新分配，在同事务验证FEFO、有效期及余量并交换预占；不能暗换batchNo。商品价格快照不因换批涨价。

| 事件 | onHand变化 | reserved变化 | quarantined变化 | 条件 |
|---|---:|---:|---:|---|
| 下单预占q | 0 | +q | 0 | 同时写allocation和流水 |
| 支付成功 | 0 | 0 | 0 | 资金确认，保留库存预占 |
| 未拣取消/关单q | 0 | −q | 0 | 仅释放本单仍有效预占 |
| 拣货确认实际q、原预占r | −q | −r | 0 | q>r先原子补占q−r，q<r释放余量；最终清零该次预占 |
| 实物回库待质检q | +q | 0 | +q | 独立RETURN流水，不直接可售 |
| 回库质检合格q | 0 | 0 | −q | 未过期，证据留档 |
| 在库隔离q | 0 | 0 | +q | 仅隔离非预占量，预占先重分配/取消 |
| 实物报废q | −q | 0 | −q | 先隔离、无预占，记录成本原因 |

以上为整个事务的最终净变化，不能单列更新。若q>r，内部先reserved+=q−r，再onHand−=q、reserved−=q，净reserved变化仍−r。全部变更带理由、版本、幂等键、操作者及业务单。盘点不能使onHand<reserved+quarantined，差异须处理受影响订单。最终ISSUE在API流水枚举记PICK_OUT；回库先记RETURN_QUARANTINE，合格解封记RETURN_PASS。

过期立即停止销售，但不凭时间抹零实物；后续隔离、实际处置独立记账。NORMAL允许部分隔离，整批QUARANTINED要求reserved=0、quarantined=onHand；DISPOSED要求三种数量均0。品质退款只记损失归因，不重复扣已经出库库存。

## BR-04 配送时段和名额

默认09–12、14–17、18–21，容量30。只接受当天及次日、未停用、尚未到预约截止且有余量时段。默认截止=时段开始，可配置提前截止。remaining仅展示，创建订单数据库原子验证used<capacity。

下单used+1，取消/未付关单且持有名额时used−1；支付不再增加，完成不回填历史容量。按订单唯一记录名额占用，重复关单不重复释放。容量不得调低至已有占用以下，既有订单时段起止不可原地改写。v0.1不提供自助改约；旧稿“免费改约一次”不适用，未来改约须有容量迁移事务。

## BR-05 报价、临期价与券

服务端从SKU、身份、时段、活动和券计算报价。客户端只提交SKU/quantity、地址、slotId、couponId等选择，不提交可信金额。报价默认有效5分钟且不晚于预约截止，一份报价只创建一单。报价不占资源，下单重新验证库存、时段和券；价格/规则改变或资源不足返回冲突要求重新报价，不静默换价扣款。

锁定单价U=min(有效会员单价M,可用临期单价N)，无临期价取M。参考原价不参与公式。临期价须有活动配置及覆盖配送窗口的临期批次支持，不能因有已过期批次就全SKU降价。v0.1每订单行只有一个U：仅当本行需求可全部由合资格临期批次满足才按临期批次池报价，下单按该池重验；否则以会员价并按所有合资格批次FEFO分配。必须显示本行是否临期优惠，不以全部商品都临期误导用户。

新人券发放由可审计配置决定，同账号/活动唯一，不再硬编码旧稿39/59规则。每单最多一张金额券，可叠加会员/临期单价，v0.1不另加运费券。券必须属于本人、在有效期、满足合资格商品金额门槛且AVAILABLE。券门槛以商品单价优惠后、券前金额计，不含运费。临期商品计入合资格券门槛与免邮门槛，不沿用旧稿排除规则。

下单券LOCKED，首次付款入账USED；未付取消/关单释放AVAILABLE，若已过期则EXPIRED。已预占订单可在其15分钟期限内按锁定优惠付款，日历过期任务不能抢占LOCKED券。已付取消不自动返券，不影响现金退款；部分退款不退券面额现金、不重分摊或补发券。

## BR-06 金额公式与舍入

计算使用整数有理数或Decimal。非负金额ROUND_HALF_UP到整数分，逐订单行舍入，不逐克舍入。R(x)=floor(x+0.5)。

1. 按件行G_i=U_i×quantity_i。
2. 称重行预估G_i=R(U_i×E_i/priceUnitGram_i)。
3. goodsAmount=ΣG_i（正文计算量，API为price.memberGoodsAmount−price.nearExpiryDiscountAmount）。券适用行集合S；D=min(faceAmount,ΣG_i(i∈S))，无券D=0。
4. 券D按原G_i比例分摊：先d_i=floor(D×G_i/ΣG_i(i∈S))；剩余分按小数余数降序分配，同余按稳定skuId字典序升序（请求先合并重复SKU）。非适用行d_i=0。保证Σd_i=D、0≤d_i≤G_i。
5. A_i=G_i−d_i，goodsNetAmount=ΣA_i。goodsNetAmount≥9900时F=0，否则F=600。
6. payAmount=ΣA_i+F（API price.payableAmount）；ΣA_i为price.goodsPayableAmount，D为price.couponDiscountAmount，各d_i为couponAllocationAmount。保存U、E、priceUnitGram、G、d、A及规则版本；A_i对应QuoteLine.linePayableAmount/OrderItem.originalPayableAmount，后续目录价格和券期限不改成交快照。

适用金额为0时D=0、各d_i=0，禁止除零。合法应付为0由系统零额结清事件进入PAID，不调用外部支付、不造虚假渠道SUCCESS。任何金额不得负数。

API金额展示分解：referenceGoodsAmount按参考价快照逐行同法舍入；memberGoodsAmount按会员价逐行同法舍入；nearExpiryDiscountAmount=会员商品总额−ΣG_i，不能再重复抵扣会员优惠。price.payableAmount保留初始预付快照，调整后目标由各行finalPayableAmount及原运费得出；已收/已退事实分别为Order.paidAmount/refundedAmount。

### 样例一：优惠券后判断免邮

两行商品优惠后9900与1100分，合资格券面额1000，分摊900、100。净额9000+1000=10000，达到9900免邮，payAmount=10000。

单行商品9900、合资格券1000，净额8900，运费600，payAmount=9500。不能先按9900免邮再减券。

## BR-07 拣货、称重及差额

每称重行实际W是整数克且0≤W≤floor(1.10×E)。超过10%整次确认失败，不部分出库；W=0表示缺货，必须提交reasonCode=SHORTAGE；部分按件缺货同样留原因。按件实际量0至原订量，禁止擅自加件或换商品。全单实际量为0则取消整单，退所有已收现金含运费，不发空包。

最终确认前可修改草稿；确认一次性冻结全部实际量/批次。称重G'_i=R(U_i×W_i/priceUnitGram_i)，按件G'_i=U_i×actualQuantity_i。固定原券分摊，d'_i=min(d_i,G'_i)，A'_i=G'_i−d'_i。多余券份额不转其他行，也不退成现金。

finalPayAmount=ΣA'_i+F（A'_i对应OrderItem.finalPayableAmount；差额对外为WeightAdjustment.deltaAmount），F保持原值，增减重量均不重算免邮。differenceAmount=finalPayAmount−payAmount；保留逐行差额，整单净差负数退、正数补、零NONE。不同明细的退补相抵也要保留明细审计。

最终拣货确认同事务验证PICKING/version、全部实际量和批次，补足/释放预占、ISSUE扣onHand与reserved、记录流水、冻结金额、建立差额/outbox、订单READY_TO_SHIP。渠道请求在事务提交后执行。

负差原路退，未成功为REFUND_PENDING，不称已到账。v0.1发货门禁要求无未结清差额，只允许NONE/REFUNDED/SETTLED。正差建独立payment，purpose=TOP_UP，绑定差额ID及金额，不改原成功支付金额或静默扣款。

补款截止=min(差额创建+10分钟,slot.startAt)，必须>now，否则有正差的拣货确认拒绝，需减少实际量或取消。到期未补则取消未发货整单，按库存阶段回库并退全部成功收取现金；迟到补款单独原路退，不复活订单。

### 样例二：退差与运费不变

U=990分/500g，E=1000g，G=1980；原券分摊396，净额1584，F=600，payAmount=2184。实重W=960g，G'=R(1900.8)=1901，d'=396，实际净额1505，finalPayAmount=2105，退79分，不重复退款396分券。

### 样例三：补款与110%边界

上述订单W=1080g，G'=R(2138.4)=2138，净额1742，finalPayAmount=2342，补158。W=1100合法，W=1101超过估重110%而拒绝整次确认。

### 样例四：半入和券封顶

U=925分/500g，W=333g：R(616.05)=616；W=350g：R(647.5)=648。原券份额500、实际商品金额400时d'=400、净额0，不能产生负100或把多余券份额退现金。

## BR-08 取消、关单与退款预算

本人可取消未付订单；PAID/PICKING/READY_TO_SHIP在SHIP之前可取消，订单即CANCELED并异步退款。事务释放有效预占及名额、停止后续出库、安排退款/回库。READY_TO_SHIP已ISSUE，只建回库任务；实物实际收到后增加onHand和quarantined，质检合格未过期才减少quarantined恢复可售。去向不明或损坏商品不能自动回库存。

截止PENDING_PAY→CLOSED并释放预占、券、名额。不能靠取消定时器保证安全，超时消费者必须重查状态/版本；PAID不允许被关单。DELIVERING普通取消409，只能客服异常处理；FINISHED走售后。

每refund绑定原成功payment及唯一业务来源，successfulRefunds+reservedRefundBudget≤capturedAmount。创建PENDING即预留额度，PROCESSING及FAILED待处理期间继续占额度；SUCCESS把预留变为已退。人工售后在SERVICE批准事务中创建PENDING并预留预算，不投递付款outbox；FINANCE以不同于审核人的身份执行时，授权既有退款、改PROCESSING并写outbox，不重复建单或预留。worker发送或重试人工退款必须校验有效财务执行授权，不得扫描PENDING绕过财务直接付款。自动退差、晚付等使用受限系统授权。未知渠道结果保持PROCESSING并查询，不当作失败另发一笔。确认失败重试相同refundId/merchantRefundNo且保留额度。

整单取消目标累计退款=本订单已接纳成功收款。已成功与已预留退款都计入覆盖；称重退差已成功或处理中，取消仅退款未覆盖剩余。迟到/第二次支付不分配进订单，按独立payment全额退回。跨预付和补款资金退款须拆原路子退款，父业务等全部成功才完成。

## BR-09 支付事件与异常资金

只用沙箱。回调验签、防重放、验可信渠道事件、商户支付号、订单/差额绑定、金额、币种，保存摘要/哈希。浏览器支付成功跳转不是资金证据；主动查询须复用同一入账处理器。

订单可多次尝试支付，但预付入账最多一次。回调锁payment/order后，仅PENDING_PAY且serverNow<paymentExpiresAt接纳首次匹配预付。FAILED/CLOSED支付尝试若事后渠道确认实收，须承认payment SUCCESS，再依据订单/差额守卫接纳或唯一退款；不丢弃资金事实。两次尝试都成功，多余一笔原路退回。

有效回调在事件持久化和本地事务提交后按渠道协议确认成功；自动退款并非回调处理失败，不用业务409诱发无限重投。验签/金额失败不修改订单，写安全/对账异常；有效事件本地失败返回可重试响应。定时对账发现缺漏进入异常工单，不凭猜测改资金。

## BR-10 收货、售后与损耗

受派配送员携有效proof确认真实送达，在同一事务写deliveredAt/finishedAt并使DELIVERING→FINISHED。未送达或有未解决异常不能完成；不引入DELIVERED中间态、24小时自动确认或额外用户确认接口。7天售后从deliveredAt起算，要求FINISHED且now<deliveredAt+7天。

按订单行申请，一行最多一张APPLIED/APPROVED/REFUNDING。金额大于0且≤该行调整后现金净实付−已成功/预留售后退款；券不是现金，运费不默认摊入单行赔付。QUALITY需说明与证据，客服审核、财务执行，审批人与执行人不同。履约前缺货通过BR-07，不能假装收货后售后。

QUALITY退款不恢复可售量、不再减已ISSUE库存。损耗归因关联订单行、allocation和退款，与实物报废流水区分，避免重复计成本。收货后少发如仓内确有余货仍须独立盘点/回库，不凭退款自动加库存。LATE是投诉类型，不承诺旧稿自动赔付券；自动补偿需独立配置与验收。

## BR-11 事务、幂等和验收

下单一个MySQL事务消费报价，创建订单快照、FEFO预占、时段占用、券LOCKED、幂等结果和outbox；任一步失败全回滚。数据库权威，Redis仅缓存/加速。全局锁顺序固定为幂等记录→订单→支付/退款→优惠券→时段→按SKU/批次稳定ID；新下单使用该顺序子集，新插订单不锁不存在行，死锁有限重试仍用原幂等键。

创建订单/支付/退款/售后/称重/库存变更/发货命令带Idempotency-Key，按主体+路由+键持久化请求哈希和结果。同键同体返回原结果，同键不同体409，进行中不重复执行。version不代替幂等；回调用渠道事件及资金唯一约束双重防重。outbox同事务写，异步至少一次投递，消费者幂等，不宣称恰好一次。

必须验证：最后库存/时段并发、券争用、同键同体/异体、支付关单竞态、双成功支付、跨批FEFO、过期与配送窗口过滤、称重退差/补款/超限、补款超时、已拣取消质检回库、品质退款不回库存、越权和双人退款。此处为待执行规格；需检查状态、库存账、资金账、名额、券、outbox，不只断言HTTP200。无执行不得写QPS、成功率或通过报告。
