# R04真实页面证据

- readonly-smoke.json：首页/列表/详情、1440与1024、R03对比、真实分类排序/规格/价格与版本切换；可用frontend/npm run test:ui复现。截图前将lazy图片临时改eager，仅改变截图加载优先级，未mock接口。
- business/result.json：最终真实五角色链路，163响应schema通过；其screens列表为该次实际截图。测试创建合成账号和本地沙箱订单，不产生真实收费。E2E_OUTPUT_DIR相对仓库根目录。
- mobile.json：390宽首页/列表/详情，只读真实页面，无溢出/缺图/页面异常。
- r04-workbench-{picker,courier,service,finance}-1024.png：独立只读复核实际登录四岗位页面，宽1024，无越界控件/异常或错误权限提示。
- list-r03-1440.png与detail-r03-1440.png：按用户要求另拍的旧版真实页面，配合旧首页和历史结算验收截图构成gallery。

摄影素材与生成提示词见design/r04/ASSETS.md。所有数据来自本机真实API；页面仍标示课程Demo/沙箱/候选。未在本轮修改或重测后端单元测试；完整功能边界见CODEX-014与docs/demo-v0.1.md。
