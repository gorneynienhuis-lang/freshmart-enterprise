# CI 与干净 Linux 验收准备

当前交付是本地可审阅模板，**没有写入 `.github/workflows`、没有 Git/远端写入，没有申请 Workflow 授权或运行 GitHub Actions**。本机是 macOS arm64；Docker、Podman、Colima、nerdctl、Lima 均未在 PATH 找到，Docker/Podman Desktop 应用也未找到。没有安装或启动容器工具，没有做 Linux 容器、镜像层拉取、云平台上线或公网 TLS 验收。

入口为 [workflow.yml.template](../deploy/ci/workflow.yml.template)。根代理在审阅并处理现有 GitHub 凭据的 Workflow 写入权限后，才能另行安装到 `.github/workflows/ci.yml`。本轮不会因现有 Contents 授权而推断已获新增权限。模板默认仅 `contents: read`、checkout 不保留凭据，不使用生产/演示账号、部署密钥或仓库 Secrets，不发布镜像、不部署，不采用 `pull_request_target` 或执行 PR 标题等用户文本。[GitHub 安全参考](https://docs.github.com/en/actions/reference/security/secure-use)

## 验证安排

| 层次 | 模板执行内容 | 当前真实状态 |
| --- | --- | --- |
| 模板/配置静态检查 | Ruby Psych 安全解析 YAML、Python tomllib 解析 Railway、动作 SHA/权限/端口/卷检查 | 本机已运行通过；不是 GitHub 工作流语义或 Docker Compose 引擎验收 |
| CI 控制器保护 | 隔离副本不带主 target/macOS node_modules/私有凭据、拒绝链接源/输出、去除主应用环境变量、无执行开关不启动构建 | 五项本机离线测试通过，无服务/数据库/下载 |
| 合同 | `node scripts/validate-contract.mjs` | 新 CI 驱动已准备，本轮未重新执行；它是静态合同检查，不代表实际 API 全覆盖 |
| 前端 | 新副本 `npm ci` → verify（生成漂移/typecheck/test）→ test:coverage → build | 未通过本 CI 驱动执行；未复用宿主 macOS node_modules |
| 后端 | Java 21、Maven wrapper `verify -Pcoverage`；读取实际 Surefire XML，零测试/失败/错误/跳过均不算通过 | 本 CI 驱动未执行；此前主代理全量结果属于既有 macOS 验收，不能移作 Linux CI 证据 |
| 备份/恢复/运行脚本 | `unittest discover scripts/tests`、监控控制器测试、CI 控制器测试 | 命令已接入，完整脚本组本轮未重跑；不停止运行服务或触主库 |
| Linux 镜像 | 同 JAR Railway、独立 backend、独立 web 三个 Dockerfile 构建 | 未运行；本机缺容器引擎 |
| Linux 运行与卷 | 全新隔离 MySQL+同 JAR app，真实健康/API/JS/CSS、权限拒绝、安全 Cookie 配置；重建容器后数据库标记和媒体文件仍存在、迁移数量不变 | 未运行；手动开启的独立 CI job，失败应阻止该次验收，不静默跳过 |
| 公网部署/完整业务浏览器链路 | 不在本模板范围 | 未运行；不能宣称 Railway、公开 TLS、Caddy ACME、完整 Linux 业务 E2E 已验收 |

常规 PR/push 只执行源码验证 job；手动触发并勾选 `containers` 才执行依赖它的 Linux 容器 job。镜像 job 使用全新、随机 `fmci<hex>` Compose project，无外部卷/网络、无数据库宿主端口，app 仅映射回环随机端口。它不复用主 `deploy/compose.yaml`、`.env`、数据库、媒体卷或演示凭据，不占用 8080/5173/3306。

当前根代理报告工作分支为 `demo/v0.1.1`，模板的 `push.branches` 仅为 `main`。即使将来安装模板，直接 push 当前 demo 分支也不会匹配这个 push 触发器；PR 和手动触发还需工作流真正激活并满足平台规则。本轮没有激活或运行，因此不能把当前分支的 GitHub 上传记录称为 CI 通过记录。激活和平台授权以后由根代理在正式部署阶段统一处理，不扩大现有 PAT 权限。

## 版本与来源

锁文件 [dependencies.lock.json](../deploy/ci/dependencies.lock.json) 保存 2026-10-18 从官方仓库发布与 tag 对象解析出的完整 40 位 commit SHA；模板引用 SHA，不引用浮动主版本标签。当前是 checkout v7.0.1、setup-node v7.1.0、setup-java v6.1.0、setup-python v7.0.0、upload-artifact v7.0.2。[官方 checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node)、[setup-java](https://github.com/actions/setup-java)、[setup-python](https://github.com/actions/setup-python)、[upload-artifact](https://github.com/actions/upload-artifact)

目标运行版本为 Node 26.12.0、Temurin 21.0.12.1+1、Python 3.14.7、Maven 3.9.16 / wrapper 3.3.4。actions/setup-java 的具体四段补丁版本解析、setup-node/setup-python 的 runner 下载可用性尚需实际工作流验证；本地安装版本不等于 CI 安装通过。本机观测 Node 26.8.1、npm 11.19.0、Temurin 21.0.12.1+1、Python 3.14.7、Ruby Psych 3.1.0，详见静态报告。Ubuntu 24.04 runner 标签固定发行版，但宿主镜像会更新，不把它描述成完全冻结的 OS 字节镜像。[官方 runner 软件清单](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)

五个既有精确镜像版本来自当前部署配置（Temurin JDK/JRE、Node、Caddy、MySQL）。本轮只读访问官方 Docker Hub registry：manifest 实际响应的 SHA256 与 `Docker-Content-Digest` 相同，并确认存在 linux/amd64 描述符；锁定为 `repository@sha256`。**这只是 registry 元数据核验，不是 `docker pull` 或二进制运行证明。** 主部署文件和主镜像锁未修改；CI 独立锁不会伪称主 `deploy-public.py lock-images` 已完成。

当前主 Maven wrapper 没有 `distributionSha256Sum`。CI 驱动不修改它，而是在显式执行时读取同一发行包、核对已记录的[官方 Maven Central SHA512](https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.16/apache-maven-3.9.16-bin.zip.sha512)，派生 SHA256 仅填入一次性源副本的 wrapper 属性。Docker 构建也使用这份副本；未执行时不宣称发行包摘要已验证。本地报告中的应用源指纹和此项副本覆盖需分开解释。

## 本地复现与证据

以下两条轻量命令已在本机真实运行：

```sh
python3 deploy/ci/check.py
python3 deploy/ci/test_guards.py
```

结果在 [static-verification.json](../deploy/ci/static-verification.json)；第一次 YAML 检查发现两个 flow-list 卷路径需加引号，修复记录保存在 `static-attempts.json`。静态检查使用已有 Ruby 标准库 Psych，没有安装 PyYAML/actionlint，也不将这些自定义断言称为 GitHub Actions 引擎或 actionlint 的完整校验。

需要执行源码验证时，先与根代理协调构建/压测窗口，再显式运行：

```sh
python3 deploy/ci/verify.py --scope all --execute
# 或单项：contract / frontend / backend / scripts
```

驱动只在 `deploy/ci/.work/<唯一目录>/source` 复制必要源码，排除 `.runtime`、`.git`、node_modules、target、dist、私有部署目录和数据库生成数据。npm 安装、设计导入、生成、前端构建与 Maven target 均写入副本；主 JAR 前后摘要不一致会判失败。子进程不继承 APP_/DB_/REDIS_/SANDBOX_ 主应用配置。没有 `--execute` 时返回未执行，不虚构通过。

在已获准的干净 Linux + Docker Compose v2 环境中运行：

```sh
python3 deploy/ci/container_smoke.py --execute
```

它使用私有随机测试密码/JWT/沙箱密钥；主测试 profile 为 showcase，Cookie 为 Secure，APP_ALLOWED_ORIGINS 为占位的精确 HTTPS origin。实际 HTTP 只在本机回环验证匿名路由和 Cookie 属性，不假装建立了 TLS。数据库持久化通过 CI 自建表的随机标记验证，媒体卷通过 app 身份写入并在重建后读回；不执行真实订单、收费或破坏库存。结束仅对自己的 Compose project 校验标签后 `down --volumes`，不使用全局 prune、不按端口杀进程。Docker 镜像缓存可能保留；未主动删除其它镜像。

报告写入 `deploy/ci/reports/<run>/`：测试输出、Surefire、JaCoCo、版本/源码摘要、容器有限日志和清理状态；日志会遮盖本次生成的秘密。工作流 `always()` 上传 reports，保留七天，不上传 `.work`、数据库目录、媒体内容或凭据。失败报告必须保留；若清理归属不确定会报失败，禁止以全局 prune 掩盖问题。本轮未运行 Docker，因此该驱动的 Docker 引擎兼容性、启动健康、卷权限和持久化结果仍待真实验收。
