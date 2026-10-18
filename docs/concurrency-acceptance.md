# 独立 MySQL 跨会员并发验收

准备脚本：`scripts/e2e-concurrency.mjs`。目标锁定 `127.0.0.1:18081` 和 `fresh_mall_restore_engineering_v030_20261018a`，不接主8080或主schema，不控制Java、MySQL或Prometheus进程。需主代理明确放行独占业务窗口；真正发起并发波前会拒绝仍在监听的Prometheus9090。

脚本通过真实注册建立100个独立合成MEMBER，各自有地址与会话。这样每份报价和订单属于不同主体，避免同一会员的 `lockUser` 将所谓100客户端争抢退化成单主体串行。数据库仍可通过SKU、FEFO批次、配送时段和策略锁串行化关键区间，这是业务保证的一部分；不据此宣称任意SQL操作完全并行。

OPERATOR通过真实multipart API上传合成不透明PNG，并匿名读取受控图片内容，再创建两个DRAFT商品、SKU并上架。PICKER通过入库API分别增加10件和100件到专用新批次，生产/到期时间为真实当前测试时点生成。始终不修改现有商品、全局策略、员工或密码。

选择明日实际 `used=0/capacity=30` 的可预约时段，以API与只读SQL交叉核对余量。若只有其他容量的真实空时段，可以通过合法PUT临时设30，保留原配置；结束时要求实际used归零且version符合本轮全部预约/取消增量，使用当前version恢复。契约没有创建时段接口；明日无真实空时段时明确失败，禁止SQL插入或伪造原值。

1. 库存波：100名会员各先生成1份独立真实quote，全部完成且仍有效后一次发出100个create请求。必须10个201、90个422 `INSUFFICIENT_STOCK`；SQL与API均为在库10/预占10/隔离0/可售0，配送已用增10。各owner正常取消后恢复10/0/0/10与原时段使用量。
2. 容量波：复用其中31个会员，100件的新SKU先生成31份独立quote，再并发create。必须30个201、1个422 `SLOT_UNAVAILABLE`；在库100/预占30/隔离0/可售70，已用增30。各owner取消后恢复100/0/0/100和原使用量。

两波不支付，不调用退款/履约/补货SQL。每条实际HTTP都校验响应schema及JSON/响应头trace一致；网络失败、异常状态和业务拒绝均保留在分母，先等待整波全部settled再检查精确结果。记录每条RT/状态、实际同时在途峰值、整波elapsed、包含拒绝的burstQPS与P95。注册、地址、商品、图片、报价和清理请求也保留真实记录，不混作两波create指标。它不是持续稳态压测，不声明2vCPU环境、正式资源隔离、十万行数据或全系统吞吐。

finally仅使用各owner的会话扫描本run标记且只含两个专用SKU的订单，正常取消PENDING_PAY/paidAmount0订单；超时提交但未返回的订单也能通过本人分页找到。已关闭或取消的记录保持审计；异常已支付状态不自动退款。只有本次新商品会下架，新增账户、批次、流水与订单保留供复查。失败或配置恢复版本冲突必须标记失败并留下私有现场，不能覆盖别人的更新。

所有手机号、密码、access/refresh/CSRF、quoteToken、完整HTTP样本与state只写 `.runtime/concurrency/<run>/`，目录0700/文件0600；不放Git。公开summary只保留client001等匿名标签、真实状态/trace/RT、聚合守恒与源码摘要。原始HTTP清单逐文件SHA作为完整性凭据。

配置固定为 `.runtime/engineering/v030/private/concurrency.config.json`（0600），明确 `purpose=engineering-concurrency`、精确schema/baseUrl、`exclusiveBusinessWindow=true`及独立OPERATOR/PICKER登录。后端env、恢复purpose/cnf和媒体目录必须与工程runtime一致，运行前核验真实受管PID及env摘要。预检不会查询数据库或发HTTP：

```bash
CONCURRENCY_PHASE=preflight CONCURRENCY_CONFIG='/absolute/project/.runtime/engineering/v030/private/concurrency.config.json' node scripts/e2e-concurrency.mjs

# 只能在明确放行的独立窗口执行
CONCURRENCY_PHASE=run CONCURRENCY_CONFIG='/absolute/project/.runtime/engineering/v030/private/concurrency.config.json' node scripts/e2e-concurrency.mjs

# 仅恢复某个既有私有run的本人订单/专用商品/该run配置
CONCURRENCY_PHASE=cleanup CONCURRENCY_CONFIG='/absolute/project/.runtime/engineering/v030/private/concurrency.config.json' CONCURRENCY_RUN_DIR='/absolute/project/.runtime/concurrency/<run>' node scripts/e2e-concurrency.mjs
```

初始状态：源码通过 `node --check`；真实执行结果在运行后另存 `docs/evidence/concurrency-v030/<run>/`，准备完成不代表并发验收通过。

2026-10-18执行边界：固定私有配置已生成并通过preflight（HTTP0、数据库查询0）；实际run命令在进程创建前被自动审批拒绝。理由为批量注册100个账户、写入商品/库存/订单及并发负载属于较大持久数据与负载副作用，代理内部授权不足，要求真实用户明确确认。未绕过拒绝或间接执行；该次实际HTTP/SQL写入均为0。审批拦截保留在 `evidence/concurrency-v030/attempts/2026-10-18-approval-blocked.json`，不能计作库存/容量验收通过。

用户随后明确回复“暂不执行，保留测试脚本”。因此本轮最终状态为`USER_DEFERRED`，并非等待后自动执行；没有创建批量会员、商品或订单，也没有实际负载结果。仅保留脚本与历史拦截记录，独占写入窗口关闭。将来重新执行须先获用户新的明确授权并重新核验独立实例与私有配置。
