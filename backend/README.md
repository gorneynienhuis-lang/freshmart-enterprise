# fresh-mall 后端

2026-10-18。Java 21、Spring Boot 4.1.1、MyBatis 4.0.0、Maven Wrapper 3.9.16、MySQL 8.4.11。模块化单体，真实数据库持久化；支付、退款始终为课程沙箱。最新契约 0.1.2。

## 实现边界

OpenAPI 共 91 个操作，目前 63 个标记 IMPLEMENTED_DEMO、28 个仍为 CONTRACT_ONLY。该标记说明存在代码，不等于每个分支均已验证，实际测试见 docs/evidence 与 CODEX 交接；不能以接口清单冒充完整企业生产能力。

已接通：身份/CSRF/轮换/改密，商品浏览与搜索，购物车、地址、配送时段、优惠与服务器报价，库存和名额事务预占，订单/沙箱支付/幂等回调，称重差额、拣货、交接配送与签收、取消/关单/回库、SHORTAGE/LATE 售后与独立财务退款、真实运营/财务概览。

本次补齐五个管理员操作（统一前缀 `/api/v1`）：

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | /admin/employees | 仅独立员工标记账户、分页与脱敏 |
| POST | /admin/employees | 201创建、临时密码强哈希、强制首次改密 |
| GET | /admin/roles | 固定七角色与真实权限目录 |
| PUT | /admin/employees/{employeeId}/roles | 版本检查、原因审计、撤销旧会话 |
| PUT | /admin/employees/{employeeId}/status | 启停、原因审计、撤销旧会话 |

V006 引入员工身份与持久治理互斥锁。普通购物会员不能被员工接口接管；管理员不能通过本接口修改自身角色/状态，并发操作仍须保留有效管理员。管理命令在事务锁内重查操作者权限与会话，避免先通过入口检查、随后被撤权仍执行变更。

商品编辑、仓储维护、QUALITY/私有证据上传、评价持久化、审计查询等未完成，见 [工程验收差距](../docs/工程验收差距-2026-10-18.md)。没有实现的 API 返回拒绝/404，不返回伪造成功数据。

## 启动与配置

本机用仓库根目录 `./scripts/demo-start.sh`。数据、独立 MySQL、密码与日志在 Git 忽略的 `.runtime/`；不清空已有订单或重置账号。部署入口见 [本机运行](../deploy/README.md)、[公网方案](../deploy/公网部署.md)。

| 配置 | 要求 |
|---|---|
| DB_URL / DB_USERNAME / DB_PASSWORD | 实际 MySQL 与仅本库权限应用账号；不得把 root 注入应用 |
| APP_TOKEN_SECRET | 随机至少32字节，重启保留，无可用默认密钥 |
| APP_ALLOWED_ORIGINS | 逗号分隔精确Origin；showcase仅HTTPS且不可带路径 |
| APP_SECURE_COOKIES | 默认true；仅本机demo为false；showcase强制true |
| SANDBOX_SECRET | 独立随机至少32字节 |
| SPRING_PROFILES_ACTIVE | 本机demo；公网课程showcase；prod/production禁止沙箱 |

showcase 支持平台 PORT / SERVER_PORT，应用与前端编译资源同源，数据库不公开。仅根首页、编译静态目录、公开商品与健康状态匿名可读；其他监控需管理员身份。禁止把本机demo profile用作公网环境。

认证采用自写过滤器和显式权限注册，未使用 Spring Security。access只存前端内存、最长15分钟；refresh为HttpOnly Cookie且轮换、绝对最长7天，旧凭据重放吊销会话族。Cookie命令校验Origin和CSRF；改密成功撤销全部会话，临时员工在改密前仅能访问本人会话/改密/退出。

Flyway 从 `database/migrations` 打包 V001–V006；种子只向空演示库一次导入。不要手工重复执行迁移，不更改已运行迁移的历史校验和。

## 实际验证

`./mvnw -B -ntp package` 本轮104项测试、0失败/错误/跳过，并生成Spring Boot JAR。新增7项员工集成测试覆盖HTTP权限、幂等/陈旧version、脱敏/不接管会员、首次改密、会话吊销、并发管理员互撤与数据库锁。

测试使用H2 MySQL模式的部分不能替代MySQL行为验证。本机真实MySQL已应用V006并进一步运行新增后台和既有购物流程；按各证据JSON区分成功结果、测试数据和限制。公网容器/HTTPS与云端备份恢复尚未验收，当前没有已上线URL。
