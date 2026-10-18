# 监控验收证据

本目录保存的静态与规则验证：

- `official-artifact.json`：真实下载的官方 Prometheus 3.15.0 Darwin arm64 归档、官方 SHA256 清单和本机二进制摘要。
- `promtool-rule-tests.json`：真实官方 promtool 的配置检查、八条告警规则检查、合成时间序列触发/恢复单元测试；全部返回 0。
- `static-verification.json`：运行脚本四项安全测试（凭据权限与符号链接、配置不含凭据、目标与下载边界、PID 重用不误停）的结果与源码摘要。
- `observability-java-tests.json`：监控模块四类、九项实际 Java 测试，来自主代理管理的最终 192 项全量通过构建；中间构建的其它缓存测试失败另存 `observability-java-tests-intermediate.json`，没有隐藏。

真实应用验收独立于上述合成规则测试，目标仅为主代理建立的隔离 MySQL 验收库及 `127.0.0.1:18081` 后端，Prometheus 为本机回环 `9090`。没有访问主商城 8080、前端 5173 或主库业务 API，没有停止主 MySQL。

| 证据 | 实际观察 |
| --- | --- |
| `actual-auth-and-exposition.json` | 七项真实 HTTP 权限检查通过：独立 scrape 凭据只可 GET metrics；员工、me、info、POST metrics 和匿名 metrics 均 401，匿名 health 为 200。实际十二条自定义样本仅含 state/result 标签，无凭据回显。拒绝审计仅写入隔离库。 |
| `baseline-live.json` 与 `baseline-*.png` | 真实 target UP、up=1，快照采集成功；退款测试预备的四笔 PENDING 被如实采到，DEAD/FAILED 为零，八规则 INACTIVE。 |
| `backend-down-live.json` 与 `backend-down-*.png` | 主代理用自己的 PID 归属助手仅停止隔离 Java 后，真实 target DOWN、up=0、FreshMallApplicationDown FIRING。 |
| `backend-recovered-live.json` 与 `backend-recovered-*.png` | 主代理恢复同一 JAR、开启工作任务后，up=1，ApplicationDown 不再触发。此时真实退款拒绝产生业务告警，不能把“应用恢复”误称为“所有业务异常消失”。 |
| `business-dead-live.json` 与 `business-dead-*.png` | 退款后端测试通过真实支付/退款拒绝路径留下的一笔 DEAD/FAILED 被采到，两条业务告警 FIRING；原生历史图记录实际 DEAD 3→2→1 的受控恢复过程。没有 SQL 伪造退款/outbox 状态。 |
| `business-recovered-live.json` 与 `business-recovered-*.png` | 财务真实 UI 恢复后 DEAD=0、FAILED=0、快照成功=1，八条规则全部 INACTIVE；真实历史图保留 up 1→0→1 及 DEAD 3→2→1→0。 |

各 `*-live.json` 保存真实 Prometheus targets/alerts、瞬时查询和 up 历史。原生界面截图经真实 Chrome/Playwright 拍摄，没有响应拦截或 fixture 替换；成功批次均零页面错误、零失败请求。两个 UI 等待失败（原生页面持续刷新导致 networkidle 不满足；FIRING 时按钮无障碍名称变化）和原始证据保留在 `attempts`，最终脚本按实际 DOM 数据就绪等待。

最终结果见 `result.json`：五阶段、十七张原生截图，七项真实 HTTP 权限检查，九个模块 Java 测试和四个 Python 安全测试。九份相关 Java 源码/测试与最终通过的隔离构建逐一 SHA256 相同；对应 JAR SHA256 为 `aa267f513059bad34a0538b2fb0570af6a81ef6dba11ec7451d72e728ef4b4c5`。各阶段使用同一 JAR 和同一 Prometheus PID，测试脚本的等待修正没有改变应用。`credential-scan.json` 记录本模块可审阅文件对真实 scrape 凭据的精确字节扫描结果，零匹配；不冒称它覆盖项目所有可能的秘密。

库存违规、租约过期、业务快照失败/缺失/陈旧告警已通过真实 promtool 合成规则测试和对应 Java 测试；未在真实数据库破坏库存或停止共享 MySQL，不宣称这些实际故障都已逐一发生。

验收结束，归属助手已仅停止本轮 Prometheus PID 48890；Java、Redis、MySQL、主前端未收到本模块停止信号。私有 token/config/TSDB 均保留，token/config 仍为 0600；按复现说明重新启动即可读取保留的数据。

复现步骤见 [监控说明](../../../deploy/monitoring/README.md)。当前没有 Grafana、Alertmanager 或外部通知，不能把 Prometheus 内部告警状态称为已发通知。
