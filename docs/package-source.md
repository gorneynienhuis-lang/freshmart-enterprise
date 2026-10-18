# 源码、SQL 与部署文件交付包

`scripts/package-source.py` 只打包显式指定 Git 提交的 tracked 普通文件。它通过 `git ls-tree` 和 `git cat-file --batch` 读取 Git 对象；当前工作树的修改、未审阅原始材料、未跟踪截图以及正在运行的数据库都不是输入。脚本不进行 Git 写入、远端上传、Release 创建或服务启停。

## 创建和复核

在项目根目录运行，使用已审阅的提交 SHA，不接受 `HEAD`、分支名或省略提交：

```sh
python3 scripts/package-source.py --commit 98ac1c2
```

默认输出位于项目外的 `../交付成果/`，每次创建独立版本目录，名称包含完整提交的前 12 位、UTC 时间和随机后缀，不覆盖旧包。可以用 `--output /绝对路径/交付成果` 指定另一个位于仓库之外、没有符号链接的目录。目录在本机创建，文件不会自动上传 GitHub。

成功后交付目录包含：

- `freshmart-enterprise-<SHA前12位>-source.zip`：源码位于 `freshmart-enterprise/` 下，外层有交付说明与 manifest。
- `SOURCE-MANIFEST.json`：与 ZIP 内相同，记录完整提交 SHA、每个文件的 SHA256、Git blob OID、字节数和执行权限，以及排除项及其 Git 完整提交链接。
- `SHA256SUMS`：ZIP 和外层 manifest 的散列；manifest 不声称能包含自身散列。
- `DELIVERY-README.md`：所选提交、启动入口、运行环境边界和账号私下交付说明。
- `VERIFICATION.json`：重新打开 ZIP 后逐项校验的真实结果，以及创建路径和时间。

使用输出中的实际路径和从可信渠道取得的 SHA 再次复核：

```sh
python3 scripts/package-source.py --verify '/实际交付目录/freshmart-enterprise-<SHA前12位>-source.zip' --expected-sha256 '<实际ZIP的SHA256>'
```

复核过程不解压执行代码：它检查成员路径、跨平台大小写/Unicode 冲突、普通文件类型、资源限额、精确成员集合、文件数量及总字节，并重新计算每个文件的 SHA256 和 Git blob OID。任何未列入 manifest 的成员、内容/权限改动或不安全路径都会失败。散列用于完整性核验，不是数字签名；如果攻击者同时替换 ZIP、manifest 和所有外层散列，必须通过可信渠道的预期 SHA 才能识别。

## 包含范围和安全边界

默认保留所选提交的 `frontend/`、`backend/`、`database/`、`deploy/`、`contracts/`、`scripts/`、`tests/`、`assets/`、`design/`、`docs/`、`collab/` 及列明的根目录治理文件；若将来提交了 `.github/`，也按同样的路径与内容检查处理。前端依赖锁、Maven Wrapper、R03/R04 设计源稿和素材、版本迁移、部署与 CI 准备文件、实际测试证据均保留。东华公开参考素材中的已提交原始 `.rar` 仅允许位于 `assets/reference/dhu/original/`，它们是素材来源记录，不是私有项目备份。

以下内容一旦被错误跟踪，脚本会报错停止，不会静默删掉后继续声称完整交付：`.git/`、`.runtime/`、`node_modules/`、`target/`、私有凭据目录、真实 `.env`、密钥/证书私钥、数据库文件或 SQL dump、编译产物、安装包、录屏和未知压缩包。只允许值为空或明确占位符的 `.env.example`。未知源码根目录、符号链接、子模块、Git LFS 指针、超限文件同样要求先审查。源码中必要的 `TokenCodec.java` 等标识符不会仅因名称含 token 被错误删去。

内容检查拦截高置信度 GitHub token、JWT 和 PEM 私钥格式，报错不回显匹配值；这不是覆盖所有可能秘密的通用扫描器，提交前人工审阅仍然必要。SQL 仅允许版本化迁移；MySQL dump 标记、`USE` 或 `CREATE DATABASE` 被拒绝。历史 DDL 证据 `docs/evidence/demo-runtime/mysql-first-start-schema.sql` 是单独审阅的精确路径与 SHA256 白名单（`12c4528f32dd878b57af5c02309128687bc435a91cf04c4718a4727498431fbe`）；不得含数据写入语句，内容变化即拒绝。manifest 明示它不是运行库 dump，也不是初始化入口。

另有三份固定路径与 SHA256 的历史日志例外，均位于 `docs/evidence/implementation-foundation/`：

| 文件 | SHA256 |
|---|---|
| `backend-maven-clean-package-retry.log` | `8e30c597766203f3c0425a1544bdcc9a0a72d6ea2abad5f2d7f570f1880f9c44` |
| `backend-maven-clean-package.log` | `1b79a0d6704f354820429da6b9b6c96a3e821e33a610d768a4d24b0cad35a35a` |
| `v001-constraint-probe.log` | `d216b62d306c8ca35cff405bc87dab5f83d099a310932ca10eabbbbce4e8cf59` |

它们已审阅为历史 H2 内存库构建/约束测试证据，并非当前应用运行日志；manifest 单独记录其性质。任意字节变化或其他 `.log` 都会拒绝，不能借此放入新的运行日志。

可选精简仅针对已归档失败尝试目录内的图片：

```sh
python3 scripts/package-source.py --commit 98ac1c2 --omit-archived-screenshots
```

仅 `docs/evidence/` 下名为 `attempts` 或 `attempt-*` 的子目录中的 PNG/JPEG/WebP/GIF 图片可以省略；JSON、说明、源代码、正常证据图、设计素材不会省略。被省略的 blob 仍接受安全检查，并在 manifest 的 `excluded` 中逐项列出原路径、大小、原因和完整提交的 GitHub 链接。默认不启用该选项。私有 GitHub 仓库须授予老师只读访问后才能浏览历史；ZIP 本身不携带 `.git` 历史，不能代替 GitHub 上的提交记录。

当前账号密码、支付/JWT/监控凭据、私有上传媒体和数据库不会进入源码包。新环境按所选提交的 `deploy/README.md` 初始化合成数据与随机账号，使用 `./scripts/demo-credentials.sh` 在本机私下查看；当前运行实例的账号另行私下交付，不写入包或 Git。源码包不包含已安装的依赖，需要按运行说明准备环境并在初次运行时下载依赖。本机自动启动脚本已验证的系统范围为 macOS ARM64；部署模板存在不等于 Linux 容器、GitHub Actions 或公网平台已经通过验收。

## 可重复性和工具来源

同一提交、执行打包器的 SHA256、选项与 Python/zlib 环境下，源码排序、压缩等级、文件权限和 ZIP 时间戳固定，ZIP 字节可重复。输出目录名称和 `VERIFICATION.json` 创建时间不参与 ZIP 内容，因此独立交付目录之间不会因时间变化导致 ZIP 改变。不承诺跨 Python/zlib 版本的压缩字节完全一致。

manifest 同时记录执行工具自身 SHA256 和 `identical_tool_in_selected_commit`。试打包旧提交时，如果打包脚本尚未属于该提交，明确记录为 `false`，不会把当前工作树的新脚本、测试或说明塞进旧提交包，也不会倒填它们的 Git 历史。最终交付应在主代理审阅并提交这些文件后，再显式指定最终完整 SHA 重打包。

## 本轮实际验证

离线保护测试通过 14 项：

```sh
python3 -m unittest discover -s scripts/tests -p test_package_source.py -v
```

测试使用只读对象存储 fixture，覆盖工作树脏内容隔离、路径逃逸/冲突、危险 tracked 文件、凭据值不回显、dump 与 LFS 拦截、历史 DDL 变更拒绝、精确截图省略、重复打包一致、ZIP 内容与 manifest 篡改、可信外层 SHA、符号链接输出目录等；测试不修改本项目 Git，不访问运行库或网络。

首次对 `98ac1c2b2e31119b610ea93fb11834bc2c46c5da` 试包时，预检拦截了历史 DDL 证据；加入经审阅的精确白名单后，第二次预检拦截了历史 `.log` 构建证据。这两次均未创建交付 ZIP，不能算打包通过。经审阅加入三份固定散列构建日志后，第三次完整打包与回读通过（851 个源文件）；随后只修正交付说明的系统名称并重新生成下述样包。旧样包保留于独立目录，不覆盖。

2026-10-18 08:04:42 UTC 的正式命名样包结果：

| 项目 | 实际结果 |
|---|---|
| 源提交 | `98ac1c2b2e31119b610ea93fb11834bc2c46c5da` |
| 输出目录（本机） | `../交付成果/freshmart-enterprise-98ac1c2b2e31-20261018T080437Z-e05d3e21/` |
| ZIP 文件 | `freshmart-enterprise-98ac1c2b2e31-source.zip` |
| 源文件 / 源字节 | 851 / 188,438,426 |
| ZIP 成员 / ZIP 字节 | 853 / 179,282,204 |
| 排除文件 | 0 |
| ZIP SHA256 | `f0d79444a87fd676c756aaf560edd2f1738b907725bae131165de34eda68de07` |
| manifest SHA256 | `dd7b19af512c96e2758e0f2623a95d9cdf58c9192aed665c50c9af63dea3e7a4` |
| 执行工具 SHA256 | `51729f7b247f83904e91d96ad5a03e3d07e1e5dd0f7638a08b844eaad0beb841` |
| 工具属于所选旧提交 | 否（明确记录为 `false`） |

脚本内置全量回读通过后，又使用 `--verify` 加上述可信预期 SHA 独立打开核验通过；另外将 ZIP manifest 与只读 `git ls-tree` 的 851 个路径、Git OID、权限和字节数逐项独立比较，一致，未发现源码遗漏。外层 manifest/README 与 ZIP 内副本也一致。该样包只代表旧提交的源码归档，不含随后新增的三份正式 MD 文档或本打包器；待主代理审阅提交后将指定最终 SHA 再创建最终包。

本任务不创建 Release、不上传大包、不制作 PPT 或视频、不证明公网部署完成。
