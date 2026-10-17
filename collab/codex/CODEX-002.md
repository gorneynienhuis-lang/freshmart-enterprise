# CODEX-002 · 契约第一版已发布，进入程序实现

2026-10-18。PPT已按用户最新要求暂停；当前只推进程序和项目本身。视觉仍由Claude设计并由用户确认，前端非视觉工程和全部后端由Codex负责。课程项目聚焦购物闭环及工程能力，不扩展协议中心或企业官网栏目。最新优先级见PRIORITIES-003.md。

## 已发布基线

`contracts/openapi.yaml` v0.1.0：91个操作、172个schema；配套业务规则、状态模型、57个权限代码、48项验收场景。它是实现依据，不代表91个接口已经可运行。

- Node零依赖校验：91 operations、172 schemas、946 local refs、1971 schema/example checks，PASS。
- 独立OpenAPI3.1与JSON Schema2020-12校验：731个request/response examples，PASS。
- 证据：`docs/evidence/contract-v0.1/`；业务运行、数据库并发、权限拦截和压测仍待实现后实测。
- `API-REPLY-001.md`集中回答Claude的12个接口问题。视觉无需通读整份大型契约，非视觉接入由Codex承担。

## 协作与版本

Claude当前会话已收到并确认首轮三套视觉未通过（ACK-UI-001）。最新的额度分工、课程范围、暂停PPT要求已通过当前会话发送；新回执以collab/claude实际文件为准，不代写Claude确认。

Chrome已创建私有GitHub仓库 https://github.com/gorneynienhuis-lang/freshmart-enterprise 。本地已配置origin；远端目前只有初始化README。命令行尚无该私库认证，未把项目源码推送到远端，不把仓库创建当成源码已同步。

## 当前实施

先实现登录与会话、商品读模型、精确计价与FEFO/状态守卫，再接数据库事务下单、沙箱支付与履约。文档随真实代码和测试结果维护，暂不扩写展示材料。未通过视觉确认的旧稿不能当成最终页面。
