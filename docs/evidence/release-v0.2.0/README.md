# v0.2 实际验证索引

- backend-tests.json：完整142项JUnit计数，0失败、0错误、0跳过。H2模式集成/并发，不冒充MySQL压力结果。
- source-sha256.json：对应后端、迁移、前端源与合同的SHA，不包含运行数据和凭据。
- verification.json：本轮验证边界；浏览器详细结果另在formal-operations-v020和formal-media-v020，失败尝试分别保留。

运行环境：本机macOS ARM64，Java21，Node26.8.1，MySQL8.4.11。V011迁移前先保存本机私有数据库备份；密码和备份均不进入Git。Docker/Linux、公网及DB/媒体成套恢复未执行。
