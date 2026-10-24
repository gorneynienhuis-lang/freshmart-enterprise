# 数据库脚本与初始化

2026-10-24交付说明。当前提供 **V001–V013 共13份 Flyway SQL迁移**，覆盖身份会话、商品与批次库存、下单与配送容量、沙箱支付、拣货称重、售后退款、员工治理、媒体与评价、审计对账、客服取消协助和退款恢复。43张业务表及真实MySQL的历史验证见[项目README](../README.md)与[测试报告](../docs/formal/测试报告.md)；本次打包不重新执行数据库测试。

## 文件与执行顺序

| 文件 | 用途 |
|---|---|
| `migrations/V001__*.sql` 至 `V013__*.sql` | 版本化建表与结构升级；由Flyway按版本执行 |
| `seed/catalog.json` | 8类、40商品、45 SKU的合成商品资料与图片路径 |
| `../scripts/generate-demo-seed.py` | 生成新环境的初始化SQL，不连接或重置数据库 |
| `../scripts/demo-seed.sh` | 本机Demo初始化封装；保留已存在的演示数据 |
| `../scripts/deploy-public.py` | 云端配置生成、数据库引导与空库种子导入 |

后端Maven构建会将 `migrations/` 打包到 `db/migration`，启动时由Flyway校验并执行。**先执行迁移，再向空业务库导入种子**；不要再手动重复执行已由Flyway应用的建表脚本，不修改已经应用的迁移文件。

## 本机一键初始化

在项目根目录按[本机运行说明](../deploy/README.md)执行：

```sh
./scripts/demo-start.sh
./scripts/demo-status.sh
./scripts/demo-credentials.sh
```

脚本依次启动隔离MySQL、后端迁移、种子和前端。演示账号为 `13800000001`–`13800000007`，顺序是 MEMBER、PICKER、COURIER、SERVICE、FINANCE、OPERATOR、ADMIN；新环境随机密码只存放在Git忽略的私有 `.runtime/` 中。本包不复制现有数据库、密码或会话。

## 单独生成SQL

先在本机环境中设置12–128字符的 `APP_DEMO_PASSWORD`，再从项目根目录运行：

```sh
python3 scripts/generate-demo-seed.py --environment demo --output database/generated/demo.sql --base-url http://localhost:8080
```

生成器仅写入随机盐PBKDF2-SHA256散列，不输出密码；文件权限0600，拒绝覆盖。默认以当前UTC日期生成正常、临期、过期与隔离批次，共136批次；可用 `--base-date YYYY-MM-DD` 固定日期。过期、隔离批次用于业务校验，不作为可售库存。

直接使用生成器时，内部合成账号为 `19900000001`–`19900000007`，顺序是 MEMBER、OPERATOR、PICKER、COURIER、SERVICE、FINANCE、ADMIN。本机与公网部署封装会显式映射为上述138账号；不要混用两种入口的账号顺序。独立生成器不负责部署封装中的优惠券等附加初始化。

仅向已迁移的空演示库导入SQL；再次直接导入会因唯一键冲突失败，不自动清空、覆盖账号或重置业务数据。`--base-url` 应填写目标环境实际提供商品图片的origin，云端初始化另见[公网部署说明](../deploy/公网部署.md)。生成的SQL和私有配置不应放回源码交付包。
