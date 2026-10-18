# 真实 Redis 分类缓存验证

本目录是 2026-10-18 本机独立工程实例的实测证据。测试使用 MySQL 恢复库、Redis 8.2.10 和真实 Java HTTP 服务，不使用内存替代 Redis。分类缓存之外的商品、库存、报价与交易继续读取数据库。

- `summary.json`：实际运行结果、各阶段断言、耗时和原始私有记录摘要。
- `http-observations.json`：28 次实际 HTTP 观察；分类和健康保留公开 JSON，metrics 保留状态/耗时/原文摘要，不含认证请求头。
- `cache-metric-stages.json` / `actual-metric-samples.json`：各阶段真实计数，及原抓取中公开分类缓存的计数原行。
- `source-sha256.json`：经过完整 192 项后端测试的构建快照、JAR、Java 源码与运行脚本摘要。脚本摘要注明执行后采集时间，不伪造先前记录。
- `attempts.json`：真实失败的下载403、Unicode目录配置首启失败和 Mockito 测试配置失败；保留原私有日志/报告摘要及修复说明。
- `runtime-start-summary.json`：隔离18081启动、V012→V013、首次105个导入会话撤销，以及 jobs=false 下18条 outbox 原列摘要一致。它是当时状态记录，后续停起由主代理管理。

私有 SQL、环境、ACL、完整日志和原恢复报告继续留在 Git 忽略目录；公开证据已对实际密钥/密码/抓取令牌进行本地精确值扫描。未公开原 Redis namespace，仅公开键的再次摘要。没有执行 Linux、Docker 或云验证，也不从本次分类命中推算整站命中率、吞吐或公网延迟。
