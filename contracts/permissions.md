# 权限与数据范围契约

版本：0.1.0。日期：2026-10-18。状态：可评审契约，尚未证明接口已实现或权限测试已通过。

本文件展开 [BASELINE.md](BASELINE.md) 的授权规则；旧 `glossary.md` 中管理员、退款和批次状态描述若不一致，以本轮基线为准。HTTP 路由和请求结构以同版本 `openapi.yaml` 为准。本表中的接口是契约目标，不代表已部署可调用。实现时须把每个操作关联到下面的 permission key；不得通过前端隐藏菜单代替服务端检查。

## 1. 授权判定顺序

每次请求依次检查认证、操作权限、资源所属范围、字段访问范围、业务状态、资源版本和职责分离。任一不满足均拒绝，不能因为管理员身份跳过后续检查。

1. `GUEST` 表示未认证访问，不在用户角色表中持久化。注册账户授予 `MEMBER`。
2. 员工可显式兼任 `MEMBER`。`ADMIN`、`PICKER` 等员工角色本身不授予购物权限；兼任后仍只能操作自己的购物数据。
3. 员工角色可组合，但权限并集不能绕过资源范围、字段限制或同笔交易的职责分离。例如同时拥有 `SERVICE` 和 `FINANCE` 的人，不得审核并执行同笔人工售后退款。
4. 未认证访问受保护操作返回 HTTP `401`；身份有效但无操作权限返回 `403`；具有操作权限但目标属于其他会员、其他配送员或其他工作范围时，统一返回 `404`，与资源不存在使用相同响应结构。列表查询在数据库查询阶段限定范围，不先查全量再由客户端过滤。
5. `customerId`、`reviewerId`、`operatorId`、门店范围等授权字段由服务端从身份和上下文推导。请求体传入相同名称不构成授权；未声明字段拒绝或按 OpenAPI 明确处理，禁止批量绑定实体。
6. 单店单仓仍保留 `storeId` 的服务端范围检查；客户端不能自行切换门店绕过约束。外部 ID 为不透明字符串，不能通过顺序遍历扩大访问范围。
7. 账户停用、角色修改、密码重置和令牌吊销必须使旧凭证失效。短效 access token 本身不是即时停权机制；通过账户/授权版本检查与可吊销会话实现，生效上限为 60 秒。
8. 变更同时校验 `Idempotency-Key`、请求哈希和 `version`；幂等结果读取也执行原操作授权。跨账号复用相同键不能读取他人的首次响应。
9. `User.permissions` 返回当前会话显式获授的 permission key；订单 `allowedActions` 是该请求身份、资源范围与当前状态共同计算的提示。两者用于界面呈现，不替代每次请求的服务端检查。权限撤回或状态变化后，即使前端保留旧 allowedActions，变更仍应拒绝。

## 2. 角色与边界

| 角色 | 默认职责 | 数据范围 | 默认不具有的权限 |
|---|---|---|---|
| `GUEST` | 浏览公开商品、分类，注册和登录 | 上架公开信息 | 购物、订单、客户、批次明细和后台；配送时段查询当前要求 MEMBER |
| `MEMBER` | 个人资料、地址、购物车、下单、沙箱支付、售后、评价 | `memberId = 当前用户` | 他人订单、任意定价、审批、库存调整 |
| `PICKER` | 入库、批次、库存调整、拣货、称重、出库交接 | 本店批次；可领取任务；本人已领取任务 | 商品定价、客户完整联系方式、付款/退款执行 |
| `COURIER` | 配送任务、送达与配送异常上报 | `courierId = 当前员工` 的任务 | 任意订单、其他配送员任务、退款、批次库存 |
| `OPERATOR` | 商品/SKU、上架状态、业务策略、时段、经营看板 | 本店商品与经营汇总；必要的脱敏订单概要 | 修改库存、售后审核、退款执行、员工授权 |
| `SERVICE` | 售后领取、审核、驳回；允许状态下的客服取消；关联配送异常处理 | 本店待领取售后队列及本人处理工单；其关联订单/配送任务 | 执行退款、修改库存、修改支付金额、绕过配送中取消限制 |
| `FINANCE` | 执行已审核退款、失败退款重试、资金对账 | 本店资金流水、退款和对账；必要的订单财务投影 | 售后审核、修改退款申请金额、收货地址、商品/库存修改 |
| `ADMIN` | 账户状态、员工与显式角色分配、审计查询 | 本店账户治理与审计元数据 | 所有业务角色的默认权限；任意下单、出库、退款、修改库存 |

没有角色继承到“全部权限”。系统定时关单、自动称重退差、晚付退款使用独立服务身份执行白名单任务，不复用管理员 token，也不能经普通用户接口伪造 `SYSTEM` 主体。

## 3. 公开与会员接口

路径均以 `/api/v1` 为前缀。下面按资源操作列出权限；同一资源的实际 operationId 由 `openapi.yaml` 和 `examples/operation-manifest.json` 唯一确定。

| permission key | API 操作/资源 | 允许身份 | 范围与约束 | 数据投影 |
|---|---|---|---|---|
| `catalog.read` | `GET /home`、`GET /categories`、`GET /products`、`GET /products/{productId}`、`GET /products/{productId}/reviews` | 公开 | 仅公开且允许展示的商品；SKU 信息在商品详情内，不另假定独立 SKU 查询路由 | `PUBLIC` |
| `slot.read` | `GET /delivery-slots` | `MEMBER` | 可预约日期；返回余量和是否可选，不返回订单身份 | `PUBLIC` |
| `auth.self` | `GET /auth/csrf`、`POST /auth/register`、`POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`、`GET /auth/me` | 前三项公开，其余当前会话 | 刷新使用有效 refresh cookie 认证，不要求 access token 尚有效；刷新/退出仅本会话；登录限流；cookie 变更验证 Origin/CSRF | `SELF`；不返回密钥/哈希 |
| `auth.self` | `POST /auth/password` | 所有已认证持久角色 | 仅本账号，校验当前密码和新密码；员工临时密码强制初改；变更后吊销会话并重新认证 | 不回显密码；脱敏安全审计 |
| `member.self` | `GET/POST /addresses`、`PUT/DELETE /addresses/{addressId}`、`GET /coupons` | `MEMBER` | 当前会员；地址不能用他人 ID 绑定订单；不假定未声明的个人资料编辑接口 | `SELF` |
| `cart.self` | `GET /cart`、`POST /cart/items`、`PATCH/DELETE /cart/items/{cartItemId}`、`POST /orders/quote` | `MEMBER` | 当前会员；价格与库存由后端重算 | `SELF` |
| `order.create` | `POST /orders` | `MEMBER` | 当前会员的地址/购物车/券；服务端报价与原子预占 | `SELF` |
| `order.self.read` | `GET /orders`、`GET /orders/{orderId}`、`GET /orders/{orderId}/status` | `MEMBER` | 当前会员；不暴露仓库内部批次余量或其他用户 | `SELF` |
| `order.self.cancel` | `POST /orders/{orderId}/cancel` | `MEMBER` | 未付或已付未交接配送，包含 READY_TO_SHIP；已拣货实物回库仍需质检 | `SELF` |
| `payment.self.create` | `POST /payments/prepay` | `MEMBER` | 本人订单/差额单；不能任意指定金额或币种 | `SELF_FINANCE` |
| `payment.self.read` | `GET /payments/{paymentId}`、`GET /refunds/{refundId}` | `MEMBER` | 由支付/退款单关联回本人订单，不单凭业务号授权 | `SELF_FINANCE` |
| `payment.self.simulate` | `POST /payments/{paymentId}/sandbox-simulate` | `MEMBER` | 本人沙箱支付单；仅受控沙箱环境启用，不能作为真实到账接口 | `SELF_FINANCE` |
| `aftersale.self` | `POST/GET /aftersales`、`GET /aftersales/{aftersaleId}`、`POST /aftersales/{aftersaleId}/cancel` | `MEMBER` | 已完成订单 7 天内；实付额度和行级上限；申请人必须是订单所有人 | `SELF` |
| `media.member.upload` | `POST /media/images` | `MEMBER` | multipart purpose=AFTERSALE/REVIEW、本人的 orderId 与真实图片；私有对象绑定上传人/订单/用途；不能传任意外链代替 | `MEDIA_ACCESS` |
| `media.access` | `GET /media/{mediaId}/access` | `MEMBER`、`SERVICE` | 会员仅本人媒体；客服仅 assigneeId=本人 的已领取售后关联证据，不依赖审批后才写入的 reviewerId；尚未绑定工单的图片不能被客服遍历 | `MEDIA_ACCESS`，短效 URL，no-store |
| `review.self` | `POST /reviews` | `MEMBER` | 本人已完成的订单行；禁止冒用他人订单行；个人评价列表不在当前路由清单内 | `SELF`；公开展示时另投影 |
| `payment.callback` | `POST /payments/sandbox/callback` | 有效渠道签名，非角色授权 | 验签、金额、币种、绑定关系与事件防重全部成功；不得信任前端支付成功页面 | 仅确认回执 |

公开商品接口只提供可售提示、必要有效期信息及展示价格；不提供 `onHand/reserved/quarantined`、精确库位、供货成本或完整批次列表。公开评价隐藏手机号、真实姓名、订单号、地址和支付标识。

v0.1 由配送 `complete` 完成订单为 `FINISHED`，没有独立会员确认收货接口；个人资料编辑、个人评价列表不在当前契约内，不得在前端把这些操作展示为已可用能力。售后与评价提交使用经过归属/用途校验的 `mediaIds`，不接受任意公网图片 URL。

## 4. 后台操作矩阵

路径均以 `/api/v1/admin` 为前缀。未列出的操作默认拒绝；如 OpenAPI 新增操作，必须同步本表和对应验收项，不能默认继承同模块全部权限。

| permission key | 方法与路由 | 默认角色 | 数据范围/状态条件 | 投影/审计 |
|---|---|---|---|---|
| `dashboard.read` | `GET /dashboard` | `OPERATOR`、`FINANCE` | 本店汇总；经营指标与资金指标按角色投影 | `AGGREGATE` |
| `product.read` | `GET /products`、`GET /products/{productId}` | `OPERATOR` | 本店商品 | `CATALOG_INTERNAL` |
| `product.write` | `POST /products`、`PATCH /products/{productId}` | `OPERATOR` | 商品编辑白名单，不直接改库存/历史成交快照 | 版本、前后值审计 |
| `product.status` | `PUT /products/{productId}/status` | `OPERATOR` | 服务端校验可售条件；不能使不合格批次可售 | 版本、原因审计 |
| `sku.write` | `POST /products/{productId}/skus`、`PATCH /skus/{skuId}` | `OPERATOR` | 单位/计价规则与已有订单兼容；历史价格快照不变 | 版本、前后值审计 |
| `media.product.upload` | `POST /media/images` | `OPERATOR` | 本店商品图片用途；图片类型/体积/解码校验；不得将私密售后图变成商品公开图 | 商品媒体引用、上传审计 |
| `batch.read` | `GET /batches`、`GET /batches/{batchId}` | `PICKER` | 本店批次；仅业务需要字段 | `WAREHOUSE` |
| `batch.create` | `POST /batches` | `PICKER` | 记录入库来源、单位、生产/到期、初始库存；不可负 | 幂等、库存流水 |
| `inventory.adjust` | `POST /batches/{batchId}/adjustments` | `PICKER` | 版本+理由；不得侵占已预占数量；不得伪装订单出库 | 幂等、库存流水、前后值 |
| `batch.lifecycle` | `PUT /batches/{batchId}/lifecycle` | `PICKER` | `NORMAL/QUARANTINED/DISPOSED`；回库质检证据与原因；不得直接写 freshness | 幂等、状态审计 |
| `inventory.movement.read` | `GET /inventory-movements` | `PICKER`、`FINANCE` | 本店库存流水只读；财务只读对账所需数量/金额/业务引用，不获得库位和客户信息；没有更新/删除入口 | `WAREHOUSE` 或 `FINANCE` |
| `order.work.read` | `GET /orders`、`GET /orders/{orderId}` | `OPERATOR`、`SERVICE`、`FINANCE` | 客服仅处理范围内订单；财务仅资金关联投影；运营脱敏履约概要；仓储从拣货任务取得所需信息 | 分别 `OPERATIONS/SUPPORT/FINANCE` |
| `order.service.cancel` | `POST /orders/{orderId}/cancel` | `SERVICE` | 处理原因必填并留痕；PAID/PICKING/READY_TO_SHIP 可取消，DELIVERING 不允许普通取消；本人购买订单不得以客服身份处置 | 审计；退款依基线自动流程 |
| `return.receive` | `POST /orders/{orderId}/returns/receive` | `PICKER` | 本人或显式获派的已取消回库任务；逐 allocation 记录实物验收、合格/隔离数量；累计回库不超过实际出库 | 幂等、version、质检/库存流水 |
| `pick.read` | `GET /pick-tasks`、`GET /pick-tasks/{taskId}` | `PICKER` | 可领取队列及本人已领取任务；其他员工任务返回 404 | `WAREHOUSE` |
| `pick.claim` | `POST /pick-tasks/{taskId}/claim` | `PICKER` | 未领取、已支付且允许履约；原子领取，重复领取不转移负责人 | 幂等、任务审计 |
| `pick.reallocate` | `POST /pick-tasks/{taskId}/reallocate` | `PICKER` | 本人任务；原子重新分配；满足 FEFO、到期和可用量 | 幂等、批次分配前后值 |
| `pick.confirm` | `POST /pick-tasks/{taskId}/confirm` | `PICKER` | 本人任务；实重阈值/金额计算由服务端执行；最终确认一次 | 幂等、库存流水、称重差额 |
| `delivery.handover.read` | `GET /delivery-tasks`、`GET /delivery-tasks/{taskId}` | `PICKER` | 本人完成拣货、待交接的任务；不能取得完整客户联系方式 | `WAREHOUSE` |
| `delivery.self.read` | `GET /delivery-tasks`、`GET /delivery-tasks/{taskId}` | `COURIER` | 仅本人配送任务；常规查询始终脱敏，不自动暴露完整联系方式 | `DELIVERY_MASKED` |
| `delivery.contact.access` | `POST /delivery-tasks/{taskId}/contact-access` | `COURIER` | 仅本人 DELIVERING 任务；提交 purpose、reason 与 version；ADMIN/SERVICE 无此权限 | `DELIVERY_ACTIVE`；访问审计、Cache-Control:no-store |
| `delivery.dispatch` | `POST /delivery-tasks/{taskId}/dispatch` | `PICKER` | 本人拣货已完成；指定有效配送员工；补款已结清；不允许二次交接 | 幂等、交接审计 |
| `delivery.complete` | `POST /delivery-tasks/{taskId}/complete` | `COURIER` | 本人正在配送任务；送达凭证/时间按接口必填 | 幂等、履约审计 |
| `delivery.exception` | `POST /delivery-tasks/{taskId}/exceptions` | `COURIER` | 本人配送任务；上报事实与原因，不能直接退款或篡改订单资金 | 幂等、异常工单审计 |
| `delivery.exception.resolve` | `POST /delivery-tasks/{taskId}/resolve-exception` | `SERVICE` | 本店相关客服工单范围；仅 EXCEPTION 任务，reason 与 expectedVersion 必填；恢复原 COURIER 任务为 DELIVERING，不改派、不改资金/库存、不直接确认完成 | 幂等、异常处理原因和前后状态审计 |
| `aftersale.work.read` | `GET /aftersales`、`GET /aftersales/{aftersaleId}` | `SERVICE` | 本店未领取队列及本人售后工单；自身购物售后不可进入处理范围 | `SUPPORT` |
| `aftersale.work.claim` | `POST /aftersales/{aftersaleId}/claim` | `SERVICE` | 本店未领取且 APPLIED 的售后，version 必填；CAS 写 assigneeId=本人 后才可读取关联私密照片；领取不写 reviewerId，不等于批准；不得领取本人购买订单的售后 | 幂等、领取人/时间审计；不得转移其他员工已领任务 |
| `aftersale.review` | `POST /aftersales/{aftersaleId}/approve`、`POST /aftersales/{aftersaleId}/reject` | `SERVICE` | 只允许 APPLIED 且已由本人领取的工单；先 claim、查看证据，再独立审核；不得审批自己购买的订单 | 幂等、审核金额快照、reviewerId |
| `refund.read` | `GET /refunds` | `FINANCE` | 本店已批准人工退款与系统退款进度；不含完整客户地址 | `FINANCE` |
| `refund.execute` | `POST /refunds/{refundId}/execute` | `FINANCE` | 已批准且未执行；执行人≠审核人且≠购买人；金额来自不可变审批快照 | 幂等、executedBy、资金流水 |
| `refund.retry` | `POST /refunds/{refundId}/retry` | `FINANCE` | 仅失败且先查渠道结果后确认可重试；沿用原退款业务键，不能新建第二笔退款 | 幂等、资金流水、原因 |
| `reconciliation.read` | `GET /reconciliations` | `FINANCE` | 本店沙箱渠道、订单、支付、退款对账 | `FINANCE` |
| `reconciliation.run` | `POST /reconciliations` | `FINANCE` | 有界时间窗口；只生成差异报告，不自动改账或再次退款 | 幂等、审计 |
| `employee.read` | `GET /employees` | `ADMIN` | 本店员工账号/状态/角色；账户信息脱敏 | `IDENTITY_ADMIN` |
| `employee.create` | `POST /employees` | `ADMIN` | 只建本店账户；不返回初始密码/密码哈希；邀请/初始化凭据走单独安全流程 | 身份变更审计 |
| `employee.roles` | `PUT /employees/{employeeId}/roles` | `ADMIN` | 仅预定义角色集合；禁止给自己增权/改自己的角色；保留至少一名有效 ADMIN | before/after、授权版本、会话吊销 |
| `employee.status` | `PUT /employees/{employeeId}/status` | `ADMIN` | 禁止停用最后一名有效 ADMIN；停权后旧 token 同步失效 | 原因、授权版本审计 |
| `role.read` | `GET /roles` | `ADMIN` | 只读预定义角色与权限；v0.1 无自定义任意权限入口 | `IDENTITY_ADMIN` |
| `audit.read` | `GET /audit-logs` | `ADMIN` | 本店脱敏审计；查询范围/时间有界；不得删除改写 | `AUDIT`；查询本身留痕 |
| `slot.manage` | `GET /delivery-slots`、`PUT /delivery-slots/{slotId}` | `OPERATOR` | 不能把容量调至已占用量以下；有订单的时段不能静默改约 | 版本、前后值审计 |
| `policy.manage` | `GET /policies`、`PUT /policies` | `OPERATOR` | 仅 OpenAPI 白名单业务参数，如运费/免运门槛/临期阈值；不包含认证、密钥、数据库、任意退款开关 | 版本、生效时间、前后值审计 |

`OPERATOR` 的订单读取不意味着客服、仓储或财务操作；`FINANCE` 的看板仅提供资金口径；角色组合时选择当前操作需要的投影，不把各角色全部敏感字段简单合并返回。需要跨岗处理时应由另一名具有相应权限的员工处理，不提供管理员万能 override。

## 5. 字段白名单与脱敏

必须由后端 DTO/序列化层应用；前端隐藏字段、模糊文字、CSS 遮挡不算脱敏。新增字段默认不返回，加入白名单并评审后方可暴露。

| 投影 | 可返回 | 必须隐藏或脱敏 |
|---|---|---|
| `PUBLIC` | 商品展示信息、参考价/成交展示价、可售状态、时段余量、公开评价 | 批次台账、库位、成本、客户 ID/真实姓名/手机号/地址、支付引用 |
| `SELF` | 当前用户的资料、完整地址/手机号、本人订单快照、本人售后凭证 | 他人信息、员工私人信息、内部备注、仓库库存明细 |
| `SELF_FINANCE` | 本人付款/退款状态、金额、币种、渠道名、业务支付号 | 渠道密钥、签名原串、其他人流水、完整账户号 |
| `MEDIA_ACCESS` | 已授权 mediaId、用途、类型、体积、必要尺寸、短效访问 URL 与到期时间 | 存储内部 key、长期公开 URL、他人图片、图片 EXIF 位置信息；访问响应不缓存 |
| `WAREHOUSE` | 拣货单号、商品/SKU、分配批次、货位、数量/重量、储存条件、时段、必要的包装备注 | 手机号不返回；收货地址仅区级；不返回会员画像、支付凭据和售后照片 |
| `OPERATIONS` | 脱敏订单概要、商品金额汇总、时段和履约状态 | 完整姓名/电话/地址、私密凭证、渠道账户；不返回单人画像拼接 |
| `SUPPORT` | 关联工单、订单行、已付/可退金额、原因、授权范围内售后照片、履约记录 | 姓名/电话/地址脱敏；不返回密码、支付凭据、其他工单信息；v0.1 无无理由批量解密入口 |
| `FINANCE` | 订单号、支付/退款业务号、金额/币种、渠道、审核人/执行人工作 ID、对账差异 | 姓名和手机号脱敏；收货地址不返回；渠道账户仅末四位；无售后照片和用户画像 |
| `DELIVERY_ACTIVE` | 本人正在履约任务的收货姓名、完整电话/地址、时段、配送备注 | 商品资金明细、批次、售后、其他客户；只有已交接给本人且未关闭任务可用完整联系方式 |
| `DELIVERY_MASKED` | 本人任务的配送号、时段、结果、区级地址、脱敏收件人 | 常规列表/详情不提供完整电话地址；关闭/转派后 contact-access 立即失效 |
| `IDENTITY_ADMIN` | 员工工作 ID、角色、账户状态、授权版本、脱敏联系信息 | 密码及哈希、refresh/access token、会话密钥、用户购物详情 |
| `AGGREGATE` | 按日/品类/时段汇总的数量金额与口径 | 用户级明细、联系方式；不得通过看板响应夹带原始订单 |
| `AUDIT` | traceId、主体 ID、操作、目标 ID、时间、原因、允许展示的前后值 | token/cookie/密码/密钥/完整手机号地址；请求体先按字段白名单脱敏再落日志 |

脱敏规则：大陆手机号显示前三位与后四位，中间替换 `****`；不符合此格式的号码只保留末四位。姓名保留首字符，其余以 `*` 代替。地址仅保留城市/区县，街道、楼栋、门牌替换为 `***`。渠道账号只保留末四位。空值仍为空值，不用 `0` 代替未知。

售后图片和送达凭证使用私有对象存储或等效受控下载；业务接口先校验关联资源归属再签发不超过 5 分钟的访问地址。上传的对象 key 必须绑定上传人和用途，别人上传的 URL 不能直接用于自己的申请。图片解码校验真实格式、限制数量/体积并移除 EXIF 位置等元数据；公开商品图与私密凭证分开存储和授权。上传、下载和导出均执行相同范围与脱敏策略。

## 6. 人工退款职责分离

1. `SERVICE` 审核售后申请并固化批准金额、订单行及理由，写入实际员工 `reviewerId`。批准不等于退款成功。
2. `FINANCE` 从已批准退款队列执行。服务端检查 `actorId != reviewerId` 且 `actorId != buyerId`；身份相同即 HTTP `403`，不能通过切换角色、换 token、重试或 ADMIN 身份绕过。
3. 执行接口不接受客户端重新指定金额、币种或收款账户；原路退回经验证的原支付。已批准快照若需变更，应撤销尚未执行的审批并重新审核，不能静默修改原记录。
4. 同一退款累计成功及处理中金额不得超出可退实付；资金账唯一键与渠道退款号保证多次提交/重试最多一笔资金效果。渠道未知结果先查询对账，不立即按“失败”再付一次。
5. 自动称重退差和晚付退款由服务身份依冻结规则执行，不伪造客服/财务人工审批。记录 `triggerType`、规则版本、关联支付/差额单、事件/任务 ID；仍受上限、幂等和原路退回约束。
6. 品质赔付不恢复可售库存，也不重复扣减已出库库存；审批及资金操作无法直接改批次台账。已拣取消后的实物恢复必须走仓储质检与库存流水。

## 7. 审计与验收关联

关键事件记录 `eventId/traceId/actorType/actorId/roles/permission/targetType/targetId/action/outcome/reason/before/after/occurredAt`，资金事件另记关联支付/退款业务号和规则版本。拒绝的越权、职责分离冲突、角色增权、身份停用、批次调整、重新分配、称重、发货、审核、退款执行与重试均留痕。审计数据为追加式，不开放修改/删除 API。

验收证据见 [acceptance-baseline.md](../docs/acceptance-baseline.md) 的 `AUTH-01` 至 `AUTH-08`、`SEC-01` 至 `SEC-05` 和资金/库存用例。每个受保护 operation 至少验证一组允许身份、一组错误角色、一组越权资源和一组字段投影；共享端点按每种角色分别测试。计划或 mock 通过不能替代真实后端授权测试。
