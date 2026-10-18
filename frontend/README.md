# 前端 Demo

React + Vite + TypeScript，调用真实 `/api/v1`；不启用 mock。在仓库根目录运行 `./scripts/demo-start.sh` 同时启动 MySQL、后端和前端，然后访问 http://127.0.0.1:5173。演示账号由 `./scripts/demo-credentials.sh` 在本机显示，密码不写入源码。

单独开发：`npm ci && npm run dev`，要求后端 8080 已启动。`/api`、`/catalog`、`/static` 由 Vite 代理到后端；跨站 Cookie / CSRF Origin 保留浏览器来源。`npm run build` 生成静态生产包，部署时仍需要反向代理这些路径；`vite preview` 本身不配置后端代理。

## 可操作路径

- 首页 / 搜索 / 分类 / 商品详情 → 登录或注册 → 加入购物车（按件或估重克数）。
- 购物车增改删 → 新增或选择地址 → 当天/次日配送时段 → 选券 → 服务端报价 → 创建订单 → 沙箱成功/失败支付。
- 我的订单查看真实履约/称重差额/退款状态、取消、支付/补款；配送后展示本人签收码。
- 工作台依据账户权限开放：运营只读订单，拣货员领取及逐批次输入实际数量，拣货员交接发货与配送员签收码完成。角色切换通过登录窗口进行，服务端独立校验权限。
- 已完成订单可申请缺货/延迟售后；客服领取与审核、另一财务执行原路退款。品质证据媒体上传未开放，页面不伪装已支持。

## 设计复用与边界

R04整站候选由用户明确授权Codex制作：`design/r04/`保存六页模板、公共header/footer/product-card片段和自然摄影素材；`src/styles/r04-foundation.css`与`runtime-r04.css`统一商城及原生业务视图。`npm run import:design`同时生成R03/R04两个设计包，默认R04；`?ui=r03`选R03，切换保留hash业务路由。`design/v2/`及旧设计包保留，与GitHub归档基线一致。

`npm run test:ui`使用独立Chrome只读检查新旧页面、两种桌面宽度、分类排序和SKU，无mock或业务写入；为完整截图将懒加载图片临时改为eager。`E2E_OUTPUT_DIR=docs/evidence/ui-demo-r04/business npm run test:e2e`运行真实五角色链路，创建合成会员/订单并使用本地沙箱，输出路径相对于仓库根目录。最终R04结果为163个实际响应通过schema检查、0页面异常/缺图，详见CODEX-014。

`npm run gallery`根据已保存截图生成本地历史对比页，访问`/generated/design-gallery/index.html`。R01/R02为历史截图；R03可实际操作；结算截图与登录后实际结算页面分开标注。

以下说明保留原设计导入历史，当前R04不再受『Codex不改design』的旧范围限制，用户视觉确认仍有效。

`npm run import:design` 只读 `design/v2/V2-*.dc.html`，把 Claude 原布局、CSS、素材复制到 `src/generated/design.json` 与 `public/generated/`。旧 `/_blob` 图片通过已提交的 `scripts/design-assets.json` 映射到已有本地文件，不依赖临时审计输出。`design/`、`src/ui/`、`src/styles/`、`public/brand/` 未被改写。

构建时读取原型默认视觉值；原型脚本不进入浏览器。运行时 `src/app/` 接管商品、库存、价格、地址、时段、券、订单和行为，不执行原型演示计价。模板运行器通过 DOM 文本/属性绑定服务端值，不将响应拼进 HTML。

Home / List / Detail / Checkout 采用现有候选稿。登录、购物车编辑、订单、拣货和配送面板暂用原生表单及已有页面片段，是可验证业务的工程呈现，未代替用户视觉确认。后台假监控与原型统计数不用于真实 Demo。

## 会话与未知结果

访问令牌只存内存；刷新令牌使用 HttpOnly Cookie。启动恢复与并发 401 GET 使用已有单飞刷新器。写请求不会自动重放；显式重试保留同一主体/路由/请求的幂等键，已确认完成后才允许新意图。sessionStorage 仅记录请求 SHA-256 与随机键，不含令牌、地址或请求体。

`npm run verify` 检查 API 类型、TypeScript 与单元测试；`npm run build` 验证设计导入和生产构建。单元测试通过不代表真实浏览器或后端集成已通过；集成证据由仓库 `docs/evidence` 单独记录。

`npm run test:e2e` 默认使用本机 Chrome 的独立无头进程（不读用户浏览器会话）；其他环境可安装 Playwright Chromium 后设置 `E2E_BROWSER_CHANNEL=chromium`。测试执行真实五角色闭环，会创建合成会员与订单并实际运行本地沙箱支付/退款。要求后端与本地demo账号已就绪，结果与截图在 `frontend/test-results/demo/`（被Git忽略）。2026-10-18 本机真实 MySQL Demo 实测已通过：注册/真实商品搜索、购物车与服务端报价、失败支付重试、刷新后会话恢复、拣货实重退差、交接配送与签收、客服审核和另一财务退款；175 个实际 HTTP 响应通过契约校验，无浏览器异常或素材 404。此记录仅对应本轮环境与路径，不能代替其他平台或未覆盖功能的测试。

视觉复核：1440 页面和独立 1024 首页未见横向溢出或缺图。1024 下原稿的商品 5+1 排列与服务牌 3+1 留白保留，登录/订单/工作台仍需用户视觉确认。
