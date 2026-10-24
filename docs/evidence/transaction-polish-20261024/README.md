# 交易弹窗与结算表单 · 视觉检查

2026-10-24。按用户给出的七处截图修正支付确认、取消订单、结算优惠券/备注、实拣确认、配送签收、售后申请和售后审核。R03首页、校园品牌与既有业务API不变。

## 这批图片的口径

**这些是本地真实前端模块用合成UI夹具渲染的视觉预览，不是真实订单或业务闭环验收证据。** 订单号显式为 `UI-PREVIEW-20261024`，付款对象为内存夹具；没有点击实际支付、取消、出库、签收、退款或售后提交。未使用用户密码，也未连接其订单、会话或私有数据。图片来自本地项目内既有商品资源。

初次一轮检查七种表面 × 1440/1024/390三种屏宽，共21张预览；检查可见范围、横向溢出、优惠券选/不选、六位签收码输入和Esc关闭，无浏览器JS异常。结果见[result.json](result.json)。之后只收紧长表单桌面列布局，正文内部滚动、底部按钮固定，并让售后夹具图片由catalog的商品名映射；对应实拣/售后六张预览已刷新，见[long-form-preview.json](long-form-preview.json)。没有重复业务测试或进行负载测试。

源码整合执行一次 `npm run build`，包含设计资源导入、TypeScript与Vite打包，通过；最后CSS整理后只重新生成Vite静态包。依赖和后端未改，没有再跑全量前后端测试。原有端到端脚本只更新优惠券radio卡片与拣货行选择器，本轮未执行该全流程脚本。

## 预览入口

| 位置 | 桌面 | 手机 |
|---|---|---|
| 沙箱支付 | [payment-1440.png](payment-1440.png) | [payment-390.png](payment-390.png) |
| 取消订单 | [cancel-1440.png](cancel-1440.png) | [cancel-390.png](cancel-390.png) |
| 优惠券与备注 | [coupon-1440.png](coupon-1440.png) | [coupon-390.png](coupon-390.png) |
| 实拣确认 | [picking-1440.png](picking-1440.png) | [picking-390.png](picking-390.png) |
| 配送签收 | [delivery-1440.png](delivery-1440.png) | [delivery-390.png](delivery-390.png) |
| 申请售后 | [aftersale-1440.png](aftersale-1440.png) | [aftersale-390.png](aftersale-390.png) |
| 售后审核 | [review-1440.png](review-1440.png) | [review-390.png](review-390.png) |

本机已启动前端时可从项目根目录执行 `node frontend/scripts/preview-transaction-ui.mjs` 生成同类夹具预览，需要本机可用Chrome。预览脚本不会提交业务命令，不替代后端状态、库存、金额或权限校验。
