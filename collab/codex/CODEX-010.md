# CODEX-010 · 真实业务 Demo

日期：2026-10-18。当前用户授权 Codex 全权负责后端、接口和真实交互，暂不需要 Claude；本轮没有联系 Claude。视觉继续沿用其已交付素材，不能替用户确认。PPT暂停。

## 本轮落地

- V003 checkout、V004 commerce、V005 aftersale，与身份/目录基础联通。
- Controller→Service→MyBatis→MySQL；库存、预约、券和资金变更均持久化；显式角色/资源范围、幂等、版本、审计/outbox。
- 下单、沙箱支付、拣货称重、退补差、发货签收、取消/过期、实物回库、SHORTAGE/LATE售后和独立财务退款。
- 前端导入Claude六页设计与本地素材，移除原演示脚本；真实API驱动商品、购物车、订单和员工操作。工程表单未冒充最终视觉稿。
- 本机便携MySQL 8.4.11 + Java21 + Vite，随机凭据只保留在Git忽略的.runtime（0600）；只监听127.0.0.1。详见deploy/README。
- 合同0.1.1统一克/件数量语义和财务字段投影；58项路由有Demo实现，33项仍未实现，不用路由数量代表所有分支验收。

## 已验证

1. 后端全量clean package（H2 MySQL兼容模式）：93项、0失败、0错误。之后新增全缺货全额退款回归、修正锁序/错误码，Commerce 11项及package通过；当前测试集总数94，并非一次全量94运行。真实MySQL验证单独见第4—6项。
2. 前端：28项Vitest通过，生成类型一致性、TypeScript与生产build通过。
   另从提交0d3de40执行git archive导出干净源码，独立npm ci安装81个包后再次运行verify与build，28项测试、类型检查、六页设计及本地素材导入、生产构建全部通过；证明前端构建不依赖工作区未提交文件。此次npm审计报告0 vulnerabilities，不等于全面安全审计。
3. 合同：91项操作、172 schemas、1971静态结构/示例检查通过；独立OpenAPI/JSON Schema标准校验731个请求响应示例通过。
4. 真实MySQL：5个Flyway迁移全部成功；种子7账号、40商品、45SKU、136批次；31个真实外键、全InnoDB；Hikari连接实查READ-COMMITTED。V001首次迁移因TIMESTAMP默认精度不符失败，补(6)后在已核验0业务行的新演示库重新执行成功，没有清理已有用户业务数据。
5. 真实HTTP并发：6个不同会员竞争最后库存（不同slot）仅1成功；6人竞争最后配送名额仅1成功；6次同键只建1单；无认证/越权/错误岗位/客户端价格/错误签名/金额伪造全部被拒绝。6次相同签名渠道事件仅1次入账，取消后仅1次退款成功。探针隔离商品已下架、测试订单已取消，保留审计证据。
6. 浏览器五角色真实全链路通过：注册、搜索、购物车、地址、报价含新人券、支付失败重试成功、刷新恢复、450克实拣退差、交接发货、凭码签收、售后申请/审核/财务退款；175个真实HTTP响应符合schema，0页面JS异常、0缺图。首次schema门禁发现并发探针的合成商品相对imageUrl不合合同，修正隔离夹具URI后重新跑全流程通过，未修改原并发结果。1440/1024首页无横向溢出；1024五列6商品与服务牌留白仍为视觉待优化项。

## 证据入口

- docs/evidence/demo-runtime/runtime-live-ready.json
- docs/evidence/demo-runtime/probe-73df193503bc-results.json
- docs/evidence/demo-runtime/contract-standard-validator.json
- docs/evidence/demo-runtime/contract-static.txt
- backend/target/surefire-reports/（本机构建产物）
- /private/tmp/fresh-full-package.log、fresh-commerce-final-package.log、fresh-mysql-compat-package.log（本机验证日志）
- docs/evidence/demo-runtime/browser/result.json（最终175响应记录与选定截图）；完整13张截图保留frontend/test-results/demo/

## 限制与后续

QUALITY证据媒体、评价提交持久化、运营商品/批次编辑、盘点与重分配、配送异常、员工管理、对账、完整监控、备份恢复与生产部署尚未完成。退款渠道为本地持久化沙箱；worker保留同业务号延迟重试，有限重试/人工处理队列尚待完成，不能宣称外部渠道完整故障恢复通过。6客户端短时守恒检查不等于压力测试或QPS承诺。页面仍有待用户确认的工程操作表单。

启动入口、体验路径和账号读取方式见docs/demo-v0.1.md。当前保留服务运行便于用户体验。用户随后明确要求GitHub版本控制：使用现有私有仓库和独立demo/v0.1.1分支，排除凭据与运行数据；实际推送结果另记，不新建仓库、不制作PPT。
