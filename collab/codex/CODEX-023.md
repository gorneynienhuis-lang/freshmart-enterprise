# CODEX-023 · R04 首页滚动动效

2026-10-24。会员首页（`?ui=r04`）增加首屏入场、滚动显现、吸顶毛玻璃顶栏，以及商品图到详情页的视图过渡。布局、文案、品牌色和购物流程保持原样。没有新增动画库。

## 范围

- 设计源：`design/r04/Home.dc.html` 增加氛围光层和区块显现标记；`design/r04/fragments/header.html` 用 `.r4-chrome` 包住顶栏。生成模板已重新导入。
- 样式：`frontend/src/styles/r04-motion.css`。首屏用 `cubic-bezier(.16, 1, .3, 1)` 依次入场；主图随滚动轻微放大位移；区块和商品卡用 `animation-timeline: view()`，不支持时由 `IntersectionObserver` 补上。
- 顶栏滚过 24px 后收起账户条、缩小搜索与导航，并加上 `backdrop-filter`。
- 商品卡图片到详情主图使用 `document.startViewTransition`，名称按商品 ID 生成。不支持或系统要求减少动态效果时走原来的跳转。
- `data-motion` 保证同一次停留里数据重绘不重播首屏入场；滚动显现在入场结束后仍然保留。

## 验证

`frontend` 下 `npm run verify`：契约检查、类型检查、8 个测试文件 50 项通过。`npm run build` 通过。Chrome 实测：1440 宽首屏入场、滚动显现、顶栏吸顶收起、商品图过渡均发生；390 宽无横向溢出；`prefers-reduced-motion: reduce` 时动画关闭且内容保持可见。屏幕录像为首页自顶向下滚动后点开沙瓤番茄。
