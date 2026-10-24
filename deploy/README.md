# 本机 Demo 运行

> 2026-10-24交付入口：当前源码含V001–V013迁移；课程展示网址为 <https://freshmart-enterprise-production.up.railway.app/>，部署状态与验证范围以[项目README](../README.md)为准。下文按日期保留最初本机部署与后续演练记录，其中“尚未上线/尚未验收”描述的是当时状态。新环境按本文初始化；现有公网项目不要重新创建、清库或重复导入种子。

2026-10-18增量：新增独立`showcase`课程HTTPS环境与Railway/Compose部署包，默认用户选定R03。公网方案、变量、独立账号初始化及待验收边界见[公网部署](公网部署.md)，离线检查见[验证记录](验证记录.md)。这些文件不代表已上线；下文仍为已实测的本机运行方式。最新后端会执行V006员工治理迁移，保留已有数据。登录与管理入口见[使用说明](../docs/登录与后台使用.md)。

目标是课程项目的真实 MySQL + Spring Boot + React/Vite 联调。支付只走沙箱；不涉及真实收费。当前便携安装脚本支持 **macOS ARM64、Java 21、Node.js 26、Python 3.11+**。MySQL 固定 **8.4.11**，来自 [MySQL 官方下载页](https://dev.mysql.com/downloads/mysql/?version=8.4.11) 与官方 CDN，下载包 SHA-256 固定在脚本中。Linux/Windows/容器部署尚未验证，不把本机 Demo 当成完整生产部署。

在项目根目录运行：

```sh
./scripts/demo-start.sh
./scripts/demo-status.sh
./scripts/demo-credentials.sh
```

打开 `http://localhost:5173`。后端为 `http://127.0.0.1:8080`，健康检查为 `/actuator/health`。首次启动需要下载官方 MySQL 压缩包（约 160 MB）和本地尚未缓存的构建依赖。Maven Wrapper 固定 3.9.16；启动脚本的打包为了启动速度跳过测试，**启动成功不能替代测试通过**，完整验证由 `backend/./mvnw test` 和前端检查另行执行并保存证据。

启动脚本依次准备隔离 MySQL、打包并启动后端（Flyway 执行迁移）、向空演示数据库导入种子、导入现有设计素材并启动前端。任何阶段失败都保留数据库和日志，不自动清空重试。页面视觉仍须用户确认；这份说明不构成视觉确认。

已有最新 JAR 时可执行 `./scripts/demo-start.sh --no-build`；`--database-only` 只启动数据库，`--backend-only` 启动数据库、后端并导入种子。如已有自身后端进程，脚本复用该进程，不热替换旧 JAR；代码变更后先停止，再启动。不要用旧 JAR 的运行结果验收新迁移。

```sh
./scripts/demo-stop.sh
./scripts/demo-start.sh
```

停止只发送 SIGTERM 给本脚本记录且 PID、进程开始时间、完整命令均匹配的进程；不按端口杀进程、不强制 kill、不清空数据。端口被别的软件占用时直接报错。MySQL、后端、Vite 全部绑定 `127.0.0.1`；MySQL X 协议关闭，不开放局域网或公网监听。

## 数据与私有配置

- `.runtime/demo.env`：随机生成的数据库密码、JWT 密钥、沙箱签名密钥和演示登录密码。仅首次生成，重启保留，权限 0600。不要提交或分享。
- `.runtime/demo-accounts.txt`：合成的 MEMBER / PICKER / COURIER / SERVICE / FINANCE / OPERATOR / ADMIN 账号及演示密码，可用 `demo-credentials.sh` 查看。电话依次为 `13800000001` 至 `13800000007`，仅用作课程合成登录标识，系统不发送短信或联系号码。
- `.runtime/mysql-data/`：真实 MySQL 数据目录；`.runtime/mysql-8.4.11-macos15-arm64/`：项目自带便携程序。不会修改系统 MySQL、Homebrew 服务或全局 Java。
- `.runtime/mysql.log`、`backend.log`、`frontend.log`、`backend-build.log`：故障排查。禁止把可能含用户数据的完整运行日志公开上传。
- `.runtime/demo-processes.json`：当前脚本管理的进程身份，用来避免误关其他任务。

初始化时，无密码 MySQL 只开放项目私有 Unix socket；设置 root 与应用密码后才启动回环 TCP。应用账号只获 `fresh_mall_demo.*` 权限，root 凭据仅供本机初始化，不注入后端。

种子使用现有 `generate-demo-seed.py` 的 PBKDF2-SHA256 / 600000 次算法，与后端 PasswordHasher 一致。封装脚本将生成器原有的合成电话映射为上面的 Demo 账号。初始包括 7 角色、40 商品、45 SKU、136 批次；过期/隔离批次用于检验库存规则。`V003` 存在时显式启用 Demo 新人券活动，并只为演示会员插入一次新人券；时段由后端调度维护。

`./scripts/demo-seed.sh` 可以重复执行，但不会重置账号密码、订单、库存或已使用的券。若数据库已有人为数据且没有该脚本的种子标记，将拒绝导入。库存有效期会自然经过；不自动滚动批次日期或重置已发生业务，避免把重置当作修复。

## 排查与复现边界

1. `./scripts/demo-status.sh` 检查管理的进程与 HTTP health；`UP` 仅表示服务/数据库健康，不代表业务闭环验收。
2. 数据库连接或 SQL 报错查看 `.runtime/mysql-client-error.log`，后端错误查看 `.runtime/backend.log`。不要在命令行参数里传密码。
3. 如果操作系统沙箱不允许本机监听，需要在允许本机服务的终端运行启动脚本；无需扩大对外网络访问。
4. 当前实测记录放在 `docs/evidence/demo-runtime/`。文档、计划或脚本存在不代表已经启动或通过；以保存的版本与实测输出为准。

## 2026-10-18 本机实测

本轮实际启动 MySQL 8.4.11、后端与前端，Flyway V001–V005 全部成功。数据库包含 31 条真实外键，所有业务表使用 InnoDB；从 MySQL `performance_schema` 查到的 3 条 Hikari 连接均为 READ-COMMITTED。版本、种子数量与运行 JAR 的 SHA-256 见 [runtime-live-ready.json](../docs/evidence/demo-runtime/runtime-live-ready.json)。

首次连接真实 MySQL 暴露了 `TIMESTAMP(6)` 默认值的精度兼容问题；V001 已改为 `CURRENT_TIMESTAMP(6)`。建表前也将 V004 的列内 `REFERENCES` 改为 MySQL 实际执行的表级外键，并让回调事件读取采用当前锁定读，配合 READ-COMMITTED 避免重复回调的旧快照。修复重新打包后才完成此次验收。

唯一一次重建仅针对本脚本刚创建、从未导入种子的 `fresh_mall_demo`：先保存 [失败记录](../docs/evidence/demo-runtime/mysql-first-start-failure.json) 和无数据结构，逐表确认 5 张业务表全为 0 行、种子标记不存在，经明确确认后才重建。其他库未改动。启动脚本没有自动删库或迁移失败后重置功能；已有订单、种子或任何用户数据时不得套用这次空库处理。

[真实 MySQL 并发结果](../docs/evidence/demo-runtime/probe-73df193503bc-results.json) 已通过三个场景：

- 6 位会员使用不同配送时段抢最后 1 件库存，仅 1 单成功；取消后库存预占释放。
- 6 位会员抢最后 1 个配送名额，仅 1 单成功；取消后名额释放。
- 6 次相同幂等请求只创建 1 单；越权、未登录、会员操作拣货、客户端篡改金额、无签名回调与错额回调均被拦截。6 次相同支付回调仅入账 700 分一次，取消后仅退款 700 分一次。

以上是有限并发正确性验证，不能当作吞吐量或压力测试结论。测试使用隔离的合成账号、商品和时段；订单已取消、商品已下架、时段已转为历史，保留真实审计。正常演示账号和商品库存没有被测试脚本重置。可在本机 Demo 中用 `python3 docs/evidence/demo-runtime/commerce-probe.py --confirm-demo` 重现；每次都会产生独立的合成审计数据。

后续浏览器响应契约校验发现探针历史订单的图片使用相对路径，不满足 `uri` 格式。已将该轮合成夹具及关联快照的图片改为实测可达的绝对 URI，并修复探针生成器。逐表比对确认其他字段（含金额、状态、版本与时间）未变，原并发结果未修改，见 [素材字段修正记录](../docs/evidence/demo-runtime/probe-fixture-image-correction.json)。

12:01 再次执行 `demo-status.sh`，三项服务仍在运行且后端健康 UP，未重启任何服务。[安全核查](../docs/evidence/demo-runtime/runtime-final-safety-check.json) 确认 `.runtime` 无已跟踪文件、私有配置均被 Git 忽略且权限为 0600，状态输出和公开运行证据不含生成的密码或密钥。只有显式执行 `demo-credentials.sh` 才会显示本机合成登录密码，不应将该输出纳入公开日志。

以上是最初Demo启动脚本的历史验证。2026-10-18后续v0.3已经另行实际完成数据库+媒体独立恢复、Redis分类缓存与停机降级、Prometheus采集和真实宕机/退款告警恢复；不是仅凭启动脚本作出的声明，完整证据见[CODEX-018](../collab/codex/CODEX-018.md)。主本机Demo已升级到V013，缓存与监控默认关闭且不影响基础运行。容器/Linux、正式持续压力测试和公网HTTPS仍未验收；PPT、正式演示视频制作继续暂停。
