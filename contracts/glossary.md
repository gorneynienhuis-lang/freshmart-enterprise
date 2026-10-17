# 统一术语与枚举 v0.1

版本：0.1.0；更新：2026-10-18；状态：Codex 已定工程演示基线，可评审契约，非实现验收记录。

本版按 [BASELINE.md](BASELINE.md) 展开，取代本文件早期 Claude 草案。用户负责视觉界面确认，其余业务与工程取舍由 Codex 在授权范围内决定；本文件不保留业务“待用户拍板”项。计算见 [business-rules.md](business-rules.md)，事件与事务见 [state-models.md](state-models.md)。冲突先按 BASELINE 执行，并同步修订同版本合同；不沿用成员 A/B/C 的冲突枚举。

## 1. 术语与数据边界

| 术语 | 唯一含义 |
|---|---|
| 项目代号 | `fresh-mall`；品牌由视觉设计流程确定，本合同不新造品牌 |
| SPU | 商品款，是展示与分类载体，不直接扣库存 |
| SKU | 可购买规格；购物车、报价和订单均绑定 SKU |
| 批次 batch | SKU 在单仓中的存货批，含有效期、在库量和库存流水 |
| allocation | 订单行与批次的分配记录，一行可跨多批，保留数量、单位、状态 |
| 报价 quote | 服务端价格、优惠、运费、时段及规则版本快照，不独立占库存 |
| 订单行 order item | 下单锁定的商品、规格、单价、单位、估量和券分摊快照 |
| 支付单 payment | 一次沙箱支付尝试；原单预付和补款分开，成功资金事实不因退款改写 |
| 差额单 weight adjustment | 拣货确认产生的整单净退补差，保留逐行计算明细 |
| 退款单 refund | 绑定原成功支付及业务来源的一次逻辑退款，与履约状态独立 |
| 售后单 aftersale | 收货完成后申请；履约前缺货由拣货调整处理 |
| ISSUE 物理出库 | 最终拣货确认时减少 onHand/reserved，订单进入 READY_TO_SHIP |
| SHIP 发货交接 | 已拣商品交给配送员，订单进入 DELIVERING；普通取消以此为截止 |
| 审计 | 主体、资源、前后值、原因、时间、traceId、幂等键及关联单据 |

对外所有 `id`、关联 ID、业务编号都是字符串，前端不得转成 JS number。内部可 bigint；`spuCode/skuCode/batchNo/orderNo` 为独立业务码。旧表 `S001/SKU-001` 可保留为业务码，不等同内部主键。订单号可用 FM+日期+唯一序列，必须数据库唯一约束，不依靠显示格式保证唯一。

| 数据 | 统一约定 |
|---|---|
| 币种与金额 | CNY、整数分；金额后缀 Amount/Price；用整数或 Decimal，不用浮点累计 |
| 重量 | 整数克，estimatedGram/actualGram/priceUnitGram；默认价格分母 priceUnitGram=500；estimatedGramPerUnit为内部估量配置，非当前响应字段 |
| 库存基础单位 | PIECE 是整数销售单位，GRAM 是整数克；不能混合求“总件数” |
| 购买份数 | quantity 为正整数；称重估量=quantity×estimatedGramPerUnit，实际库存仍按克 |
| 时间 | Asia/Shanghai；传输 RFC3339；now<deadline 才有效，到点即失效 |
| 日期到期字段 | 导入成到期日下一天00:00的排他性 expiresAt；精确时间不截断 |
| API 前缀 | `/api/v1`、`/api/v1/admin`；所有权和操作权限同时校验 |

## 2. 角色

| 枚举 | 中文 | 权限边界 |
|---|---|---|
| GUEST | 游客 | 请求上下文身份，非持久角色；读公开目录 |
| MEMBER | 基础会员 | 注册即获得、长期有效；仅操作自己的购物资源 |
| PICKER | 仓储 | 受权入库、批次调整、拣货、称重、回库质检 |
| COURIER | 配送员 | 仅受派任务的配送与送达事件 |
| OPERATOR | 运营 | 商品、价格、活动、时段、统计，无默认库存写权及退款执行权 |
| SERVICE | 客服 | 售后审核、客服异常工单 |
| FINANCE | 财务 | 执行已审核退款与对账 |
| ADMIN | 管理员 | 账户、员工、显式角色授权及系统配置，无隐式全部业务权 |

员工与购物身份独立，可显式给员工 MEMBER。ADMIN 不绕过资金、库存、状态和审计。即使一人兼任 SERVICE/FINANCE，也不能审核并执行同笔人工售后退款；自动退差及晚付退款由受限系统主体执行并审计。

## 3. 分类与商品

| 分类码 | 名称 | 前端短名 |
|---|---|---|
| C01 | 时令蔬菜 | 蔬菜 |
| C02 | 新鲜水果 | 水果 |
| C03 | 肉禽蛋品 | 肉禽蛋 |
| C04 | 海鲜水产 | 海鲜 |
| C05 | 乳品烘焙 | 乳品烘焙 |
| C06 | 粮油调味 | 粮油 |
| C07 | 冷冻速食 | 冷冻 |
| C08 | 酒水饮料 | 饮品 |

| 字段 | 合法枚举 |
|---|---|
| storage | AMBIENT 常温、COLD 冷藏、FROZEN 冷冻、LIVE 鲜活；不再用 FRESH 表示常温 |
| priceMode | BY_PIECE 按销售单位、BY_WEIGHT 按重量 |
| baseUnit | PIECE、GRAM；同 SKU 所有批次一致 |
| AdminProduct.status | DRAFT 草稿、ON_SALE 上架、OFF_SALE 下架；上架不等于有可售量 |
| stockStatus | IN_STOCK 有货、LOW 低库存、SOLD_OUT 售罄；按时段可售量与配置阈值派生 |
| batch.lifecycle | NORMAL 正常管理、QUARANTINED 整批隔离、DISPOSED 全部处置，仅表示生命周期 |
| freshness | NORMAL 非临期、NEAR_EXPIRY 未过期且剩余≤阈值、EXPIRED 到达/超过 expiresAt，随时钟派生 |

LOCKED 不是批次状态，多订单可分别占用同批数量。NORMAL 可有部分隔离量；整批 QUARANTINED 要求 reserved=0、quarantined=onHand。已过期不等于已处置，不能凭失效抹除实物库存。

## 4. 履约与资金状态

| 实体/字段 | 合法枚举 |
|---|---|
| order.status | PENDING_PAY 待付款、PAID 待拣货、PICKING 拣货中、READY_TO_SHIP 已拣待发、DELIVERING 配送中、FINISHED 已完成、CANCELED 已取消、CLOSED 未付超时关闭 |
| payment.status | INIT 已建立、PENDING 渠道处理中、SUCCESS 渠道确认收款、FAILED 渠道确认失败、CLOSED 尝试已关闭 |
| payment.purpose | ORDER 原单预付、TOP_UP 称重补款 |
| refund.status | PENDING 待执行、PROCESSING 渠道处理中、SUCCESS 已退款、FAILED 已确认失败待处理 |
| refund.type | AFTERSALE 售后、CANCEL 取消、WEIGHT_DIFFERENCE 称重/实量退差、LATE_PAYMENT 不可接纳的晚付、DUPLICATE_PAYMENT 第二笔成功收款；reason为说明文本，细分原因保留审计 |
| aftersale.status | APPLIED 已申请、APPROVED 审核通过、REJECTED 已驳回、REFUNDING 退款中、COMPLETED 已完成、CANCELED 已撤销 |
| aftersale.type | QUALITY 品质、SHORTAGE 收货后发现少发、LATE 配送超时投诉；LATE不表示承诺自动现金赔付 |
| weightAdjustment.status | NONE 无差额、REFUND_PENDING 待退差、REFUNDED 已退差、TOP_UP_PENDING 待补款、SETTLED 已补款、CANCELED 订单取消后终止调整 |
| coupon.status | AVAILABLE 可用、LOCKED 订单预占、USED 成交核销、EXPIRED 已失效 |
| allocation内部阶段 | RESERVED 已预占、ISSUED 已拣货出库、RELEASED 未出库释放；不是当前API字段，API用reservedQuantity/pickedQuantity/returnedQuantity表达数量事实 |

订单不含 REFUNDING/REFUNDED。支付退款后仍为 SUCCESS，退款另累计。READY_TO_SHIP 仍可能待补/退差，发货需满足差额结清守卫，不能单看订单状态。

## 5. 库存和金额字段

| 字段 | 含义 |
|---|---|
| onHand | 物理在库量，包含预占和隔离；最终拣货确认 ISSUE 才减 |
| reserved | 已下单未 ISSUE 的预占，与隔离不重叠 |
| quarantined | 在库不可售的隔离量 |
| available | onHand−reserved−quarantined，必须非负 |
| sellable | available 再过滤上架、生命周期、失效和配送窗口得到 |
| Sku.price | 展示参考原价，不充当成交价；Sku.salePrice是目录展示价，订单以报价unitPrice为准 |
| memberPrice | 基础会员正常单价；称重附 priceUnitGram |
| unitPrice | 会员价与可用临期价取低后的锁定成交单价 |
| 商品券前金额G（计算量） | 各行商品优惠后之和，API为price.memberGoodsAmount−price.nearExpiryDiscountAmount |
| price.couponDiscountAmount | 本单实际券抵扣，不重复扣单价内的优惠 |
| freightAmount | 默认600分；优惠后商品净额满9900免邮；称重不改 |
| price.payableAmount | 初始应付；price.goodsPayableAmount+price.freightAmount |
| finalPayAmount（计算量） | ΣOrderItem.finalPayableAmount+原运费；API不另造此字段，不代表资金已结清 |
| netPaidAmount（计算量） | API Order.paidAmount−Order.refundedAmount；待退另通过refunds表示 |
| WeightAdjustment.deltaAmount | finalPayAmount−初始price.payableAmount；正文differenceAmount是同一计算量的别名 |

用户端不暴露完整仓位和库存台账，v0.1不提供批次追溯摘要字段；内部仍须保留追溯关系。API如使用其他字段名，必须显式映射语义，不能把每500g单价当元/克。

API库存流水type使用RECEIVE/RESERVE/RELEASE/PICK_OUT/RETURN_PASS/RETURN_QUARANTINE/QUARANTINE/DISPOSE/ADJUST；正文ISSUE是PICK_OUT业务事件的同义词，RETURN是回库过程泛称，不新增线上的ISSUE/RETURN枚举。

时点对照：正文deliveredAt为内部送达事实时间，本版送达即完成，API Order.finishedAt和DeliveryTask.completedAt表达同一成功事件时间；不另要求用户端deliveredAt字段。补款截止对应WeightAdjustment.expiresAt。
