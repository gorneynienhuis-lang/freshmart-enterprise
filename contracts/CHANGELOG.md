# 契约变更

## 0.2.0 · 2026-10-18

- 补齐28条预留操作的服务端处理器和真实前端入口；新增3条用途隔离的图片内容GET，共94操作。IMPLEMENTED_DEMO是实现标记，不代表完整课程/生产验收已完成。
- 图片上传实际解码PNG/JPEG/WebP并重编码，原私图与评价公开副本隔离；内容路由只返回PNG/JPEG。标准JSON错误补STORAGE_UNAVAILABLE/503。
- AdminProduct.skus允许0用于无规格草稿；公开Product仍要求可用规格。Batch.producedAt允许null表示历史未记录，入库请求仍必填；V011纠正V007以收货时间替代的历史值。
- AuditLog记录事件时角色与结果；历史缺失保留空角色/UNKNOWN，不回填当前身份。
- 日对账按独立渠道凭证与内部账目产生不可变快照；课程数据量下同步完成，成功HTTP201替换旧异步202，COMPLETED不等于无差异，增加最多200条差异样本和截断标记。命令与读取处于同一REPEATABLE_READ事务，不自动修账。
- 页码上限2147483647，对齐现有int分页接口；库存调整必须非零整数，禁止浮点金额/数量静默强转。


## 0.1.2 · 2026-10-18

- 员工分页/创建、固定角色目录、角色变更、账号启停五操作从CONTRACT_ONLY改为IMPLEMENTED_DEMO。请求/响应结构和业务角色不变；临时密码首次改密、撤销旧会话、持久管理互斥锁与version校验均由后端执行。
- 新增独立showcase课程HTTPS沙箱环境；保持prod/production禁用沙箱、要求精确HTTPS Origin与Secure Cookie，不改为真实支付。
- 修正dashboard读取businessDate参数与既定合同一致。合约示例、操作清单和生成类型同步版本；完整运行证据另见本轮交接。

## 0.1.1 · 2026-10-18

- 修正文本文档与已发布API冲突：quantity始终以baseUnit计，PIECE=件，GRAM=估重克数。移除“份数×每份克数”的二次换算说明；不更改既有请求结构或服务器计价单位。
- Dashboard的pendingPickCount、nearExpiryBatchCount、lowStockSkuCount允许null，仅用于FINANCE投影的未授权字段；前端不能当作0。MaskedContact.region对财务投影省略，其他履约读仍返回脱敏地区。
- 增加受控本机demo沙箱环境，与dev/test同样禁止真实收费；prod/production即使误配enabled也拒绝启用。
- 记录58个代码路由为IMPLEMENTED_DEMO，33项仍CONTRACT_ONLY；明确QUALITY售后/私有证据及评价持久化未完成。这是实现边界，运行验收另附证据。
- 机器合同、操作清单、示例版本、前端生成类型同步更新；错误码仍以原契约为准（SLOT_UNAVAILABLE=422/1202，PAYMENT_MISMATCH=422/1302）。
