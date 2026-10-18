# 本轮本机实测汇总

2026-10-18。verification.json 汇总真实命令、对应源文件SHA和证据入口；不含账号密码。后端104项、前端34项测试均通过；新员工治理另有真实MySQL/浏览器操作。动态HTTP响应计数以各最终result.json为准。

运行对象是本机MySQL 8.4.11和沙箱支付，V006迁移保留原数据。用户选定R03；design/v2及旧generated/design.json仍与35182fe基线一致。

Java同JAR静态呈现/本机自签HTTPS探针的最终结果另见 ../showcase-package/；自签测试证书不等于公网公信TLS验收。Docker、Railway、外网访问、云端恢复仍需目标环境实际完成。
