# 本轮视觉修正与新页面交接

2026-10-18，Codex给当前Claude会话。用户已授权恢复直接协作，并再次明确：Claude只负责审美；后端、全部真实交互、JS/TS业务逻辑和工程工作由Codex承担。此条覆盖旧暂停记录。PPT仍暂停。

## 当前方向

沿用用户在当前会话暂定的A布局与暖米首屏，保留已批准的东小锦形象。暖米为暂用方向，不代表所有页面已最终通过。用户仍是视觉确认人；不再新增配色分支、品牌方向或无关栏目。

## 你只处理这些视觉工作

1. 完成用户本轮要求的水果透明边缘与暖米呈现；如果抠图工具耗时或失败，写明素材需求交给Codex，不继续安装/调试工具。已有资产继续复用。
2. 修复仍适用的公共排版问题：分类入口width232另加左右padding16，实际264，与下方232分类栏差32；公共导航overflow:hidden会在1024窗口把“新人专享券”裁成“新”；头部购物车/配送区域在1024换行后留白过大。桌面首屏仍有232+中栏+272固定列，需给中等桌面宽度设计合理重排。旧红色主图截图已过时，不照着回退。
3. 当前已落盘V2-Checkout、V2-Admin、V2-AdminPick（见ACK-009），保留这些成果，不从零重复制作。只按本清单校准其视觉与展示内容；不要再铺更多后台模块。必要字段、状态、按钮和示例已由Codex放在同目录support/UI-DATA-009.json；做新页面时只读它，不用重读整套合同。只编排界面，不实现网络、计算、筛选、权限、支付、表单提交、订单流转或状态管理。
4. 大图和大块留白、按钮/价格/长商品名、1024/1280/1440桌面布局由你负责视觉判断。一次交一套精修稿，不再产多轮备选。渲染测试与独立运行问题交给Codex；你若已有画布可直接快速预览，无需另搭工具链。

## 已备齐的资料与素材

项目根：/Users/djy/Desktop/实验四/fresh-mall

- 当前页面：design/v2/V2-Home.dc.html、V2-List.dc.html、V2-Detail.dc.html；HomeB仅历史备选。
- 官方校标现成PNG：design/v2/assets/dhu-lockup-h.png、dhu-emblem-256.png。
- 经纬纹样现成PNG：design/v2/assets/dhu-weave-red-fade.png、dhu-weave-soft.png、dhu-weave-white.png。
- 水果裁图：design/v2/assets/S010-cut.png、S008-cut.png、S007-cut.png（以你当前正在更新的版本为准）。
- 吉祥物：assets/mascot/dongxiaojin-v2-concept.png；页面已有design/v2/assets/dongxiaojin-crop.jpg。需要新增透明正式素材/姿态时列需求，Codex提供，不重新设计角色。
- 学校官方资料已核实落盘：assets/reference/dhu/README.md和previews/。只有需要查一个具体视觉事实时才打开，不用再次上网。
- 旧稿错位证据：docs/evidence/design-review-2026-10-18/Home-1024-first-screen.png。只参考公共头部/分类对齐，旧首屏构图已被用户后续方向替代。

## 省额度与交付方式

本轮不要浏览器搜索，不安装依赖，不审计后端，不修support.js、/_blob、本地导出脚本或Git，不重复查看整份复查报告/整套合同。资料缺什么一次列给Codex，由Codex查找、下载、整理。

只写design/，或纯展示用frontend/src/ui、src/styles、public/brand；不用改JS/TS业务、API、状态、权限和金额逻辑。已有原型交互保持即可，不扩写。页面用JSON里的显示值和状态样例，Codex后续通过props与回调接线。

交付保存视觉源文件，另写简短ACK-010回复本轮分工、列出文件与剩余视觉决策即可（ACK-009是上一轮成果，不覆盖）；已有截图顺手给出，不为截图另开排错任务。所有构建、1024/1280/1440浏览器检查和实际交互验收由Codex统一完成。用户确认前均称候选稿。
