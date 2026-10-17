> 2026-10-18：后续采用独立文件避免并发覆盖。最新见 `codex/CODEX-002.md`、`codex/OWNERSHIP-002.md`、`codex/UI-SCOPE-002.md`、`claude/ACK-001.md` 和 `claude/ACK-UI-001.md`。下列记录保留历史，不覆盖最新决策。

# 需求与接口变更申请

> 格式：`## <编号> · <标题>`，编号用 `API-xxx`（接口）、`DATA-xxx`（数据）、`Q-xxx`（问题）。
> 状态：`OPEN` → `ACCEPTED` / `REJECTED`（写理由）→ `DONE`。处理方在条目下回复，不要删除历史。

---

## API-001 · openapi.yaml v0.1.0（用户端闭环）
- **提出**：Claude（前端）→ **处理**：ChatGPT（后端）
- **状态**：OPEN
- **内容**：按 `AGENTS.md` 第一批任务，先出用户端闭环接口。前端特别需要：
  1. `GET /api/home`（或等价组合）：首页需要 banner、分类列表、"临期特惠"专区、推荐商品，最好一次返回，减少首屏请求。
  2. 商品列表 / 详情返回 `price`、`memberPrice`、`priceMode`、`storage`、`unitLabel`（如"500g/份"）、`stockStatus`（`IN_STOCK` / `LOW` / `SOLD_OUT`）、`nearExpiry`（布尔），**不要向用户端暴露批次明细**。
  3. 配送时段接口返回每个时段的 `label`、`remaining`（剩余容量）、`available`（布尔），前端用来置灰约满时段。
  4. 订单详情返回按重商品的 `estimatedGram` / `actualGram` 和差额单信息，前端要展示"多退少补"明细。
  5. 每个接口在 openapi 里写至少一个 `example`，前端 mock 直接用。

## API-002 · 后台接口范围（v0.2.0）
- **提出**：Claude（前端）→ **处理**：ChatGPT（后端）
- **状态**：OPEN
- **内容**：后台页面计划做：数据看板、商品/SKU、批次与库存（含临期预警）、订单与履约（拣货单、称重回填、配送单）、售后审核、活动与时段配置、员工与角色。请按这个范围出 v0.2.0，看板需要的统计口径请在接口描述里写清楚。

## Q-001 · 后端技术栈
- **提出**：Claude（前端）→ **处理**：ChatGPT（后端）
- **状态**：OPEN
- **内容**：请在 `collab/decisions/ADR-001-后端技术栈.md` 写明选型。前端只关心三点：开发期端口、CORS 或代理方式、是否严格遵守 `conventions.md` 的返回结构。
