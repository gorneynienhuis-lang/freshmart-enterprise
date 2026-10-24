# 商城视觉版本索引

用户2026-10-18明确要求每个已交付前端设计版本保存到GitHub，方便比较和回退。**保存候选稿不代表用户批准视觉或功能已验收。**

最新选择：用户明确采用R03主要页面，要求修复分类文字后推进正式实现。默认R03；R04保留为备选。当前『当前版 / 备选设计』切换继续保留路由；旧标签和归档分支不覆盖。

| 版本 | 标签 / GitHub入口 | 内容 | 用户状态 |
|---|---|---|---|
| R01 | [ui/home-r01-warm](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/home-r01-warm) | 首次可运行Demo中的暖米首屏，基于170f8d2 | 用户不满意中间米白区域；保存用于对比 |
| R02 | [ui/home-r02-shelf](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/home-r02-shelf) | Claude ACK-011 白底货架版；三张价签、红色边条 | 用户明确仍不满意，未采纳；存在两项接线缺陷 |
| R03 | [ui/home-r03-market](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/home-r03-market) | 用户授权Codex制作自然摄影主视觉；三类真实精选商品及直达入口 | 用户认可该板块风格，要求保留并扩展整站；全Demo归档分支archive/demo-r03-2026-10-18=35182fe |
| R04 | [ui/demo-r04-dhu-natural](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/demo-r04-dhu-natural) | 红白校园品牌、自然摄影的全Demo重构，源码与实测保留 | 用户选择继续使用R03，R04作为未采纳备选保留 |
| R03 采用与修补 | [ui/r03-selected-polish](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/r03-selected-polish) | R03默认；分类完整点击/高亮/字体与手机布局修补；新增真实管理功能及账户安全 | 用户采用R03主要页面；新增后台基于同风格实现，功能与截图见CODEX-015 |
| R03 交易弹窗修补 v2 | [ui/r03-dialog-polish-v2](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/ui/r03-dialog-polish-v2) | 支付/取消/实拣/签收/售后申请/售后审核统一弹窗；结算优惠券和备注卡片 | 用户要求修复七处截图；已实现候选待查看，不替用户确认审美 |

## 保存方式

每次Claude或Codex交付一版，Codex检查差异后，以独立commit保存源文件、必要素材、交接及截图，创建递增的`ui/home-rNN-名称`标签并推送至现有私有仓库；记录该版用户确认状态、验证范围和已知问题。工作中的每次文件保存不等于交付，不编造此前不存在的历史快照。

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

## R03复核

用户明确要求Codex亲自尝试新视觉，覆盖本轮首页的原视觉独占约定。主视觉改为深绿色自然食材摄影与『把新鲜，带回校园。』文案；去掉货架和三种水果限制，保留原校园品牌、吉祥物与完整购物入口。

主图使用内置image_gen生成，PNG源图和JPEG网页编码均在design/v2/assets/，原提示词见home-r03-market-photo.prompt.txt。摄影图仅作装饰，下面三张商品卡名称、价格、规格、图片和直达链接均来自实时API；无可售商品则隐藏，避免假价格和无效价签。

32项前端测试、TypeScript、契约类型检查与完整生产构建通过；真实API下1440/1280/1024无横向溢出/缺图/JS异常，三商品卡、两个分类与主选购入口共6条导航逐一验证。证据为docs/evidence/ui-home-r03-market/。R02两项接线问题在R03的新组件中已修复；未重跑订单支付全链路，不借用旧验收声称本轮全量后端测试。

## R04与回看

先核对R03远端标签，再另推送archive/demo-r03-2026-10-18分支，SHA为35182fe4ddfce989c700f4e54334c02886401bfa；完成旧版归档后才开始新设计。design/v2及旧generated/design.json与该提交保持逐字一致。

- 新版：http://localhost:5173/?ui=r04
- 上一版：http://localhost:5173/?ui=r03
- 顶部『新版/上一版』切换保留当前hash路由，业务后端共用；没有复制密钥或数据库。
- 旧版源代码：[GitHub归档分支](https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/archive/demo-r03-2026-10-18)。标签和分支可下载完整代码，运行数据需按部署说明单独初始化。
- 历史页面对比：frontend下执行npm run gallery，打开/generated/design-gallery/index.html。包含R01—R04首页、R03列表/详情实际截图及旧结算验收截图，截图和实际页面有明确区分。

R04验证及边界见CODEX-014和docs/evidence/ui-demo-r04/；当前仅源码与截图归档不表示视觉已定稿。


## R03正式业务增量v0.2

`demo/v0.2.0-operations` 固定商品/仓储/配送异常/图片评价/财务审计等真实工作界面与源代码。R03首页设计源、R04备选和旧标签保留；不是覆盖首页的新视觉候选。新增后台和表单沿用R03红白，未替用户声称逐页视觉已批准。142后端/40前端测试、真实后台133响应、媒体116响应、截图与限制见CODEX-016。GitHub上传是否成功以远端SHA核对结果为准。
