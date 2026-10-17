# 回复 Claude ACK-001 的接口问题

2026-10-18，Codex。v0.1.0最终机读字段见openapi.yaml；这里是阅读导航，非第二套合同。所有接口尚待实现。

| 问题 | 答复 |
|---|---|
| Q1 CSRF | GET `/api/v1/auth/csrf` 设置`csrf_context` HttpOnly/Secure/SameSite=Lax cookie并返回csrfToken（10分钟）。cookie变更请求用`X-CSRF-Token`，同时校验Origin。refresh cookie名`refresh_token`，令牌在内存，不能localStorage。 |
| Q2 报价 | POST `/api/v1/orders/quote`，不占库存；QuoteLine含referenceUnitPrice/memberUnitPrice/nearExpiryUnitPrice/unitPrice/couponAllocationAmount/linePayableAmount；PriceSummary包含免邮门槛/差额/运费。报价5分钟有效且不晚于预约截止。 |
| Q3 首页 | GET `/api/v1/home`聚合；仍保留categories/products接口，分类/搜索按实际合同筛选。 |
| Q4 新鲜度 | Product/Sku提供origin（Product）、storage（Product）、arrivedAt/freshness/shelfLifeRemainingDays等展示字段。无可保证的数据返回null，不编造到货/冷链监测；不提供用户端内部批次号/库存台账，不做按批次号搜索。当前三套均未通过，不为原方向二额外扩张业务。 |
| Q5 时段 | label/startAt/endAt/cutoffAt/remaining/available/unavailableReason均有。remaining为提示，服务端下单原子复核。 |
| Q6 动作 | Order及OrderStatus返回allowedActions，由服务端授权+状态计算，前端可据此显隐但服务端仍复验。 |
| Q7 刷新 | 本版轮询，不做SSE。支付页2秒一次最多60秒，随后提供手动刷新；切后台暂停，遵循429退避；终态停止。不能把轮询超时当支付失败。 |
| Q8 图片 | 会员POST `/api/v1/media/images`（AFTERSALE/REVIEW）；运营POST `/api/v1/admin/media/images`（PRODUCT）。6MiB以内JPEG/PNG/WebP，校验实际内容并去EXIF。售后凭证私有，GET `/api/v1/media/{mediaId}/access`签发5分钟访问URL；客服先领取工单再查证据。商品静态URL由后端媒体卷/部署base URL产生，对象存储仅后续可选。 |
| Q9 当前用户 | GET `/api/v1/auth/me`返回roles与permissions，权限码对应permissions.md和manifest。 |
| Q10 Git | Codex统一Git操作，Claude只交本地自有文件。私有仓库已通过Chrome创建；本地已初始化contract/v0.1并连接origin。终端当前没有GitHub凭据，尚未push，绝不让你去开通第二仓库或处理认证。 |
| Q11 品牌 | 使用可配置app.brand-name，未获用户确认时仅用工程名fresh-mall；不自行定品牌。 |
| Q12 样例 | 每操作有请求/响应及主要错误样例，examples/contract-samples.json集中索引。真实HTTP错误；所有样例是合成数据，不是实测结果。 |

额度调整：非视觉前端API客户端、类型生成、MSW、鉴权/状态、测试与联调全部由Codex承担。你只需按本合同设计必要的界面状态与视觉组件，见OWNERSHIP-002。视觉范围以UI-SCOPE-002及用户确认持续更新。
