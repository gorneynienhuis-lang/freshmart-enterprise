# 同 JAR 部署打包探针

2026-10-18 最终结果：`PASSED`，见 `result.json` 和 `browser.json`。本次验证的前端产物为 `index-DCO5rwlT.js` / `index-MPKy8Joc.css`，完整复制文件 SHA-256 保存在结果中。

本次没有创建云资源，也没有使用 Docker。独立复制 backend（排除 target）、database/migrations 和已冻结的 frontend/dist；将前端产物放入该复制 backend 的 `src/main/resources/static`，用复制目录的 Maven Wrapper 执行 `-DskipTests package`。主项目 backend/target 未被改动。

打包 JAR SHA-256：`850eaa90c903c2a9161060d6efbc79edf34ecafddbf67087883e38c17960b7e0`。

实际检查：

- JAR 含 index.html、前端资源、showcase profile 和 V006 员工治理迁移；共 89 个静态文件。
- 13 项 HTTP 检查通过：HTML、实际 JS/CSS、3 张 generated 图片、catalog 商品图、真实 home API 和 CSRF 返回 200；未登录员工、未知 API、Prometheus 返回 401；带错误 HTTP Origin 的静态资源请求返回 403。
- CSRF Cookie 实际含 `Secure`，未保存 Cookie 或令牌明文。
- 以 showcase profile 启动独立 JAR 于 127.0.0.1:8181，使用独立随机签名密钥。仅复用本机合成演示数据库连接，没有复用任何登录会话或进行登录。
- 为避免第二进程处理现有业务，本机探针单独设置 `APP_COMMERCE_JOBS_ENABLED=false`、`SPRING_FLYWAY_ENABLED=false`。未运行迁移、下单或退款；应用的既有时段初始化为幂等 upsert，匿名 CSRF 签发会新增上下文记录。
- 本机临时自签 HTTPS 反代监听 127.0.0.1:8182，原样转发请求到 8181；允许来源为 `https://localhost:8182`。全新 Chrome 测试上下文自然发出该真实 Origin，没有伪造 Origin、拦截请求或模拟 API。
- 首页和列表实际显示 18 / 40 张商品卡，零页面异常、失败资源、最终图片缺失或文档横向溢出；保留全页与首屏截图。浏览器实际 TLS 1.3 信息、模块/CSS 请求 Origin 记录在 `browser.json`。列表为同文档 hash 导航，故其导航响应 TLS 字段为空，沿用首页的已建 HTTPS 连接。
- 测试结束仅停止探针 PID 33783 和本机 TLS 代理。8181/8182 已关闭，原 5173/8080/3306 仍保持监听。

验证中发现模板插值前抢先请求 `{{p.img}}` 的真实问题，修复前记录保存在 `template-request-before-fix.json`；经主代理改用惰性 template 内容完成插值后再挂载，最终上述失败请求已消失。

限制：自签证书只在此隔离 Chrome 上下文以 `ignoreHTTPSErrors:true` 测试；这不验证公共 CA 证书、公共域名、Railway 平台、Linux 容器或生产备份恢复。该探针也不验证员工登录和完整交易流程，后者使用单独业务验收证据。原始 Maven 与服务日志保存在 Git 忽略的 `.runtime` 中。

复现脚本：`probe.py` / `browser-probe.mjs` 为实际执行脚本的路径适配副本，未改变验证逻辑。需要本机 Java 21、已安装的 frontend Playwright/Chrome、初始化后的 `.runtime/demo.env` 与演示 MySQL；在仓库根目录执行 `python3 docs/evidence/showcase-package/probe.py`。为防止覆盖前次隔离构建，脚本拒绝已存在的 `.runtime/showcase-package-probe`，应确认该探针已停止后先将旧目录改名。测试证书和私钥始终仅保存在 `.runtime`，不提交。
