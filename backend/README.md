# fresh-mall 后端

2026-10-18 第一批实现：Java 21、Spring Boot 4.1.1、MyBatis Starter 4.0.0；Maven Wrapper 固定 Maven 3.9.16。详见 [AGENTS.md](../AGENTS.md) 和 [鉴权与技术 ADR](../collab/decisions/ADR-001-后端技术栈.md)。PPT 工作继续暂停。

## 当前范围

已实现下列 **12 个合同 HTTP 操作**，路径统一以 `/api/v1` 开头。此前交接中的“13”是身份/商品测试数量，接口数量按本表为准。

| 方法 | 路径 | 当前行为 |
|---|---|---|
| GET | `/auth/csrf` | 创建持久化 CSRF 上下文，返回 token 并设置 Cookie |
| POST | `/auth/register` | 基础会员注册，密码哈希持久化并签发会话 |
| POST | `/auth/login` | 校验密码和账户，数据库限流，签发会话 |
| POST | `/auth/refresh` | refresh Cookie 轮换；旧凭据重放吊销会话族 |
| POST | `/auth/logout` | 吊销会话族并清除 Cookie |
| GET | `/auth/me` | 当前用户脱敏资料与显式角色/权限 |
| POST | `/auth/password` | 当前密码校验、幂等命令、改密并吊销全部会话 |
| GET | `/categories` | 数据库启用分类，返回 `data.items` |
| GET | `/home` | 数据库分类、推荐和临期商品；轮播暂为空 |
| GET | `/products` | 数据库分页、分类/关键词/临期过滤与价格排序 |
| GET | `/products/{productId}` | 上架商品与 SKU、当前可售提示及有效期信息 |
| GET | `/products/{productId}/reviews` | 校验公开商品后返回空评价分页；评价存储和提交尚未实现 |

商品价格和可售提示依据当前有效批次聚合，不能替代未来结算报价或预约时段库存保证。`/catalog/*.jpg` 是公开静态素材。购物车、地址、报价、订单、支付、售后、后台操作、员工管理及完整履约均尚未接通；合同权限注册包含这些路由，不代表 handler 已实现。

鉴权当前采用自写 `OncePerRequestFilter` 和显式角色注册，**未实装 Spring Security**。角色入口检查不替代资源所有者检查。运行时会话、限流、商品及批次来自数据库，没有内存 mock 作为运行数据源。

## 本机运行条件

准备 Java 21 和可访问的 MySQL 8.4 数据库；数据库与账户须先创建，并允许本项目 Flyway 迁移。当前没有可直接宣称已验证的完整 Compose 部署。配置见 [application.yml](src/main/resources/application.yml)。

| 环境变量 | 含义与默认值 |
|---|---|
| `DB_URL` | 默认 `jdbc:mysql://localhost:3306/fresh_mall?serverTimezone=UTC&characterEncoding=UTF-8` |
| `DB_USERNAME` | 默认 `fresh_mall`；需与已创建的数据库账户一致 |
| `DB_PASSWORD` | 设置为该账户实际密码；仓库不提供通用登录凭据 |
| `APP_TOKEN_SECRET` | 必填，至少 32 个 UTF-8 字节的随机密钥；不足时启动失败，不使用内置默认值 |
| `APP_ALLOWED_ORIGINS` | 默认 `http://localhost:5173`；逗号分隔的精确 Origin，不允许 `*` |
| `APP_SECURE_COOKIES` | 默认 `true`；本机 HTTP 联调使用 `false`，HTTPS 部署保持 `true` |
| `SERVER_PORT` | 默认 `8080` |
| `APP_BRAND_NAME` | 可配置品牌名；默认工程代号 `fresh-mall` |

在 shell 中配置数据库变量后，从 `backend/` 执行：

```sh
# 本机临时密钥示例；部署应从受控配置注入，并在重启间稳定保存。
export APP_TOKEN_SECRET="$(openssl rand -hex 32)"
APP_SECURE_COOKIES=false ./mvnw spring-boot:run
```

不要把实际密钥、数据库密码或 `.env` 提交到仓库。更换签名密钥会使旧 access JWT 无法使用。Maven 首次运行需要访问官方依赖仓库。

构建时将 `../database/migrations/*.sql` 复制到 classpath `db/migration`，启动时由 Flyway 执行 V001/V002。建表迁移不自动导入商品种子；空数据库的商品列表应为空。演示种子生成入口为 [generate-demo-seed.py](../scripts/generate-demo-seed.py)，仅生成文件不等于已导入数据库。

前端认证顺序为 `GET /auth/csrf` → 携带 Cookie、允许的 Origin 和 `X-CSRF-Token` 注册/登录；返回的新 CSRF token 对应新 Cookie。refresh/logout 同样校验这三项。其他已认证请求使用 `Authorization: Bearer <accessToken>`；改密额外要求 UUID 格式 `Idempotency-Key`。access 最长 15 分钟，refresh 会话族绝对期限最多 7 天，轮换不延期。

## 测试与证据边界

```sh
./mvnw -Dtest=IdentityIntegrationTest,CatalogIntegrationTest test
./mvnw test
./mvnw package
```

第一条命令对应当前已真实通过的 13 项集成测试：身份 8、商品 5。测试启动真实 Spring 上下文、MockMvc 过滤器、Flyway V001/V002 和隔离 H2 MySQL 模式数据库，没有模拟身份服务或商品 Mapper；测试密钥只存在测试配置。身份测试包含密码修改与 refresh/旧密码登录并发的用户行锁互斥。

本轮随后执行全套 `clean package`，实际 60 项测试全部通过，Spring Boot JAR 打包成功，详见 [原始报告与构建证据](../docs/evidence/implementation-foundation/README.md)。这包含纯领域和幂等测试，不能换算成 60 个已实现接口。

**H2 的结果不证明 MySQL 8.4 的锁、事务隔离、SQL 和性能已经验收。** 当前未完成真实 MySQL 启动与并发验证，未完成端到端订单资金闭环；完整测试和打包状态以当次命令输出及保存证据为准。`target/surefire-reports/` 为每次本地运行生成的报告，不提交构建产物。
