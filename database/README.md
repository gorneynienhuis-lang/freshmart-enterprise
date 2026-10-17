# 数据库（Codex）

当前已提供 `migrations/V001__identity_catalog.sql`（身份、会话、商品与批次）和 `V002__command_audit.sql`（命令幂等、审计与outbox表）。后端构建会把此目录打包到Flyway资源路径，启动时验证并执行迁移。已实测H2 MySQL模式，真实MySQL 8.4尚待验证；订单、支付、退款持久化及outbox消费者仍未完成。

`seed/catalog.json` 含8类、40商品、45SKU的课程演示资料，来自成员C可用的名称、产地、规格、图片与价格。原始库存不直接导入；称重SKU明确单价基础克数，鲜活鲈鱼按原始每条约600g的参考规格设置600g单价基础，待后续商品管理可配置。

`scripts/generate-demo-seed.py` 只生成SQL，不连接数据库，不清空或覆盖数据。运行时需通过环境变量提供12–128字符的 `APP_DEMO_PASSWORD`，生成后仅存随机盐PBKDF2哈希。输出文件权限0600且拒绝覆盖，勿提交生成文件。

```sh
python3 scripts/generate-demo-seed.py --environment demo --output database/generated/demo.sql --base-url http://localhost:8080
```

从项目根目录执行。默认按当前UTC日期产生正常、临期、过期与隔离批次；可用 `--base-date YYYY-MM-DD` 固定演示日期。七个合成账号 `19900000001` 至 `19900000007` 依次对应 MEMBER、OPERATOR、PICKER、COURIER、SERVICE、FINANCE、ADMIN，各角色独立。仅向已执行迁移的空演示数据库导入；再次导入应因唯一键冲突失败，不自动重置现有资料。当前尚未完成生成种子导入与真实端到端验证。
