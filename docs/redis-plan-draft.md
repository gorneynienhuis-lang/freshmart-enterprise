# Redis 分类缓存：实现范围与真实验证边界

2026-10-18；基于 v0.2.1 / `d96169b` 后的工作树增量。本文中的计划、源码完成、编译、Redis 进程和 HTTP 验证分别记录，不将它们混同为上线结果。当前首阶段只接公开分类，不宣称整站缓存命中率达到任何比例。

## 缓存范围

| 数据 | 本阶段策略 | 原因 |
| --- | --- | --- |
| `GET /api/v1/categories` 的六个公开字段 | Redis，默认 60 秒并加 ±5 秒抖动 | 低频修改，无用户、价格或批次数据 |
| 首页中的分类数组 | 调用同一个独立缓存组件 | 直接方法调用也生效，无 `@Cacheable` 自调用绕过问题 |
| 商品列表、商品详情、首页完整结果 | 继续查 MySQL | 返回实时在售状态、SKU、临期、价格与可售库存 |
| 报价、下单、库存预占、配送容量、退款、策略 | 继续查 MySQL 和原事务 | 资金、库存与版本约束不能由缓存决定 |
| 登录、会话、联系方式、售后图片、审计 | 不进本缓存 | 私有信息与资源授权边界保持原有实现 |

`CatalogService.views()` 会读取有效 SKU、未过期 NORMAL 批次、当前业务策略和时钟。商品版本没有覆盖每一种 SKU 变更，用 `productId:productVersion` 缓存完整详情也可能产生陈旧价格，因此本轮不采用。缓存分类不使数据库变成可选依赖；现有服务只读事务仍可能取得数据库连接。验证的目标是分类 SELECT 加载器被真实缓存命中绕过，并非证明整站脱离数据库运行。

## 官方依赖与本机资源

项目使用 Spring Boot **4.1.1**，其 BOM 管理 Spring Data Redis **4.1.1** 和 Lettuce **7.5.2.RELEASE**。依赖由根代理添加 `spring-boot-starter-data-redis`，不单独覆盖传递依赖版本。[Boot 依赖表](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)、[Redis 自动配置说明](https://docs.spring.io/spring-boot/reference/data/nosql.html)。

本机查验时没有可用 `redis-server` / `redis-cli`、已安装 Homebrew Redis/Valkey 或 Docker CLI；有 macOS ARM64 的 clang 和 make。`16379` 当时未观察到监听者，这不是端口预约，启动时必须重新绑定检查。

授权后选择官方 **Redis 8.2.10 核心源码**，不用全局安装或 Homebrew 后台服务。固定下载地址：<https://download.redis.io/releases/redis-8.2.10.tar.gz>；官方 SHA-256：

```
d33935732f7fc15476295fe05f5ce740927bc14847798e47b3f67b4f27b8b478
```

该版本及摘要已在 [Redis 官方摘要清单](https://raw.githubusercontent.com/redis/redis-hashes/master/README) 核实。按 [8.2.10 官方构建说明](https://raw.githubusercontent.com/redis/redis/8.2.10/README.md)，不启用模块，项目私有目录中执行 `make -j2 MALLOC=libc BUILD_TLS=no`，不执行 `make install`。脚本先验摘要，再检查归档成员，拒绝路径穿越、符号链接、硬链接、重复路径和超限展开；私有构建日志保留。

## 缓存与降级机制

独立组件 `PublicCategoryCache` 使用 `StringRedisTemplate` 手动读取/写入，缓存 typed JSON，不使用 Java 原生序列化或任意类反序列化。只存 `categoryId/code/name/shortName/imageUrl/sortOrder`，不存 API envelope、traceId 或用户信息。

键格式为：

```
freshmall:cache:v1:<HMAC-SHA256>:public:categories
HMAC key = APP_TOKEN_SECRET
HMAC message = "freshmart:catalog-cache:v1\n" + DB_URL + "\n" + APP_PUBLIC_ORIGIN
```

数据库 URL、签名密钥和访问令牌不出现在 Redis 键、指标标签或日志里。新恢复 schema、密钥或 public origin 会得到不同命名空间；Python 运行脚本与 Java 有相同固定测试向量。若部署改变这三项，必须重新生成对应私有 ACL，不能宽放键权限来掩盖不匹配。

JSON 有格式版本和命名空间标记；读取限制 64 KiB、100 个分类、嵌套深度与字符串长度，拒绝多余/缺失字段、重复 JSON 字段、隐式类型转换、重复分类、非法 ID 和无效 URI。坏缓存读取数据库并覆盖；空库不缓存空数组，坏条目遇到空库时删除。合法数据库结果即使超出缓存自限仍按原接口返回，只跳过缓存。

每次 SET 与 TTL 原子提交，默认 55–65 秒，避免永久缓存和集中到期。未提供分类编辑 API，所以当前没有声称已实现后台事件主动失效；未来开放分类编辑时，必须在数据库提交后对精确键失效。任何失效故障最多保留 TTL 窗口的公开分类元数据，不延伸到商品在售/报价逻辑。

Redis GET/SET/DEL 失败只捕获缓存边界异常，返回真实数据库加载结果，并开启默认 3 秒短熔断；冷却期内直接查询数据库，不让每个请求反复等待连接超时。同一请求 GET 失败不再尝试 SET。数据库异常在缓存 catch 之外传播，禁止伪造成功、空列表或内存旧数据。

原 `@Cacheable` 默认错误处理会传播缓存异常，且同类自调用不经过代理，因此本轮不直接加注解。[Spring 缓存注解说明](https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html)、[默认错误处理实现](https://raw.githubusercontent.com/spring-projects/spring-framework/v7.0.9/spring-context/src/main/java/org/springframework/cache/interceptor/SimpleCacheErrorHandler.java)。Spring Data Redis 默认缓存没有过期时间且使用 JDK 序列化，本实现明确配置 JSON 和 TTL，不调用清空全库的操作。[RedisCache 默认行为](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)。

## 配置与隔离运行

默认 `APP_CATALOG_CACHE_ENABLED=false`，禁用时不触发 Redis 连接。根代理配置了 `spring.data.redis.connect-timeout=100ms`、`timeout=150ms`、Lettuce shutdown timeout 100ms、Redis repository discovery 关闭。`management.health.redis.enabled=false` 保持可选缓存故障不使整站健康检查失败；这不隐藏数据库健康问题。[Boot 配置属性](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)。

Lettuce 通过 Boot 的 [ClientOptions 定制接口](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/redis/autoconfigure/LettuceClientOptionsBuilderCustomizer.html) 使用 RESP2，断线拒绝排队、队列上限 32、关闭维护推送。RESP2 认证不要求 HELLO；Lettuce 的 CLIENT SETINFO 元数据失败不影响连接，无需授予管理命令。[7.5.2 握手源码](https://raw.githubusercontent.com/redis/lettuce/7.5.2.RELEASE/src/main/java/io/lettuce/core/RedisHandshake.java)。不配置 `clientName`，Redis database 固定 0。

`scripts/redis-runtime.py` 的所有实例在 Git 忽略的 `.runtime/redis-cache/` 内。仅监听 **127.0.0.1:16379**、protected mode 开启，32 MiB 内存上限、LRU、无 RDB/AOF；缓存不是业务备份的一部分。默认用户关闭，应用随机独立 ACL 只允许精确分类键的 GET/SET/DEL 以及 PING；独立私有 auditor 仅增加 INFO/PTTL/ACL DRYRUN 用于证据，不向应用提供其凭据。

私有目录 0700，凭据、ACL、环境和进程记录 0600。启动核对固定二进制摘要、配置摘要、端口和命令；`set-proc-title no` 保留准确命令行用于所有权检查。停止只 SIGTERM 已记录且启动时间/完整命令均匹配的 PID，拒绝 PID 复用与不明进程，不执行全局 `redis-cli shutdown` 或强杀。主后端、MySQL、Vite 不由这个脚本控制。

```bash
# 只构建，不创建应用 ACL、不启动 Redis
python3 scripts/redis-runtime.py build

# 路径必须由根代理给出；脚本读取 literal JSON/export，不执行其中的 shell
python3 scripts/redis-runtime.py prepare --source-env /absolute/private/backend.env.json

# prepare 输出实例目录；以下均须显式选这个目录
python3 scripts/redis-runtime.py start --instance /absolute/.runtime/redis-cache/instance-...
python3 scripts/redis-runtime.py probe --instance /absolute/.runtime/redis-cache/instance-...
python3 scripts/redis-runtime.py stop --instance /absolute/.runtime/redis-cache/instance-...
```

根代理将实例的 `client.env.json` 作为私有覆盖环境合入独立后端进程，不复制凭据到命令行、Git、文档或测试截图。脚本同时提供 `REDIS_*` 和 `SPRING_DATA_REDIS_*`，与当前 YAML 占位符及环境属性绑定兼容。禁止为了快速演示修改主库、停主后端或把默认 6379 的其他 Redis 当成本实例。

## 证据验收表

源码单元测试中的 mock 仅验证边界，**不是 Redis 已运行的证据**。真实 HTTP 验证由根代理安排的隔离后端和全新恢复库执行，当前主库不承担故障注入。

| 验证 | 必须保留的真实观察 |
| --- | --- |
| 冷读 | HTTP 200、真实分类、`miss/db_load/write` 增量、精确键 TTL 55–65 秒 |
| 第二次读取 | HTTP 分类相同；应用 `hit` 增加；`db_load` 不增加；Redis GET 命令统计增加 |
| 坏 JSON/错命名空间 | `invalid/db_load/write` 增加，真实数据库结果返回，之后恢复 hit |
| 正常 TTL 到期 | 真实 PTTL 到期后下一次 miss，重新 DB 加载并写入 |
| 已拥有的 Redis 停服 | HTTP 200、数据库真实结果、短熔断 bypass；应用健康 UP；耗时记录真实值 |
| Redis 重启 | 无持久旧缓存，先 miss 再 hit，业务数据不变 |
| 权限边界 | ACL DRYRUN 确认精确键可读写，FLUSHALL/CONFIG/KEYS/EVAL/外部键被拒；不真执行破坏性禁令 |
| 不影响交易 | 原商品、库存、报价、支付与售后回归仍通过；不依据分类缓存指标推算整体商城性能 |

指标 `freshmall.catalog.cache` 仅有固定的 `cache=public_categories` 与 `result=hit/miss/invalid/redis_error/db_load/write/disabled/bypass` 标签。没有用户/URL/schema/key 维度，避免泄密和高基数。指标入口沿用现有 ADMIN/监控抓取认证，不新增匿名诊断接口。

实际执行：Redis runtime 12 项、工程 runtime 24 项 Python 离线安全测试共 36 项通过；分类 Java 9 项边界测试通过。根代理构建快照 `20261018T071320Z-e9b367d1` 的全量 192 项后端测试为 0 失败/错误/跳过，JaCoCo 行覆盖 2029/(2029+122)=94.33%；这些数字属于该源码快照，不是浏览器覆盖率或线上运行指标。

官方固定源码已经 SHA 校验并在本机完成核心编译，二进制 SHA-256 为 `03bcb53683d831c79c298fc81da3ed368c3763e2f5c639c1372a8cfd23495973`。以隔离环境 `.runtime/engineering/v030/private/backend.env.json` 的冻结身份生成精确 ACL，真实 Redis 8.2.10 于 127.0.0.1:16379 启动并 PING=PONG；DRYRUN 验证应用可读写精确键、六项超范围命令均被拒绝。

经根代理明确授权，独立工程后端 `127.0.0.1:18081` 使用全量通过的 JAR `aa267f513059bad34a0538b2fb0570af6a81ef6dba11ec7451d72e728ef4b4c5` 启动。仅新恢复 schema 从 V012 升级 V013。`engineering-runtime.py` 在首次启动前用该库独立账号撤销 105 个快照导入的 ACTIVE 会话并写一次性标记；这是原始数据往返校验之后的安全初始化，后续重启不重复撤销，不改密码、原 `recovery.json` 或备份校验值。更换 JWT/CSRF 密钥本身无法撤销 opaque refresh token。启动前后 18 条 outbox 原列摘要相同，commerce jobs 保持 false；本轮缓存验证不处理订单。

`verify-redis-live.py` 完整真实运行通过，公开无凭据证据见 [summary.json](evidence/redis-v030/summary.json)，分阶段实际计数/HTTP、原失败说明、构建源码摘要与工程启动记录均在同目录：

- 8 个分类冷读真实写入 Redis，初始剩余 TTL 62165ms；再次命中时 `hit` 加一、`db_load` 不增加，Redis GET 命令统计同时增加。
- 坏 JSON 与另一命名空间身份各一次，均 `invalid/db_load/write` 加一，修复后返回同样的数据库分类数据。
- 只停止已拥有的 Redis，4 次分类请求均 200、健康仍 UP；耗时依次 3.724/1.985/2.289/1.818ms，`redis_error` 加一、后 3 次为 breaker bypass。这些是本机单次观察，不推算公网延迟或整体吞吐。
- 重启真实 Redis 后先 miss 再 hit；自然等待 59.262 秒，实际 PTTL 由剩余 59229ms 到 -2，下一次请求 `miss/db_load/write` 各加一。
- 最终 Redis 已恢复 PING=PONG，六项越界 DRYRUN 仍被拒；Java PID 在整轮缓存验证中保持不变。共保留 28 次实际 HTTP 观察（分类、metrics、health）。

私有原始摘要 SHA-256 为 `c6e6d97a9f3ce2efe8e2215ded1767b89112135a9a81b31cf220adda53d782cc`。验证结束后已释放独立 Java 窗口，后续退款故障/监控步骤由根代理协调，不把缓存结束时状态冒称为之后所有时刻的状态。

失败记录保留：Python urllib 对固定公开下载 URL 获得 HTTP403，换用相同地址的 curl 得到 200 后验证固定摘要；未因下载失败执行未验证代码。首次 Redis 配置将中文路径写成 `\\u...`，导致找不到数据目录并退出；修复为真实 Unicode 路径，原配置/日志私有保存在 `.runtime/redis-cache/attempt-unicode-config-*`，新增离线回归测试。首轮 Java 缓存测试在 Mockito 已配置异常后再次用 `when(mock.get()).thenReturn(...)`，配置动作自身触发异常；更正为 `doReturn` 后保持所有回退/计数断言，最新全量通过，原失败快照保留。未停止主应用或修改主数据库。Linux、Docker、Railway 本轮均未执行 Redis 验证，也未创建云资源。
