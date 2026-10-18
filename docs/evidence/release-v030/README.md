# v0.3工程验收索引

本目录只汇总2026-10-18实际运行记录，不代替每个模块的原始结果。完整范围与限制见[CODEX-018](../../../collab/codex/CODEX-018.md)。

本轮工程提交`e52b52edb771430334d0c8170e1c7d45b4d281ea`与标签`demo/v0.3.0-engineering`已真实推送并核验远端，见[GitHub记录](github-push.json)。后续分支可以继续前进，该标签保留本轮代码；不是覆盖旧版本或倒填历史。

- [已测构建及覆盖率](../coverage-v030/backend-summary.json)：192项通过，完整205输入SHA留存；[前端44项Node覆盖率](../coverage-v030/frontend-unit-summary.json)为10.61%，与浏览器E2E分开。
- [退款故障与真实UI](../refund-recovery-v022/README.md)：通过链98响应、12图，原始失败保留；所有业务由实际API生成。
- [Redis实测](../redis-v030/README.md)：28响应、真实中断/恢复/自然TTL；仅分类缓存。
- [Prometheus实测](../monitoring-v030/README.md)：8规则、17张原生图、真实宕机/退款告警和恢复；无公网或外部通知结论。
- [恢复会话安全复验](../restore-sessions-v030/result.json)：快照验证后的显式安全初始化，不声称后续登录数据库与原始SQL逐字节相同。
- [本地主Demo升级](main-upgrade.json)：完整备份后安装已测JAR，未重置账号、密码或业务；新备份仅标记“已验证，尚未恢复”，不挪用旧恢复结果。
- [主Demo七角色与三宽复验](main-smoke-2026-10-18T07-40-33-498Z-1e102440/result.json)：70响应、12图，零schema/JS/缺图/外溢问题；仅退出本轮验证会话。
- [批量并发用户暂缓](../concurrency-v030/user-deferred.json)：脚本保留，0HTTP/0SQL；[历史自动审批拒绝](../concurrency-v030/attempts/2026-10-18-approval-blocked.json)保留，不当作测试通过。
- [运行收尾](runtime-final.json)：独立测试服务已正常停止，主Demo及MySQL保持运行。

本次实际额外运行`python3 -m unittest discover -s scripts/tests -p 'test_*.py'`61项、监控目录4项，均成功；静态契约95操作/175 schema/2047检查通过。主页面仍是用户选择R03，没有制作新视觉候选。Linux容器、GitHub CI、公网HTTPS与正式持续压力测试仍待完成。
