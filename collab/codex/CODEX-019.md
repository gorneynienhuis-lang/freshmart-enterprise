# CODEX-019 · CI与Linux验收准备

2026-10-18，紧接工程提交`e52b52e`。该提交及`demo/v0.3.0-engineering`已推送并由真实`ls-remote`核验；记录见`docs/evidence/release-v030/github-push.json`。本增量不改后端业务、UI、数据库和运行服务，主Demo保持UP；用户暂缓的批量并发没有执行。

新增`deploy/ci/`独立工作流模板、源码副本验证驱动、可选Linux容器与卷持久化烟测、独立Compose及动作/镜像依赖锁；具体执行范围见`docs/ci-plan.md`。所有源码构建需显式`--execute`，只写唯一副本；容器需Linux+Docker，仅管理自己的随机project、私有随机配置和卷，数据库不映射宿主端口，不复用主库/卷/凭据。

本机真实通过：模板YAML/JSON/TOML静态检查（8个动作引用）、5项离线隔离保护测试及4文件Python语法检查。首轮Compose flow-list字符串缺引号的静态失败保留并修正。只读核验官方Actions发布SHA、五个镜像manifest digest及linux/amd64描述符；没有拉取镜像层或执行二进制，不把元数据当运行验收。

本机无Docker/Podman/Colima/nerdctl/Lima，未安装或启动。本轮不写`.github/workflows`、不激活Actions、不扩大PAT权限；当前工作分支`demo/v0.1.1`上传不代表CI通过。模板push仅main、另有PR和手动触发，激活及对应平台授权留在正式部署阶段处理。Linux构建、健康、卷权限、持久化、平台HTTPS和完整业务仍待实际运行，未伪称完成。

只将可审阅模板与真实静态结果单独commit/push，原始私有目录、缓存和构建输出被忽略；最终仍以远端SHA核对为准。PPT与视频继续暂停，没有联系Claude。
