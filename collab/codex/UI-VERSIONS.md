# 首页视觉版本索引

用户2026-10-18明确要求每个已交付前端设计版本保存到GitHub，方便比较和回退。**保存候选稿不代表用户批准视觉或功能已验收。**

| 版本 | 标签 / GitHub入口 | 内容 | 用户状态 |
|---|---|---|---|
| R01 | [ui/home-r01-warm](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/home-r01-warm) | 首次可运行Demo中的暖米首屏，基于170f8d2 | 用户不满意中间米白区域；保存用于对比 |
| R02 | [ui/home-r02-shelf](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/home-r02-shelf) | Claude ACK-011 白底货架版；三张价签、红色边条 | 用户明确仍不满意，未采纳；存在两项接线缺陷 |

## 保存方式

每次Claude交付一版，Codex检查差异后，以独立commit保存源文件、必要素材、交接及截图，创建递增的`ui/home-rNN-名称`标签并推送至现有私有仓库；记录该版用户确认状态、验证范围和已知问题。工作中的每次文件保存不等于交付，不编造此前不存在的历史快照。

2026-10-18本次核对前，GitHub只有main和demo/v0.1.1、无标签；首页源码历史只有Demo基线提交0d3de40，不能声称此前每次中间稿都已上传。本次R01为已有源码补标签，R02为本轮实际新增快照。更早的本地截图和HomeB候选文件不代表所有中间版本均能完整复原。

回溯时优先在GitHub标签页查看或下载，也可让Codex按标签在独立目录恢复。共享工作区不执行reset/checkout覆盖Claude正在编辑的稿件；只回退首页时须同时考虑素材、生成模板和相应工程接线。

## R02复核

- 本机macOS / Node26.8.1完整`npm run build`通过，首页源文件构建前后SHA256均为`c355d070586e932a75dfd6ecae1b785e31855f30f512dc9d8f3c90bac7577abd`，本轮没有恢复或覆盖源稿。Claude提到的此前覆盖原因未能确认。
- 本机真实API首页HTTP200；1440/1024均无横向溢出、缺图或页面JS异常。截图和点击检查：`docs/evidence/ui-home-r02-shelf/`。
- Claude提供的`design/v2/screens/V2-Home-build-1440.png`、`V2-Home-build-1024.png`是其云端模拟首页数据截图；与本机真实API截图分开标注。
- 价签展示的会员价、参考价、单位价、规格和产地为静态文字；原实时价格更新依赖的`.fm-hero-fruit`节点已移除。目前不随真实商品变化更新。
- 三张新价签只有`href="#"`，实测点击显示通用规则提示；水果图片可进入对应关键词搜索。
- `dhu-weave-on-red.png`已保存作候选素材，但当前未映射使用；本轮不替用户决定是否显示纹样。
- 仅归档与复核；本次不修改Claude视觉源稿，不将这两项接线问题登记为已修复。
