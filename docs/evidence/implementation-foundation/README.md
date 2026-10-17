# 后端基础实现验证 · 2026-10-18

本目录为实际执行证据。Java 21.0.12.1 / Maven 3.9.16 / Spring Boot 4.1.1；数据库集成测试使用 H2 2.4.240 MySQL 模式，**未验证真实 MySQL 8.4、生产部署或完整订单 HTTP 闭环**。

## 本轮变更

- `IdempotencyService` 同键异体错误改为 HTTP 409 / code 1008 / IDEMPOTENCY_CONFLICT，测试同时断言三个字段。
- `IdempotencyServiceTest` 使用 Hikari 数据源，保留真实数据库事务、回滚、副作用与并发断言。原无池初始化连接关闭后，H2 CHECK-IN 求值引用已关闭 Session，导致首次全套失败；未删除或放宽任何 SQL 约束。
- 同键处理中仍是数据库等待后重放首次结果，尚未实现契约所述“处理中 409、可重试”；不能将当前测试解释为该分支已完成。

## 全套测试与打包

在 `backend/` 执行（未跳过测试）：

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home \
  /Users/djy/.m2/wrapper/dists/apache-maven-3.9.16/56ba1f9f/bin/mvn -B -ntp clean package
```

首次日志 `backend-maven-clean-package.log`：60 项，1 failure、3 errors，均属于上述独立 command 测试数据源问题，未完成打包。

修复后日志 `backend-maven-clean-package-retry.log`：2026-10-18T03:04:54+08:00，BUILD SUCCESS。**60 项、0 failure、0 error、0 skipped**：

| 测试类 | 数量 |
|---|---:|
| IdentityIntegrationTest | 8 |
| CatalogIntegrationTest | 5 |
| IdempotencyServiceTest | 5 |
| InventoryDomainTest | 12 |
| PricingCalculatorTest | 13 |
| OrderLifecycleTest | 17 |

V001、V002 经 Flyway 应用于两个全新 H2 集成数据库。Surefire 原始 XML 与文本报告已复制到本目录。Spring Boot repackage 成功，产物为 `backend/target/fresh-mall-backend-0.1.0-SNAPSHOT.jar`；SHA-256 见 `backend-jar-sha256.txt`。打包成功不表示已启动部署。

## V001 新约束探针

在项目根目录执行：

```sh
/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java \
  --class-path /Users/djy/.m2/repository/com/h2database/h2/2.4.240/h2-2.4.240.jar \
  docs/evidence/implementation-foundation/SchemaConstraintProbe.java \
  database/migrations/V001__identity_catalog.sql
```

实际结果见 `v001-constraint-probe.log`：称重计价克数 NULL、超过安全整数上限、整批隔离仍有预占、报废仍有实物，四次非法写入均被 CHECK 拒绝；合法称重、NORMAL、全隔离、零库存 DISPOSED 均被接受。该探针直接使用 H2 JDBC 与实际 V001，不计入上面的 60 项 JUnit 数量，也不代表真实 MySQL 验证。
