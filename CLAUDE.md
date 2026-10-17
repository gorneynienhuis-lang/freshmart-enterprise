# Claude 界面视觉协作约定

先读README、collab/codex/PRIORITIES-003.md、collab/codex/OWNERSHIP-002.md、collab/codex/UI-SCOPE-002.md、contracts/BASELINE.md、Codex最新交接和当前OpenAPI。用户最新明确：**只确认可视化界面；先集中完成程序，PPT制作与扩写全部暂停。**

你只负责`design/`、`frontend/src/ui/`、`frontend/src/styles/`、`frontend/public/brand/`：品牌、用户端和后台的视觉组件、页面样式、交互呈现与视觉修正。React + Vite + TypeScript；当前以成熟桌面商城布局为主，必要响应式适配不改变已确认风格。前端工程配置、API/类型、mock、数据绑定、状态、鉴权、业务校验、联调、构建测试及全部后端由Codex负责。`presentation/`归属仍保留给Claude，现有素材保留，但当前不新增PPT、提纲、页稿或演示包装。

先给可评审的品牌/配色/布局/关键页面方案，记录用户确认的范围、时间和原话，再依该范围实现；没有确认就标候选稿，不代替用户选风格。视觉组件通过类型化props与事件交付，不在独占视觉文件中自行实现支付、库存、权限或网络状态逻辑；所需数据和事件一次性整理交给Codex接入。

接口唯一来源`contracts/openapi.yaml`；Codex负责类型和MSW等非视觉工程，Claude使用其交付的数据形态做界面，明确区分mock/真实数据。金额分、重量克、ID字符串、订单退款分开；按钮显隐不替代后端授权。拒绝批次详情、员工权限等不必要数据进入普通顾客响应。

你只写自己的目录及`collab/claude/`、独立`collab/requests/CLAUDE-xxx.md`、独立AI记录；不写contracts/backend/database/deploy/根目录治理文件。接口变更提交申请，Codex合并后采用。收件回执写`collab/claude/ACK-xxx.md`。用户授权Codex通过当前桌面会话与你直接协调，无需用户逐次转述。

Git写操作由Codex统一执行，不在共享目录切分支、操作索引、改凭据或创建第二仓库。保持所有文件在可复现的共享目录，不仅保存于云端Design画布。收工提供视觉文件清单、实际完成的浏览器/视觉检查、未完成项和AI七要素记录；构建与集成测试由Codex主责，不重复消耗额度做无视觉排错。文档只记录必要交接和实际证据。

PPT当前暂缓，不取消课程最终交付要求；恢复后基于已完成程序制作，当前不提前扩写。历史范围“负责全部frontend、类型生成、API客户端与mock骨架、PPT视觉”已被上述独占目录和暂停安排替代（superseded），不再作为现行任务。
