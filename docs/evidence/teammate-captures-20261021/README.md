# 文档运行截图来源与处理索引

整理日期：2026年10月21日。输入为队友一截图.rar（42张）、新建 zip 压缩文件.zip（13张）及成员3.zip（21张PNG）。原件只读保留在本机，不随Git上传。

## 采用与处理

三份正式文档共引用以下22张本批图片，按章节展示页面、岗位与操作状态。对选定画面仅进行主体裁切和等比缩放，不重建页面、数据、网址或业务结果。用户确认手机号、验证码等是课程合成演示信息，并要求按原画面保留。新保存PNG不携带原图额外元数据。

画面日期跨2026年10月19日与21日，采集时未固定同一个commit。文档整理基线为`f32416e`，历史工程测试继续引用其原始版本；本次是文档整理，不追加自动化测试通过数量。

## 图片索引

| 文档图片 | 原始图片 | 内容 |
| --- | --- | --- |
| home.png | team1/队友一截图/UI-01-home.png | 首页与公网来源 |
| product-detail.png | team1/队友一截图/UI-03-detail-1.png | 商品详情与按件SKU |
| product-specification.png | team1/队友一截图/UI-03-detail-2.png | 参数与评价空态 |
| checkout-summary.png | team1/队友一截图/UI-04-checkout-2.jpg | 商品金额、配送时段及称重说明；优惠为0 |
| paid-order.png | team1/队友一截图/UI-05-payment-success.png | 已支付待拣货订单 |
| order-canceled.png | team1/队友一截图/UI-06-order-3.png | 已取消订单 |
| cancel-prompt.png | team1/队友一截图/TEST-05-exception-flow-2.png | 同单取消确认 |
| cancel-after.png | team1/队友一截图/TEST-05-exception-flow-3.png | 同单取消完成；非退款恢复 |
| responsive-phone.png | team1/队友一截图/TEST-04-responsive-390-4.jpg | 手机首页与问答抽屉；CSS视口宽度未固定 |
| login.png | team2/AUTH-02-unauthorized.png | 登录弹窗；无法单独证明订单路由拦截或401 |
| operator-overview.png | team2/AUTH-04-operater.png | 运营经营概览 |
| picker-task.png | team2/AUTH-05-picker (3).png | 真实拣货任务局部；仅裁去重复拼接侧栏，不重建页头 |
| courier-task.png | team2/AUTH-06-courier.png | 配送角色与配送中任务；未证明签收完成 |
| service-case.png | team2/AUTH-07-service.png | 客服待处理工单；未证明完成退款 |
| finance-inventory.png | team2/AUTH-08-finance.png | 财务库存对账投影；非退款执行 |
| admin-employees.png | team2/AUTH-09-admin.png | 员工权限与账号状态；未证明修改权限动作 |
| member-forbidden.png | team2/AUTH-10-forbidden.png | MEMBER无工作台权限页面提示；非HTTP403实测 |

## 可复核记录

`manifest.json`记录每张采用图片的原图SHA256、原尺寸、裁切框、输出尺寸与输出SHA256。裁切坐标以原图左上角为原点，格式为`[left,top,right,bottom]`。`redactionsInSourcePixels`为空，表明用户指定的合成演示标识未作遮挡。

图注按实际可见内容描述，例如“已支付待拣货”“订单库存对账”“角色界面提示”；这些陈述与既有HTTP、数据库和自动化测试证据分别引用。

## 成员三素材

成员三提供代码查看器与命令日志排版视图，正式文档分别标明源码摘录或日志摘录，不称为原生IDE、终端窗口截图。定向测试的原始合并日志见`logs/member3-targeted-tests.log`：缓存9项、幂等5项、退款14项来自同一次28项运行，不能视作三个新独立全量测试，也不与历史195项相加。前端验证与构建原始日志另列于logs目录。

原始日志保留Windows换行与命令输出空白，目录属性禁止Git自动转换其文本字节。

| 文档图片 | 原始来源 | 内容 |
| --- | --- | --- |
| member3-openapi.png | team3/成员3/ENG-04-openapi.png | OpenAPI源码与角色约束摘录视图 |
| member3-migrations.png | team3/成员3/ENG-05-migrations.png | 数据库迁移与约束源码摘录视图 |
| member3-security-code.png | team3/成员3/ENG-06-security-code.png | 认证、密码哈希和权限实现源码摘录视图 |
| member3-frontend-build.png | team3/成员3/TEST-02-frontend-build.png | 前端44项测试与生产构建的原始日志排版摘录 |
| member3-targeted-tests.png | team3/成员3/原始日志/runtime-targeted-tests.log | 同一次Windows/Java21定向运行：缓存9、幂等5、退款14，共28项通过；原始日志摘录，不是终端原生截图 |
