# 媒体、购买评价与品质售后实测

最终实测：2026-10-18 06:19:27–06:19:32 UTC，`result.json` 为 `PASSED`。使用本机真实 MySQL、HTTP API 与 Chrome/Playwright 界面，未拦截网络、未 mock 响应、未清库。8 张 PNG 均来自实际运行页面。

- 116 条实际 API 响应通过当前 OpenAPI 响应校验，其中 6 条为实际 PNG/JPEG 二进制图片响应；浏览器异常、失败素材、响应契约错误均为 0。
- 新注册的独立合成会员完成服务端报价、下单、沙箱支付、拣货领取与出库、配送交接与签收。订单从真实业务流程进入 `FINISHED`。
- 会员通过界面上传 PNG、读取私有 Blob 预览、勾选公开授权并发布匿名评价；商品页读取真实存储结果及公开图片。相同已完成订单行再次评价返回 409。公开评价没有手机号、会员 ID、订单 ID、订单行 ID或私有签名。
- 另行上传 `AFTERSALE` 图片并在界面申请 `QUALITY` 售后。其他会员、未领取客服获取图片授权返回 404；复制完整私图访问 URL 后，其他会员仍返回 404，无 Bearer 返回 401，过期签名返回 404。把品质证据当公开评价图片请求返回 404。
- 领取工单的客服在界面读取了真实 96×64 像素。私图通过带 Bearer 的受控接口转为 Blob；DOM 中没有 token/签名访问链接，关闭后 object URL 已释放。直接读取私图响应同时检查 `nosniff` 与 `no-store`。
- 客服审核、另一财务账户授权沙箱原路退款，后台任务完成 100 分退款。最终重新加载会员页并断言 `COMPLETED`、已退 ¥1.00；重新加载财务页并断言目标退款 `SUCCESS`，再截图。订单保持 `FINISHED`。

## 复现

先按项目既有方式启动本机 MySQL、8080 后端与 5173 前端，并确保 `.runtime/demo-accounts.txt` 中的本机员工凭据有效且无需首次改密。不要将该私有文件提交或复制到证据目录。

```sh
cd frontend
node scripts/e2e-media-review.mjs
```

可用 `MEDIA_E2E_BASE` 改为其他本机 localhost/127.0.0.1 地址，`E2E_BROWSER_CHANNEL` 指定已安装的 Playwright 浏览器通道；脚本拒绝向公网地址写入。每次创建隔离的合成会员、订单、评价和售后，不清理审计记录、不修改已有员工密码、不改运营策略或配送时段配置。密码与 token 只在进程内使用。

## 截图

| 文件 | 实际界面 |
|---|---|
| `member-review-form-top.png` | 评价表单上部、评分、文本、已核验图片 |
| `member-review-image-consent.png` | 同一长表单滚动到公开授权勾选处 |
| `product-real-published-review.png` | 真实存储的匿名评价与已发布图片 |
| `member-quality-evidence-ready.png` | 品质售后申请及已核验订单图片 |
| `assigned-service-private-blob-preview.png` | 领取客服的真实私图 Blob 预览 |
| `service-quality-approved.png` | 客服审核后 `APPROVED`、等待财务 |
| `member-quality-refund-completed.png` | 强制刷新后 `COMPLETED`、已退 ¥1.00 |
| `finance-quality-refund-executed.png` | 强制刷新后目标退款 `SUCCESS` |

`synthetic-raster.png` 是脚本生成的红绿双色栅格，只用于证明真实文件上传、解码、发布和授权流程；不代表真实商品、真实缺陷或真实消费反馈。评价与申请文本均明确标记为课程合成验收。

## 验收边界与修正记录

本次是本机单浏览器流程验收，不代表公网部署、Linux 容器、真实付款渠道、外部杀毒服务、压测或全部图片格式的浏览器覆盖。服务端图片格式、伪格式、EXIF、过期授权等集成测试由主代理统一执行，具体结果另见后端报告；本记录不冒充该轮测试。

首轮业务与 HTTP 校验通过，但人工看图发现：跳转到相同订单 hash 没有刷新界面，完成截图仍显示旧 `APPLIED`。该图不作为完成证据。脚本已改为重新加载并明确等待会员 `COMPLETED/已退 ¥1.00` 与财务 `SUCCESS` 后截图，又独立完成一笔合成订单复测。首轮元数据保存在 `attempts/`，本目录现有截图及 `result.json` 均来自最终复测。对话框较长时正常内部滚动，顶部与公开授权分别留图，没有拼接或伪造页面。
