# CODEX-023 · 当前版首页滚动动效

2026-10-24。动效改到默认界面 R03（无 `ui` 参数，或 `?ui=r03`）。R04 备选稿不再带这套动效，相关设计源和生成模板已退回。

## 范围

- 设计源：`design/v2/V2-Home.dc.html` 用 `.fm-chrome` 包住顶栏，并加上氛围光和区块/商品卡标记。`design/v2/V2-Detail.dc.html` 的主图增加 `.fm-detail-photo`，供视图过渡使用。布局和文案未改。生成模板已重新导入。
- 样式：`frontend/src/styles/r03-motion.css`。首屏标题、说明、按钮和右侧卡片按 `cubic-bezier(.16, 1, .3, 1)` 依次入场；主图随滚动轻微缩放位移；东华红与暖白光在首屏两侧缓慢流动。区块和商品卡用 `animation-timeline: view()`，不支持时由 `IntersectionObserver` 补上。
- 顶栏滚过 24px 后收起红条、缩小搜索和标志，白底变为毛玻璃。
- 商品图到详情主图使用 `document.startViewTransition`。不支持或系统要求减少动态效果时走原来的跳转，内容保持可见。
- 同一次停留里数据重绘不重播首屏入场。没有新增动画库。

## 验证

`frontend` 下 `npm run verify`：契约检查、类型检查、8 个测试文件 50 项通过。`npm run build` 通过。Chrome 打开默认地址：首屏入场、滚动显现、顶栏吸顶收起、沙瓤番茄图片过渡均发生。390/768/1100/1440 宽无横向溢出。`prefers-reduced-motion: reduce` 时动画关闭且文字和商品卡保持可见。
