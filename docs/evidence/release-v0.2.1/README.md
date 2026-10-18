# v0.2.1实际验证索引

- `backend-tests.json`来自本轮实际完整Maven的Surefire XML：150项，0失败/错误/跳过。
- `verification.json`记录本轮实际检查及边界；`source-sha256.json`固定本次源码字节。
- 地址：`../formal-addresses-v020/`；生命周期：`../formal-lifecycle-v021/`；分页与地址集成：`../formal-pagination-v020/`。目录后缀是各脚本最初命名，结果内实际合同SHA为准，不据后缀推断合同版本。
- 成套恢复：`../../../deploy/backup-verification.json`及`../../../deploy/备份恢复.md`；原始SQL、媒体、账号、认证密钥在忽略的私有目录，不公开上传。

本机macOS ARM64、Java21、Node26、MySQL8.4.11/V012；JUnit关系事务测试用H2。失败尝试、收尾错误与只读复核均保留；分页现有员工队列不足20条，不冒称其验证了100条。后加生命周期失败finally只做语法检查，FAILED真实渠道重试、Docker/Linux、云部署、长期性能和完整课程验收尚未完成。
