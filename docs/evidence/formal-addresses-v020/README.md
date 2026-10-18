# 收货地址管理实测

最终实测：2026-10-18 06:34:16–06:34:18 UTC，`result.json` 为 `PASSED`。真实本机 MySQL + HTTP API + Chrome/Playwright，没有 mock、网络拦截或清库。

- 41 条实际响应通过当前 OpenAPI 响应校验：200×34、201×4、404×2、409×1；浏览器异常、失败素材、契约错误均为 0。
- 从“我的订单 → 管理收货地址”真实界面创建两个本人地址，编辑详细地址并提交当前 version，通过完整 `PUT /addresses/{addressId}` 设为默认；服务端结果始终只有一个默认地址，其他字段保持正确。
- 保持编辑表单打开，另发真实 HTTP 更新同一地址，再从旧界面保存。服务端返回 409，界面重新读取最新地址；新内容与版本没有被旧草稿覆盖。
- 另一独立注册会员尝试 `PUT`、`DELETE` 本人地址均返回 404，其本人地址列表仍为空。
- 删除须经过确认；先取消删除并读取确认数据仍在，再确认删除默认地址。剩余地址由服务端成为默认，刷新后通过 HttpOnly 会话恢复读取相同状态。最后确认删除剩余地址，界面和服务端均为空列表。
- 390px 下页面与对话框均无横向溢出。实际对话框边界 left=16、right=374、width=358，保留左右 16px。长编辑表单使用内部纵向滚动，按钮可滚动到达。
- 检查浏览器 localStorage/sessionStorage，没有明文 token、密码、手机号或详细地址。命令复用既有幂等账本，仅持久化随机键及哈希。

## 复现

启动项目本机 MySQL、8080 后端与 5173 前端后运行：

```sh
cd frontend
node scripts/e2e-addresses.mjs
```

脚本自行注册隔离合成会员，不读取或修改种子员工密码。`ADDRESS_E2E_BASE` 可改为其他本机 localhost/127.0.0.1 地址，`ADDRESS_E2E_OUTPUT` 可指定证据输出目录；禁止向公网地址执行业务写入。合成会员和审计历史保留；地址删除属于此脚本明确测试的本人操作，不清数据库、不改已有员工、订单、运营策略或配送时段。

## 文件与截图

| 文件 | 实际内容 |
|---|---|
| `member-addresses-edited-default.png` | 两个真实保存的地址、编辑结果及唯一默认标记 |
| `member-address-stale-version-blocked.png` | 旧版本 409 后重新读取的新内容与提示 |
| `member-default-after-delete-reload.png` | 删除默认地址后，刷新恢复的剩余默认地址 |
| `member-addresses-390.png` | 手机宽度列表、16px 外侧间距 |
| `member-address-edit-390.png` | 手机宽度编辑表单，内部可纵向滚动 |
| `member-addresses-empty-after-delete.png` | 最后一个地址删除后的真实空列表 |

截图中的亮紫色矩形是 Playwright 的联系方式遮挡层，不是产品界面配色。姓名、地址文本均明确使用课程合成验收内容，不用于实际配送。

## 修正记录与边界

- `attempts/2026-10-18T063227Z/` 保留首轮真实失败：textarea 的 label 包含提示文本，精确“详细地址”可访问名称定位失败；尚未创建地址。已改为 caption `aria-labelledby` 与 hint `aria-describedby`，类型检查通过。
- `attempts/2026-10-18T063334Z/` 为业务通过的第二轮。人工看图发现对话框采用 content-box，390px 含 padding 后贴到视口边缘；新增作用域内 `box-sizing:border-box`，脚本也增加 top-layer bounding rect 校验后再次完整通过。当前目录截图与 `result.json` 全部来自最终复测。
- 本次实际操作入口为订单页地址管理弹窗。专用 `#/addresses` 页面及结算页地址变更后重报价接线由主代理维护，本记录不将未单独操作的入口写成已实测。
- 契约静态检查覆盖当前 95 个声明操作；本次只运行地址、认证及打开订单页所需读取接口，不代表 95 个操作全部完成运行验收。未测试公网部署、负载、全部浏览器或全部异常分支。
