# 答辩录制材料

按用户提供的29页`freshmart-defense-修复版.pptx`编写，原PPT未修改。当前用户已明确授权PPT评价、试走和15分钟录制指南，本任务不受此前“PPT暂缓”范围限制；未扩展为重做PPT或制作最终视频。

- [完整操作指南](15分钟汇报录制指南.md)：PPT评价、逐页14:20时间表、A—J录屏与实际入口。
- [速查表](录制速查.md)：切走与返回页码。
- [离线阅读](开始阅读.html)与[演示证据台](演示证据台.html)：浏览器打开下载后的本地文件，不需要在线依赖。
- [本次真实排练记录](../evidence/recording-rehearsal-20261024/README.md)。

## 本机准备

```sh
cd '/Users/djy/Desktop/实验四/fresh-mall'
python3 docs/recording/start-rehearsal.py
python3 docs/recording/recording-assistant.py status
```

排练启动复用当前保留数据与JAR，项目便携MySQL监听3307，避开3306上的Homebrew MySQL。不是通用冷安装器，不调用seed、不清库、不重置密码；遇到非本项目进程不结束它。商城5173、后端8080均保持回环监听。

## 录屏辅助命令

```sh
python3 docs/recording/recording-assistant.py permissions
python3 docs/recording/recording-assistant.py throttle
python3 docs/recording/recording-assistant.py idempotency
```

- `permissions`：读取接口，展示401和四个角色的403。仅创建并注销本轮登录会话。
- `throttle`：仅对通过本地库确认不存在的随机合成手机号发起6次故意失败请求。不会以现有七个账号做错误密码测试，不关闭限流。
- `idempotency`：创建一笔未付款合成订单，同键重放、异体409，结束后通过正常取消释放库存预占与名额。不付款，不作用于用户的其他订单。
- 所有请求固定到`127.0.0.1:8080`，不接受公网目标。密码从本机Git忽略配置读取，输出不包含密码、Cookie、CSRF值或access token。
- 复制到项目外运行时，需要`--project /完整项目路径`。本地密码若已手工修改与私有配置不一致，脚本会停止，不尝试重置或猜测。

命令已实际运行；不将其数量并入历史195项单元/集成测试。监控与退款故障在证据台按10月18日历史真实记录回放，不伪装成当前现场故障。PPT中另引的Linux `shots/new/`与wrk原始资料当前未取得，指南明确说明该范围。
