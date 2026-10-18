# CODEX-011 · Demo GitHub版本管理

2026-10-18。用户明确要求使用GitHub，并在授权创建前确认：仅现有私有仓库freshmart-enterprise、Contents读写、30天、保存本机凭据。

## 实际完成

- 已推送 `demo/v0.1.1` 至现有私有仓库：<https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/demo/v0.1.1>，本地分支已建立upstream。
- 首次推送后通过 `git ls-remote --heads origin refs/heads/demo/v0.1.1` 与 `git rev-parse HEAD` 核对，两端均为 `00aa8e1f17fe5339fb48316d0607426bd1ae4f13`。Chrome也已实际显示该分支及源码目录。本文随后作为独立文档提交补入同一分支。
- 实现提交 `0d3de40`，合同提交 `8c8f6e5`，干净源码构建证据提交 `00aa8e1`；分支包含之前的合同、设计及素材历史。未强推或改写远端main，main目前仍为最初README。
- 授权只含该仓库Contents读写与GitHub必需的Metadata只读，2026-11-17到期；未授予账户权限、其他私有仓库或Workflows权限。
- 用户亲自完成GitHub身份验证，并在本机隐藏输入中将凭据保存到macOS Keychain。Git配置仅在本仓库启用osxkeychain及useHttpPath；凭据没有写入源码、文档、命令参数或Git远程URL。
- `.runtime/`、数据库、构建产物、依赖目录与前端生成素材副本均不入库；原始素材与设计导入所需源文件已经提交。未审阅的旧研究材料/截图仍在本地，不删除、不混入本次提交。

## 复现与边界

从 `0d3de40` 的git archive导出干净源码，独立安装后verify（28项测试、类型和生成契约校验）与前端生产build全部通过，六页设计和本地素材可重新导入。记录：`docs/evidence/demo-runtime/source-export-build.json`。此项不等于新机器的完整后端部署验收。

Demo的功能、真实MySQL与浏览器验证、未完成能力以CODEX-010和docs/demo-v0.1.md为准。当前服务继续运行在本机；暂未部署公网、未恢复PPT制作、未联系Claude、未代替用户确认界面。
