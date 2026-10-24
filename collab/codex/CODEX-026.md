# CODEX-026 · 恢复录制命令默认路径

2026-10-24。用户运行 `python3 docs/recording/recording-assistant.py permissions` 报文件不存在。根因是上一轮UI分支从尚未包含录制指南的main创建，切换工作区时遗漏了录制目录。非用户命令或Python版本错误。

已从docs/defense-recording-guide逐字恢复recording-assistant.py与start-rehearsal.py；SHA-256见docs/evidence/recording-helper-repair-20261024/restored-files.json。独立只读核查确认默认parents[2]准确指向项目根目录，所需demo-runtime.py已存在，无其他录制文件依赖。保留指南文件仍在原分支与本机离线指南目录，不覆盖或重写它们。

实际执行用户原permissions命令一次通过：17个HTTP响应（含登录/退出），可见匿名401、四个跨角色403及PASS；脚本创建的四个会话均已退出。没有订单、库存或密码变更，未运行其他录制场景/全量测试。输出不含凭据，采用范围见permissions-result.json。start-rehearsal只恢复并语法核查，没有重新启动服务。

核对发现用户已经合并PR #10；本次分支fix/restore-recording-helper从新main=4e94d24创建，保持最新界面。Git上传与PR状态按实际远端结果核对，不把本地文件恢复冒称已合并main。
