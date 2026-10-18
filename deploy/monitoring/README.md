# 本机隔离监控

本目录提供真实 Prometheus 采集、低基数业务指标和告警规则。监控默认关闭；目前没有 Grafana、Alertmanager 或外部通知。合成时间序列只验证规则引擎，不能代替真实应用采集证据。

## 凭据与边界

`MetricsScrapeAuth` 只接受精确的 `GET /actuator/prometheus` 和独立 Bearer 凭据。它不创建管理员身份，不访问登录会话库，也不授予任何业务 API 权限。原有有效 ADMIN 会话仍可访问该路径；其他角色继续被拒绝。

凭据文件只能是无符号链接父路径下的普通文件、权限严格 `0600`，内容为 43–128 字符随机 base64url。启动时读入内存；轮换需同步替换凭据并重启该后端和监控。不要使用用户密码、ADMIN access token、JWT 密钥或支付沙箱密钥。运行文件、凭据、TSDB、PID、日志均在 Git 忽略的 `.runtime/monitoring` 内。

Prometheus 配置使用官方 [`authorization.credentials_file`](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)，模板中没有凭据值。Java 和 Prometheus 在同机回环网络读取同一份文件。不要公开 9090；反向代理继续屏蔽 `/actuator`。此脚本不配置公网 TLS、云平台、防火墙或远程采集器。

## 可复现运行

当前锁定官方 [Prometheus 3.15.0](https://github.com/prometheus/prometheus/releases/tag/v3.15.0) 的 Darwin arm64 发行包。`prometheus.lock.json` 记录官方发布资产 SHA256；下载时同时验证官方 `sha256sums.txt` 自身摘要、其中对应资产的摘要及压缩包大小/摘要，再手动提取普通文件。保留上游 LICENSE 和 NOTICE，不作系统安装。其他平台需另行核实并新增锁文件。

```sh
python3 scripts/monitoring-runtime.py fetch
python3 scripts/monitoring-runtime.py init --target-port 18081
python3 scripts/monitoring-runtime.py check --target-port 18081
```

`init` 仅输出凭据路径，不输出内容。将它给出的规范绝对路径用于独立后端环境变量；其他应用必需的数据库/沙箱配置由现有隔离运行脚本私下提供：

```text
APP_MONITORING_ENABLED=true
APP_METRICS_TOKEN_FILE=<init 输出的 credential_file 路径>
APP_METRICS_SNAPSHOT_DELAY_MS=10000
SERVER_PORT=18081
```

确认隔离后端健康后，另行启动真实采集：

```sh
python3 scripts/monitoring-runtime.py start --target-port 18081
python3 scripts/monitoring-runtime.py targets
python3 scripts/monitoring-runtime.py query --expression 'up{job="freshmall"}'
python3 scripts/monitoring-runtime.py query --expression 'freshmall_outbox_events'
python3 scripts/monitoring-runtime.py alerts
python3 scripts/monitoring-runtime.py status
python3 scripts/monitoring-runtime.py stop
```

需要保存实际 API 与原生界面截图时，在已经运行的本机隔离目标上执行 `node deploy/monitoring/capture_ui.mjs baseline`。它仅访问 9090，校验 Prometheus 版本和目标 18081，保存真实 targets/alerts/gauges/up 历史及三张截图至 `docs/evidence/monitoring-v030`；不读取采集凭据、不访问业务接口、不更改数据库。前端 Playwright/本机 Chrome 需已按项目环境安装。同名重试会保留此前证据到 `attempts`。

界面仅监听 `http://127.0.0.1:9090`，可在 Query/Graph、Targets、Alerts 页面查看实际采集。脚本拒绝将主服务 8080/5173、数据库 3306 或监控自身 9090 作为目标；已有其他进程占用 9090 时拒绝启动。停止前核对 PID、启动时间、完整命令摘要和可执行文件路径；不停止其他服务，不按端口批量杀进程。数据保留一天且上限 256MB，查询有并发、时长和样本限额。

## 业务指标

指标通过独立单线程每 10 秒执行三个只读聚合查询，结果原子替换为内存快照；HTTP scrape 不执行这些 SQL，也不占用业务定时任务线程。查询设超时。失败时保留上次快照和成功时间，成功标志置零，失败计数增加，日志只记异常类型。

| Prometheus 指标 | 含义 |
| --- | --- |
| `freshmall_outbox_events{state="PENDING/PROCESSING/DEAD"}` | 退款 outbox 各固定状态数量 |
| `freshmall_outbox_processing_overdue` | PROCESSING 且租约已到期/缺失的数量 |
| `freshmall_outbox_oldest_pending_age_seconds` | PENDING/PROCESSING 最早 `created_at` 到当前时间；DEAD 单独统计，重试不重置年龄 |
| `freshmall_refund_failed` | FAILED 退款数，保留财务恢复入口 |
| `freshmall_inventory_negative_stock_batches` | 任一库存组成量为负的批次数 |
| `freshmall_inventory_invariant_violations` | 库存组成、隔离/报损生命周期守恒违规的批次数 |
| `freshmall_business_snapshot_collection_success` | 上次集合采集是否成功，未采集时为零 |
| `freshmall_business_snapshot_last_success_timestamp_seconds` | 上次成功快照的 Unix 时间，未成功时为零 |
| `freshmall_business_snapshot_collections_total{result="success/failure"}` | 本进程采集成功/失败次数 |

自定义指标仅有 `state`、`result` 两种固定标签；没有用户、订单、商品、媒体、手机号、原始 URI、trace、SQL 参数或金额。遵循 [Prometheus 指标命名和低基数原则](https://prometheus.io/docs/practices/naming/)。通用 JVM/HTTP 指标沿用 Spring Boot 自动采集，分位耗时不能在未启用相应直方图时宣称可用。

## 告警与证据范围

`alerts.yml` 使用 5 秒评估周期，面向课堂隔离演示：采集失败持续 15 秒触发、业务快照缺失/失败/陈旧、outbox DEAD/租约超期/长时间积压、退款失败和库存守恒问题。生产阈值应按实际运行目标调整。库存告警是防御性观测，数据库约束正常会先拒绝错误写入，不需要破坏真实数据来演示。

`check` 调用真实官方 `promtool check config`、`check rules`、[`test rules`](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/)。规则测试覆盖正常、pending、firing、恢复以及业务快照缺失/失败/陈旧；输出明确标注为合成规则测试。真实应用验收必须另外保存 targets/query/alerts 结果，并只停止/恢复自己创建的隔离后端，证实 `up` 告警触发和恢复。不得把规则 fixture 或单张截图当作真实业务异常证据。

Prometheus 内部告警状态可观察 pending→firing→inactive；没有配置 Alertmanager，不能声称已发送通知。权限拒绝测试可能写入应用审计记录，因此只在独立验收库运行。
