# Codex 与子代理工作约定

用户指令优先。先读README、collab/codex/PRIORITIES-003.md、collab/codex/OWNERSHIP-002.md、contracts/BASELINE.md和双方最新交接。原始队友交付为只读参考资料。

Codex负责 contracts、backend、database、deploy、docs、scripts、tests 及根目录治理文件；前端API/类型、mock、状态、鉴权、数据接入、业务校验、工程配置、联调和构建测试归Codex。Claude只负责 design、frontend/src/ui、frontend/src/styles、frontend/public/brand 中的品牌、视觉组件、页面样式和视觉修正。presentation归属保留，但PPT制作与扩写当前全部暂停。不要替用户确认视觉。子代理只写父代理指定文件；Git操作由主代理统一执行。

业务与工程选择由Codex决定并记录，不要求用户审批常规细节。用户只确认设计方案、配色、布局、交互呈现和关键界面；当前不推进PPT方案。真实收费或敏感账户授权单独处理，不推断已获授权。

当前先集中完成可运行程序、核心业务闭环、真实接口联调与测试。文档只维护必要契约、复现步骤、交接及实际验证证据；不扩写PPT提纲、视频分镜或演示包装。保留既有文档和素材，PPT暂缓不取消最终课程交付。

实现前读统一状态机/权限/接口；依赖版本核实并锁定。Controller→Service→Mapper，数据库为库存资金真相；审计、幂等、资源授权与补偿不是可选装饰。禁止把mock当实装，未运行测试不写通过，不编造历史AI记录。发现跨文档矛盾先统一契约再编码。

每次交付写独立 `collab/codex/CODEX-xxx.md` 和实际AI记录；契约变更递增版本并说明差异。不要与Claude同时改共享日志。现有私有仓库见README；不另建仓库，不提交密钥和未审阅原始文件。

用户要求每个已交付的前端视觉版本可回溯：Codex为每版保存独立commit、递增UI标签、源码/必要素材/截图及用户确认状态并推送GitHub，索引见collab/codex/UI-VERSIONS.md。候选稿即使未采纳也保留，不把归档当批准；禁止为回溯而reset/checkout覆盖共享工作目录中的新稿。Claude继续不操作Git。
