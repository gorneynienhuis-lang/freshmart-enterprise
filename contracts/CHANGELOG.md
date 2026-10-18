# 契约变更

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
