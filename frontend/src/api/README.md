# 前端接入基础层

这里是非视觉工程，不包含页面、应用入口或真实后端实现。`schema.d.ts`覆盖当前契约的91个operation；`operations.ts`保留各operation的`CONTRACT_ONLY`状态。类型覆盖与单元测试通过均不表示这些接口已经部署或可调用。

## 稳定入口

- `src/api`：`api`、`auth`、`createMallClient`、`unwrap`、`ApiError`、`createAction`、全部生成类型与operation元数据。
- `src/auth`：`useAuth()`、`AuthController`、`AuthState`、`AuthUser`。
- `src/domain`：`Product/Sku/Cart/Quote/Order/Address/DeliverySlot/PriceSummary`、`ResourceState<T>`、`ProductCardProps`、`OrderSummaryProps`，以及纯显示和权限函数。

Claude的视觉组件只需`import type { ProductCardProps, OrderSummaryProps } from '../domain'`等类型，并接收props与事件。Codex维护数据适配与网络调用；视觉层无需重复研究接口、计算成交金额或推断服务端状态机。通用props是可复用基础，不规定版式或颜色。

```ts
import { api, auth, unwrap, createAction, ApiError } from './api';

// 应用启动时调用一次。无有效cookie时返回anonymous；网络错误向上抛出。
await auth.restore();
await auth.login({ phone: '13800138000', password: passwordFromForm });
const products = unwrap(await api.GET('/api/v1/products', {
  params: { query: { page: 1, size: 20 } },
}));

// 在用户明确确认下单时创建，并在挂起/结果未知/人工重试期间保留同一个action。
const body = { quoteId: serverQuote.quoteId, quoteToken: serverQuote.quoteToken };
const action = createAction('POST', '/api/v1/orders', body);
try {
  const order = unwrap(await api.POST('/api/v1/orders', {
    body, params: { header: action.headersFor(body) },
  }));
} catch (error) {
  if (error instanceof ApiError) {
    // 展示message/traceId。outcomeUnknown时先查询结果；不要自动重新下单。
    // 如401，显式恢复会话后由用户重试同一action，仍使用同一key与payload。
  }
}
```

`api`使用完整契约路径，例如`/api/v1/orders`；`origin`只接收主机地址，不再附加`/api/v1`。默认浏览器同源，可由Codex的Vite代理转发；独立服务可创建一次`createMallClient({ origin: 'http://localhost:8080' })`并统一注入。禁止为每个组件创建一个client，否则它们不共享刷新单航班。Node测试默认本地8080。

Cookie会话端点通过`auth.ensureCsrf/login/register/refresh/restore/logout`暴露，避免直接请求绕过轮换协调。改密通过类型化`api.POST('/api/v1/auth/password', …)`，成功后自动清除内存会话。`useAuth`是状态订阅，不替UI决定跳转。`mustChangePassword`需要由应用接线只开放个人会话/改密/退出，服务端仍须独立执行此限制。

## 请求与重试边界

- Access token仅内存；不读写localStorage/sessionStorage；refresh cookie由浏览器保管；所有请求`credentials: include`。重定向不携带凭据继续请求。
- CSRF从真实端点取得，接近到期时续期，登录/刷新响应同时更新内存CSRF。Origin由浏览器生成；后端配置显式CORS/Origin allowlist、Cookie属性与CSRF校验。
- 同一个实例的refresh合并为单个请求；迟到的旧401使用已更新token。支持Web Locks的浏览器还串行同源标签页刷新，并在持锁后重新获取CSRF。不支持Web Locks时仅保证当前实例单航班；不应宣称跨标签页轮换测试已经完成。
- 仅受保护GET/HEAD遇401最多恢复并重读一次。刷新失败后停止后台自动刷新，等待显式恢复/登录，防止网络结果未知时重复使用轮换token。
- POST/PUT/PATCH/DELETE均不自动重放，包括支付、库存及带幂等键请求。401、409、503、网络中断都交还调用层。`retryable`只来自服务端提示，不触发自动请求。
- 同一个业务动作的payload保持一致，人工重试复用`createAction`返回的key；payload改变必须创建新动作。操作方法与路由也必须保持一致。服务端仍须持久化幂等结果并验证请求哈希。
- `ApiError`区分http/network/aborted/protocol/session，保留真实HTTP status、业务code、errorKey、traceId、retryable和outcomeUnknown。不会把HTTP200里的业务错误当成功，不保留请求正文或令牌。

`formatMoney`只把整数分精确显示为元；`formatWeight`只显示整数克。`hasPermission`不提供ADMIN通配符，`allowsOrderAction`只采用服务器allowedActions。这些都是UI提示，不能代替服务端资源授权、职责分离、金额或库存校验。

## 可复现验证

依赖已精确锁定于package-lock.json。Node要求>=26；TypeScript5.9.3满足openapi-typescript7.13.0的官方peer约束。

```sh
npm ci --ignore-scripts
npm run generate:api  # 仅在contracts有已批准变更时重新生成
npm run verify       # 生成文件漂移检查、tsc、Vitest
```

当前测试使用明确的fake fetch，验证前端行为；没有执行真实浏览器Cookie/CORS、后端API或端到端验收，也没有UI入口可构建。不得把这些结果改写为系统联调已完成。官方工具依据：[openapi-fetch文档](https://openapi-ts.dev/openapi-fetch/)、[middleware/auth](https://openapi-ts.dev/openapi-fetch/middleware-auth)、[API](https://openapi-ts.dev/openapi-fetch/api)。
