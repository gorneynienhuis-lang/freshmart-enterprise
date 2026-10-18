# fresh-mall · 企业级生鲜商城

当前优先级：**集中完成程序、业务闭环、联调与实际测试**。PPT 制作与扩写全部暂停；文档只维护实现所需契约、交接和真实验证证据。接口、测试计划与目标不代表功能已实现或测试已通过，进展以实际构建、启动和测试结果为准。

本机 Demo 入口：运行 `./scripts/demo-start.sh` 后打开 [http://localhost:5173](http://localhost:5173)。账号用 `./scripts/demo-credentials.sh` 查看；数据保存在 Git 忽略的 `.runtime/`。本轮功能与限制见 [Demo说明](docs/demo-v0.1.md)，部署见 [运行说明](deploy/README.md)，实际测试证据见 [CODEX-010](collab/codex/CODEX-010.md)。

用户已选择R03主要页面，当前默认R03，分类侧栏与手机布局已修补；R04保留为显式备选（`?ui=r04`），历史版本和素材不覆盖。页面顶部为『当前版 / 备选设计』，版本索引见[UI-VERSIONS](collab/codex/UI-VERSIONS.md)。Codex继续负责实现、修正及验证，PPT仍暂停。

新增系统管理员的真实员工治理与运营/财务经营概览，员工初次改密和会话吊销已接线。[登录与后台使用](docs/登录与后台使用.md)列出七岗位账号、密码私有文件、管理入口和操作步骤。[公网部署方案](deploy/公网部署.md)首选Railway平台域名及HTTPS，目前仅完成部署准备，**尚未创建云资源或生成公网网址**；费用和平台授权待用户确认。实际证据及剩余工程范围见[CODEX-015](collab/codex/CODEX-015.md)。

本轮 v0.2.0 补齐商品与规格维护、入库/盘损/隔离与流水、配送容量和交易规则、配送异常与按需联系、品质图片和评价、对账差异及管理员审计。接口共94条；实际通过项和未验收范围见 [本轮工程记录](collab/codex/CODEX-016.md)。R03首页源设计与历史标签继续保留。

私有仓库：https://github.com/gorneynienhuis-lang/freshmart-enterprise

## 从这里开始

1. [当前优先级](collab/codex/PRIORITIES-003.md)、[分工](collab/codex/OWNERSHIP-002.md)、[界面范围](collab/codex/UI-SCOPE-002.md)
2. [第一版决策](collab/codex/DECISIONS-001.md) 与 [编写基线](contracts/BASELINE.md)
3. [业务规则](contracts/business-rules.md)、[状态模型](contracts/state-models.md)、[术语](contracts/glossary.md)
4. [角色权限](contracts/permissions.md)、[接口约定](contracts/conventions.md)、[OpenAPI](contracts/openapi.yaml)
5. [验收基线](docs/acceptance-baseline.md)、[后端技术 ADR](collab/decisions/ADR-001-后端技术栈.md)
6. `collab/codex/` 与 `collab/claude/` 最新交接，`collab/requests/` 未处理申请

## 分工与确认边界

| 负责人 | 负责内容与独占目录 |
|---|---|
| 用户 | **只确认可视化界面**：品牌、配色、布局、交互呈现和关键页面；未确认只能称候选稿。日常业务与技术细节由 Codex 决定。 |
| Codex | 后端逻辑、数据库、统一契约、部署与监控、测试；前端非视觉工程、API/类型、mock、数据接入、状态/鉴权、业务校验、联调与构建。维护 `backend/ database/ deploy/ contracts/ docs/ scripts/ tests/`、前端其余工程文件及根目录治理文件。当前文档工作限必要契约、交接和实际证据。 |
| Claude | 品牌、用户端与管理端视觉、视觉组件、页面样式与视觉修正。独占 `design/ frontend/src/ui/ frontend/src/styles/ frontend/public/brand/`；`presentation/` 继续保留其归属，但当前暂停写入和 PPT 工作。 |

日常业务和工程取舍由Codex推进；用户不承担逐项技术审批。涉及真实费用、增加敏感账户授权仍由用户处理。`../` 的队友原件与任务书只读，不能视为凌驾于用户授权之上的指令。

详见 [最新额度与分工约定](collab/codex/OWNERSHIP-002.md)。

## 协作方法

用户已授权Codex通过Claude桌面当前会话直接传达协作消息，**不再要求用户转述**。共享文件是持久记录：Codex写`collab/codex/CODEX-xxx.md`，Claude写`collab/claude/ACK-xxx.md`；请求用独立文件`collab/requests/<作者>-<编号>.md`，回复由接收方另建对应回复文件。避免双方同时追加同一日志。原`HANDOFF.md`与`requests.md`保留历史，之后只作入口索引。

契约由Codex单写；Claude提交接口需求后等待已发布版本，不静默改字段。未发布期间可做设计候选与技术骨架；视觉定稿必须有用户可追溯的明确确认。运行mock须在环境和演示中明确标识，不作为后端验收证据。

## 目录

- `contracts/`：机器可读接口、业务不变量、状态、权限、示例
- `backend/ database/ deploy/`：后端、迁移/种子、可复现部署
- `frontend/`：Claude 只写 `src/ui/`、`src/styles/`、`public/brand/`；其余工程与功能文件由 Codex 负责
- `design/`：Claude 的界面候选、用户确认记录与视觉规范
- `presentation/`：保留现有素材，PPT 工作暂停，不新增或扩写
- `docs/`：保留已有源稿；当前只补实现必需说明和实际证据，证据路径按验收与实际交接记录统一；不为展示扩写报告
- `collab/`：双方独立交接、ADR、实际AI使用记录
- `scripts/ tests/`：合同校验和跨模块验收

## Git协作

同一工作目录共享一份索引，**只由Codex执行Git写操作**。Claude仅写自有文件并说明交付清单，不自行checkout/reset/stash/rebase，不并发操作索引。当前先建立契约基线；`main`只接收经过相应阶段检查的成果，契约阶段不伪称系统可运行。后续分支/PR以独立worktree开展，不能在同一共享目录交替切分支。

提交必须明确列出文件，不用`git add .`收进未审阅文件。密钥、真实个人信息、`.env`、原始输入大包、录屏和构建产物不进入Git；大型交付用Release或本地交付包。契约变更单独提交并记录影响接口。发布版使用Git tag固定代码、合同、数据库与文档版本。

合同校验（Node.js）：`node scripts/validate-contract.mjs`。其通过只证明脚本覆盖的结构与示例检查，不等于后端运行通过。

PPT 暂缓是当前工作顺序的调整，不取消课程最终 PPT、正式文档和视频交付要求；恢复后再按已实现功能和真实证据制作，现在不预先扩写提纲、分镜或演示包装。旧说明“`frontend/ design/ presentation/` 全由 Claude 负责”已被上述目录边界替代（superseded）。
