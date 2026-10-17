export interface paths {
    "/api/v1/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 获取Cookie变更保护令牌
         * @description 获取Cookie变更保护令牌
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getCsrfToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 注册基础会员
         * @description 注册基础会员
         *
         *     先调用GET /auth/csrf。注册成功即基础会员。不得客户端传role。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["registerMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 登录会员或员工
         * @description 登录会员或员工
         *
         *     先调用GET /auth/csrf；凭证失败返回真实HTTP401。员工与会员使用同一登录口。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 轮换刷新会话
         * @description 轮换刷新会话
         *
         *     不需要Bearer。校验refresh cookie、Origin、X-CSRF-Token；并行刷新由客户端串行化。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["refreshSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 退出并吊销会话
         * @description 退出并吊销会话
         *
         *     不需要Bearer；有效refresh cookie+CSRF，已吊销可幂等返回成功。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询当前账号
         * @description 查询当前账号
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     permissions与contracts/permissions.md一致，按当前显式角色合并；不含数据范围例外/状态机，前端仅用于菜单提示。
         */
        get: operations["getCurrentUser"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/home": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 首页聚合
         * @description 首页聚合
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     origin/storage公开；arrivedAt/freshness/shelfLifeRemainingDays是当前可售FEFO候选的聚合快照，不含batchId/batchNo/库存台账，无候选为null；结算依据配送时段重新筛选。
         */
        get: operations["getHome"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 商品分类
         * @description 商品分类
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listCategories"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 分页搜索商品
         * @description 分页搜索商品
         *
         *     仅上架商品；所有单价为每件或priceUnitGram克单价；不暴露批次与供应商信息。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     origin/storage公开；arrivedAt/freshness/shelfLifeRemainingDays是当前可售FEFO候选的聚合快照，不含batchId/batchNo/库存台账，无候选为null；结算依据配送时段重新筛选。
         */
        get: operations["listProducts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/products/{productId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 商品详情与可选SKU
         * @description 商品详情与可选SKU
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     origin/storage公开；arrivedAt/freshness/shelfLifeRemainingDays是当前可售FEFO候选的聚合快照，不含batchId/batchNo/库存台账，无候选为null；结算依据配送时段重新筛选。
         */
        get: operations["getProduct"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/products/{productId}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 商品公开评价
         * @description 商品公开评价
         *
         *     匿名/昵称脱敏，不包含订单ID与手机号；只展示可公开评价。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listProductReviews"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询我的购物车
         * @description 查询我的购物车
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。价格仅供参考，最终以下单报价为准。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getCart"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 加入购物车
         * @description 加入购物车
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。按SKU合并数量，不预占库存。GRAM数量表示估重克数。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["addCartItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cart/items/{cartItemId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 删除购物车项目
         * @description 删除购物车项目
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        delete: operations["removeCartItem"];
        options?: never;
        head?: never;
        /**
         * 修改购物车数量或勾选
         * @description 修改购物车数量或勾选
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        patch: operations["updateCartItem"];
        trace?: never;
    };
    "/api/v1/addresses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的收货地址
         * @description 我的收货地址
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAddresses"];
        put?: never;
        /**
         * 新增地址
         * @description 新增地址
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。服务范围由服务端判定，不能用isDefault改变服务范围。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["createAddress"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/addresses/{addressId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 修改地址
         * @description 修改地址
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        put: operations["updateAddress"];
        post?: never;
        /**
         * 删除地址
         * @description 删除地址
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。不会改动历史订单的地址快照。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        delete: operations["deleteAddress"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/delivery-slots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询可预约配送时段
         * @description 查询可预约配送时段
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。每日09–12/14–17/18–21，默认容量30；remaining为快照，只有下单事务成功才保证占位。截止或满额available=false。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listDeliverySlots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/coupons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的新人优惠券
         * @description 我的新人优惠券
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。券资格、门槛及是否可叠加由后端判定；v0.1不含付费会员。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listMyCoupons"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/quote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 服务端订单报价
         * @description 服务端订单报价
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。报价默认5分钟有效且不得晚于配送时段预约截止，不预占库存、券或时段；会员价与临期价取低后扣新人券，优惠后满9900分免600分运费。下单重新原子校验，报价过期/价格变更需重报价，不能静默加价。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["quoteOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的订单分页
         * @description 我的订单分页
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     allowedActions由服务端按当前角色/归属/状态/实付剩余额度/时限动态给出，执行时再校验；deliveryReceiptCode只向本人DELIVERING订单展示。
         */
        get: operations["listMyOrders"];
        put?: never;
        /**
         * 创建订单与原子预占
         * @description 创建订单与原子预占
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。同事务锁定报价、券、FEFO多批次及配送名额，任一失败回滚。批次必须在预约时段结束前不过期。创建15分钟内支付。服务端从quote取金额，拒绝客户端金额字段。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["createOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{orderId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的订单详情
         * @description 我的订单详情
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。支持每行估重/实重与整单差额；消费者不见allocation/batchNo。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     allowedActions由服务端按当前角色/归属/状态/实付剩余额度/时限动态给出，执行时再校验；deliveryReceiptCode只向本人DELIVERING订单展示。
         */
        get: operations["getMyOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{orderId}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 轮询订单状态与退款汇总
         * @description 轮询订单状态与退款汇总
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。退款状态独立于履约状态。支付成功不表示已出库。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     allowedActions由服务端按当前角色/归属/状态/实付剩余额度/时限动态给出，执行时再校验；deliveryReceiptCode只向本人DELIVERING订单展示。
         *
         *     前端可每2秒轮询，最多60秒后改手动刷新；429服从Retry-After。v0.1无SSE，轮询超时不把PENDING自动判为失败。
         */
        get: operations["getOrderStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{orderId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 发货前申请取消订单
         * @description 发货前申请取消订单
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。允许PENDING_PAY/PAID/PICKING/READY_TO_SHIP；DELIVERING/FINISHED拒绝普通取消。状态进入CANCELED，未出库预占和时段释放；已收资金异步退款。已拣出库量须实物回库质检后恢复，不能凭取消直接增加可售量。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["cancelMyOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/prepay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 创建订单或补款沙箱支付单
         * @description 创建订单或补款沙箱支付单
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。ORDER绑定PENDING_PAY订单；TOP_UP必须提供本人差额单adjustmentId且状态TOP_UP_PENDING。金额/币种/期限服务端决定。同订单可多次尝试但最多一次成功入账，补款独立支付单。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     响应allowedActions仅dev/test本人有效支付单给SIMULATE_PAYMENT，production为空。
         */
        post: operations["createPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/{paymentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 主动查询支付状态
         * @description 主动查询支付状态
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。必要时服务端主动查询沙箱渠道，并走与回调一致的幂等入账逻辑；不得客户端直接置SUCCESS。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     前端可每2秒轮询，最多60秒后改手动刷新；429服从Retry-After。v0.1无SSE，轮询超时不把PENDING自动判为失败。
         */
        get: operations["getPayment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/{paymentId}/sandbox-simulate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 仅开发测试模拟本人支付结果
         * @description 仅开发测试模拟本人支付结果
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。production端点不注册并返回404；必须MEMBER身份且payment属于本人。服务端模拟器发送签名渠道事件，不允许用户伪造回调金额或签名密钥。该接口不是真实收费。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["simulateSandboxPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/sandbox/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 接收沙箱签名支付事件
         * @description 接收沙箱签名支付事件
         *
         *     无Bearer认证。验证原始body HMAC、时间窗口和nonce，再校验金额/币种/支付绑定。以eventId及支付单资金账唯一键防重；同事件合法重试返回200 duplicate=true，不重复入账。晚付不复活CLOSED/CANCELED订单，创建唯一原路退款；资金与状态事务写入。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     同订单其他支付尝试在已成功收款后又成功：保留该笔收款账，生成唯一DUPLICATE_PAYMENT原路退款，不将订单重复入账或重新履约。
         */
        post: operations["receiveSandboxPaymentCallback"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/refunds/{refundId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询本人退款单
         * @description 查询本人退款单
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。PROCESSING不等于到账，SUCCESS才表示渠道退款成功。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getMyRefund"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/aftersales": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 我的售后单
         * @description 我的售后单
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listMyAftersales"];
        put?: never;
        /**
         * 完成后7天内申请售后
         * @description 完成后7天内申请售后
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。必须FINISHED且完成后7天内；每行累计已退+在途申请不超行实付，订单不超实收。品质退赔不自动恢复库存，也不重复扣库存。履约缺货与称重差额不走售后。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     提交媒体ID必须经/media/images上传，属于本人、状态READY且purpose匹配；拒绝任意外部URL和他人媒体。
         */
        post: operations["applyAftersale"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/aftersales/{aftersaleId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 售后详情
         * @description 售后详情
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getMyAftersale"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/aftersales/{aftersaleId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 撤销售后申请
         * @description 撤销售后申请
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。仅APPLIED允许用户撤回；审核/执行中不允许撤回。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["cancelMyAftersale"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 评价本人已完成订单行
         * @description 评价本人已完成订单行
         *
         *     仅当前MEMBER本人资源，其他人的ID返回404；客户端不得通过memberId指定他人。必须本人FINISHED订单行；每行一次，重复评价409；服务端检查文本/图片归属。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     提交媒体ID必须经/media/images上传，属于本人、状态READY且purpose匹配；拒绝任意外部URL和他人媒体。
         */
        post: operations["createReview"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 运营与财务概览
         * @description 运营与财务概览
         *
         *     Asia/Shanghai自然日：capturedPaymentAmount按支付SUCCESS入账日汇总（含补款），successfulRefundAmount按退款SUCCESS日汇总，净额=两者之差；paidOrderCount按订单首次成功付款日去重，不将补款计新订单。库存指标按查询时点。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getAdminDashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 运营商品分页
         * @description 运营商品分页
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAdminProducts"];
        put?: never;
        /**
         * 创建商品草稿
         * @description 创建商品草稿
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     imageUrl只能选择受控静态素材或/admin/media/images返回的publicUrl，服务端不抓取任意外部URL。
         */
        post: operations["createProduct"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/{productId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 运营商品详情
         * @description 运营商品详情
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getAdminProduct"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 修改商品信息
         * @description 修改商品信息
         *
         *     至少提供一个可修改字段及version；不改历史订单商品快照。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     imageUrl只能选择受控静态素材或/admin/media/images返回的publicUrl，服务端不抓取任意外部URL。
         */
        patch: operations["patchProduct"];
        trace?: never;
    };
    "/api/v1/admin/products/{productId}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 商品上下架
         * @description 商品上下架
         *
         *     上架须有合法SKU/价格/图片；下架只阻止新购买，不影响历史履约。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        put: operations["setProductStatus"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/products/{productId}/skus": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 新增SKU
         * @description 新增SKU
         *
         *     BY_WEIGHT必须baseUnit=GRAM且priceUnitGram>0；BY_PIECE必须baseUnit=PIECE且priceUnitGram=null。价格不得小于0。库存只经批次台账变更。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     imageUrl只能选择受控静态素材或/admin/media/images返回的publicUrl，服务端不抓取任意外部URL。
         */
        post: operations["createSku"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/skus/{skuId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * 修改SKU价格信息
         * @description 修改SKU价格信息
         *
         *     至少一可修改字段及version；有库存/订单后不得改基础单位与计价方式。历史订单价格快照不变。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     imageUrl只能选择受控静态素材或/admin/media/images返回的publicUrl，服务端不抓取任意外部URL。
         */
        patch: operations["patchSku"];
        trace?: never;
    };
    "/api/v1/admin/batches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 仓储批次列表
         * @description 仓储批次列表
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listBatches"];
        put?: never;
        /**
         * 验收入库新批次
         * @description 验收入库新批次
         *
         *     生成RECEIVE流水；onHand=receivedQuantity，reserved=quarantined=0。拒绝过期、生产日未来或重复batchNo。客户端不提交available。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["receiveBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/batches/{batchId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 批次库存与派生鲜度
         * @description 批次库存与派生鲜度
         *
         *     available=onHand-reserved-quarantined；freshness按时钟及临期阈值派生，不写入lifecycle枚举。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getBatch"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/batches/{batchId}/adjustments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 盘点或损耗调整
         * @description 盘点或损耗调整
         *
         *     数量变化不得使onHand/reserved/quarantined/available为负；理由、版本及不可变流水/审计必填。已出库品质退款不得再扣批次库存。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["adjustInventory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/batches/{batchId}/lifecycle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 批次隔离恢复或报废
         * @description 批次隔离恢复或报废
         *
         *     须先处理未履约预占，不能静默破坏allocation。QUARANTINED将未预占在库量转隔离，DISPOSED需无预占且生成报废流水。EXPIRED为派生鲜度，不能通过改NORMAL恢复可售。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        put: operations["setBatchLifecycle"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/inventory-movements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 不可变库存流水
         * @description 不可变库存流水
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listInventoryMovements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按岗位查看订单
         * @description 按岗位查看订单
         *
         *     返回脱敏联系信息；OPERATOR运营只读、FINANCE资金核对只读、SERVICE处理客服流程。PICKER/COURIER仅通过各自任务接口取最小数据。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAdminOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders/{orderId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 后台脱敏订单详情
         * @description 后台脱敏订单详情
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getAdminOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders/{orderId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 客服执行发货前取消
         * @description 客服执行发货前取消
         *
         *     仅PENDING_PAY/PAID/PICKING/READY_TO_SHIP，DELIVERING不允许普通取消。审计操作人和原因；出库后取消必须后续质检回库才恢复可售。异步退款不可由客服直接记成功。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     SERVICE不得处理本人购买的订单；职责分离按账号主体而非当前选择角色判断。
         */
        post: operations["cancelOrderAsService"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/orders/{orderId}/returns/receive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 取消待发订单实物回库质检
         * @description 取消待发订单实物回库质检
         *
         *     仅CANCELED且已有PICK_OUT的订单；原拣货人员或显式获派回库任务者。逐allocation累计回库不得超已出库未回库量，passed增加onHand和available，quarantined增加onHand和quarantined；生成唯一回库流水。品质售后不调用此接口。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["receiveCanceledOrderReturn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pick-tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 待领或本人拣货任务
         * @description 待领或本人拣货任务
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listPickTasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pick-tasks/{taskId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询拣货任务及多批次分配
         * @description 查询拣货任务及多批次分配
         *
         *     仅未领取任务或本人任务；无客户姓名、电话、详细地址。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getPickTask"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pick-tasks/{taskId}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 原子领取拣货任务
         * @description 原子领取拣货任务
         *
         *     CAS未分派任务至本人，订单PAID→PICKING；已被他人领取409。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["claimPickTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pick-tasks/{taskId}/reallocate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 显式重分配批次
         * @description 显式重分配批次
         *
         *     仅本人CLAIMED/PICKING，原子释放旧预占/取得新预占、FEFO及预约结束前不过期检查。不可静默换批，保留原因审计。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["reallocatePickTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pick-tasks/{taskId}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 确认实拣数量及称重净差
         * @description 仅本人已领取拣货任务。请求必须逐allocation明确actualQuantity，包括0；按件不增加原数量，按重允许0至floor(估重×1.1)。实际0或按件少发须reasonCode=SHORTAGE并写说明；正常称重变化使用WEIGHT_VARIANCE。
         *
         *     先显式重分配尝试补齐，仍缺货可部分履约：按件以实际件数×单价，按重以实克×单价/priceUnitGram逐订单行半入取整；实际券减免=min(原固定券分摊,实际行额)，运费保持原快照。全单实际0则CANCELED并退全部已收含运费。
         *
         *     原子释放未实拣预占，只对实际出库量扣onHand并写PICK_OUT；实际0行不写出库流水。实际短缺的物理差异另走隔离/盘点/损耗调整，不能借少发任意改总账。整单净差只建一张补款或退差单；各差额行显式PIECE/GRAM与估/实数量。
         *
         *     补款期限10分钟且不得晚于时段开始。差额NONE/REFUNDED/SETTLED才允许发货；未付补款过期取消整单、退已收款并按实物阶段回库。Idempotency-Key、版本/角色/本人归属均服务端校验。本契约待实现。
         */
        post: operations["confirmPickTask"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 配送任务列表
         * @description 配送任务列表
         *
         *     PICKER仅本人已完成拣货对应待交接任务；COURIER仅已指派本人任务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     SERVICE仅可读取本店本人负责或明确分派的相关客服EXCEPTION工单，用于获取taskId、version和恢复所需脱敏信息；不能读取其他任务、完整联系方式或签收码。此读取不授予dispatch/complete/contact-access权限。
         */
        get: operations["listDeliveryTasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks/{taskId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 本人配送任务详情
         * @description 本人配送任务详情
         *
         *     此列表/详情只返回脱敏联系信息，真实配送联系信息须仅本人派送中经专用端点按需访问并审计。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     SERVICE仅可读取本店本人负责或明确分派的相关客服EXCEPTION工单，用于获取taskId、version和恢复所需脱敏信息；不能读取其他任务、完整联系方式或签收码。此读取不授予dispatch/complete/contact-access权限。
         */
        get: operations["getDeliveryTask"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks/{taskId}/dispatch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 拣货人员向配送员交接发货
         * @description 拣货人员向配送员交接发货
         *
         *     仅本人已完成拣货任务，订单READY_TO_SHIP且称重差额为NONE/REFUNDED/SETTLED之一（无差额实体等同NONE）；courierId必须ACTIVE且有COURIER。原子置订单DELIVERING，记录交接；不能在补款未结时发货。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     REFUND_PENDING也等待退差成功后发货；渠道失败保留原退款业务号重试及人工处理队列。
         */
        post: operations["dispatchDelivery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks/{taskId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 配送员凭签收凭证确认送达
         * @description 配送员凭签收凭证确认送达
         *
         *     仅本人DELIVERING任务；校验一次性签收凭证，置订单FINISHED与finishedAt；不回填历史配送容量。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["completeDelivery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks/{taskId}/exceptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 记录配送异常
         * @description 记录配送异常
         *
         *     仅本人任务；记录异常并通知客服，不自动退款或回库存，不绕过取消/售后状态约束。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     任务转EXCEPTION后仍保留原courierId，关联订单保持DELIVERING；客服通过resolve-exception恢复原任务，异常期间不能complete或读取完整联系信息。
         */
        post: operations["reportDeliveryException"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/aftersales": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 客服待领取及本人售后单
         * @description 客服待领取及本人售后单
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAdminAftersales"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/aftersales/{aftersaleId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 客服售后详情
         * @description 客服售后详情
         *
         *     仅未分派或本人审核任务，手机号脱敏；不存在通用PII reveal能力。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     未领取队列仅可读脱敏概要，证据需先claim；assigneeId表示领取人，reviewerId表示已完成正式审核的账号。
         */
        get: operations["getAdminAftersale"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/aftersales/{aftersaleId}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 客服审核批准售后
         * @description 仅SERVICE本人已领取（assigneeId=当前账号）且APPLIED的售后工单；必须先claim再审阅证据，不再在审核事务中隐式领取。禁止处理本人购买订单。校验version，批准金额逐行不超申请及剩余实付，保存reviewerId并将售后置APPROVED，创建PENDING人工退款单。审核不得授权资金执行；后台worker不可自动捡取人工PENDING退款。只有FINANCE execute通过职责分离校验后才将退款置PROCESSING、售后置REFUNDING并写执行授权outbox。Idempotency-Key必需，同键不同体409。此文件为契约，尚待实现。
         */
        post: operations["approveAftersale"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/aftersales/{aftersaleId}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 客服驳回售后
         * @description 仅SERVICE本人已领取（assigneeId=当前账号）且APPLIED的售后工单；先claim后审阅，不再隐式领取。校验version，理由必填，保存reviewerId并转REJECTED。禁止处理本人购买订单；他人工单404；状态或版本冲突409。Idempotency-Key必需。此文件为契约，尚待实现。
         */
        post: operations["rejectAftersale"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/refunds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 财务退款列表
         * @description 财务退款列表
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAdminRefunds"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/refunds/{refundId}/execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 财务执行原路沙箱退款
         * @description 财务执行原路沙箱退款
         *
         *     仅PENDING人工售后退款；同一账号即使同时有SERVICE/FINANCE也不能执行本人审核单（reviewerId != actorId）。检查支付可退余额含在途退款占额；PROCESSING为异步执行，渠道确认后SUCCESS。自动称重/晚付/取消退款由受限系统任务处理。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     执行人还必须不同于原购买人，不能通过切换角色绕过职责分离。
         *
         *     人工AFTERSALE退款从PENDING转PROCESSING、售后从APPROVED转REFUNDING，并原子写入已授权执行outbox；worker仅消费这类授权事件，禁止直接扫描人工PENDING就发起渠道退款。
         */
        post: operations["executeRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/refunds/{refundId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 财务重试失败退款
         * @description 财务重试失败退款
         *
         *     仅FAILED，先查询渠道去重再重试，同一退款业务键；仍校验reviewerId != actorId，不得另建退款绕过额度。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     执行人还必须不同于原购买人，不能通过切换角色绕过职责分离。
         *
         *     人工退款重试仍需FINANCE授权并写outbox，worker不能凭FAILED/PENDING状态自行绕过财务职责分离。
         */
        post: operations["retryRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reconciliations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 财务对账结果
         * @description 财务对账结果
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listReconciliations"];
        put?: never;
        /**
         * 触发沙箱日对账
         * @description 触发沙箱日对账
         *
         *     按资金SUCCESS事件日比较渠道账与内部账，异步执行；差异不得自动改账抹平。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["createReconciliation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 管理员审计查询
         * @description 管理员审计查询
         *
         *     只读不可改删，敏感payload/token/密码不写日志。ADMIN没有商品、拣货、退款等业务权限。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAuditLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/employees": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 员工账号列表
         * @description 员工账号列表
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listEmployees"];
        put?: never;
        /**
         * 创建员工账号
         * @description 创建员工账号
         *
         *     角色显式赋予，MEMBER不会因员工身份自动获得；临时密码强哈希，初登强制更改，通过POST /auth/password完成，禁止返回密码。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["createEmployee"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/employees/{employeeId}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 调整员工角色
         * @description 调整员工角色
         *
         *     审计前后角色；不能移除最后一个有效ADMIN或为自己静默提权；角色变更立即吊销相关会话。ADMIN不能绕过业务角色与SoD约束。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     禁止修改自己的角色（含自授业务角色），由另一ADMIN执行；不得删除最后一个有效ADMIN。
         */
        put: operations["setEmployeeRoles"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/employees/{employeeId}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 启停员工账号
         * @description 启停员工账号
         *
         *     停用立即吊销会话；不得停用最后一个有效ADMIN。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        put: operations["setEmployeeStatus"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 固定角色与权限目录
         * @description 固定角色与权限目录
         *
         *     v0.1角色固定，不开放自定义任意权限字符串写入。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-slots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 运营配送时段容量
         * @description 运营配送时段容量
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["listAdminDeliverySlots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-slots/{slotId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 调整时段容量和截止时间
         * @description 调整时段容量和截止时间
         *
         *     capacity不得低于已占容量；停用不取消已预约订单。所有改动版本控制并审计。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        put: operations["updateDeliverySlot"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询业务策略
         * @description 查询业务策略
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        get: operations["getBusinessPolicies"];
        /**
         * 修改限定业务策略
         * @description 修改限定业务策略
         *
         *     仅定义的运费/新人券/临期字段；不得在此修改身份权限、支付密钥、CSRF、限流等安全策略。变更影响新报价，历史成交快照不变。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        put: operations["updateBusinessPolicies"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 修改密码并吊销当前全部会话
         * @description 修改密码并吊销当前全部会话
         *
         *     校验当前密码，更新强哈希并吊销该账号全部会话，客户端重新登录。mustChangePassword=true的员工临时会话仅允许/me、/password、/logout；不得先访问业务API。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/media/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 上传本人订单售后或评价图片
         * @description 上传本人订单售后或评价图片
         *
         *     最多6MiB，JPEG/PNG/WebP；校验文件magic/mime/尺寸、剥离EXIF、重编码及恶意内容扫描，不接受SVG/HTML/远程抓取URL。orderId必须本人已购订单；purpose绑定AFTERSALE或REVIEW，返回READY后才可关联。示例file是multipart字段形态占位，非真实上传测试。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["uploadEvidenceImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/media/{mediaId}/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按用途与归属取得私有图片访问链接
         * @description 按用途与归属取得私有图片访问链接
         *
         *     MEMBER仅本人媒体；SERVICE仅已关联本人获派售后单的证据。短效5分钟URL，Cache-Control:no-store，签发审计但不记签名token；未授权404。未关联且超期临时媒体可清理。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         *
         *     SERVICE须先通过POST /admin/aftersales/{aftersaleId}/claim领取。媒体授权依据关联售后assigneeId=当前账号，不以审核后的reviewerId作为读取前置；未领取或他人工单证据返回404。
         */
        get: operations["getPrivateMediaAccess"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks/{taskId}/contact-access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 配送员按需访问本人配送联系信息
         * @description 配送员按需访问本人配送联系信息
         *
         *     仅本人DELIVERING任务；每次访问校验岗位/归属/状态与用途，审计PII访问，Cache-Control:no-store；不得由SERVICE/ADMIN越权获取。联系信息不写审计payload。
         *
         *     Idempotency-Key必需；同键不同体409。同键重试不重复执行业务。
         *
         *     所有写操作在服务端校验角色、资源所有权、状态和version（适用时）；示例是固定契约样例，不表示真实库存、业务运行或测试结果。
         */
        post: operations["accessDeliveryContact"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/media/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 运营上传商品图片
         * @description 仅OPERATOR本店商品素材。最多6MiB JPEG/PNG/WebP；校验magic/mime/尺寸、重编码去EXIF、扫描。READY后返回受控publicUrl供商品imageUrl使用。productId可空以便先上传再建商品。开发后端媒体卷托管；生产对象存储为部署选项，当前仅契约未实现。
         */
        post: operations["uploadProductImage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/aftersales/{aftersaleId}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 客服原子领取售后工单
         * @description 仅SERVICE本店未分派且APPLIED的售后工单，禁止领取本人购买订单的售后。先CAS校验version并写assigneeId=当前账号，递增version；此时status仍为APPLIED，reviewerId仍为空。随后才能通过/media/{mediaId}/access读取本人工单证据，并执行approve/reject。其他客服已领取则409；超范围资源404。Idempotency-Key必需，同键不同体409；同键同体重试返回原结果。本契约待实现。
         */
        post: operations["claimAftersale"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delivery-tasks/{taskId}/resolve-exception": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 客服解决配送异常并恢复原任务
         * @description 仅SERVICE本店相关客服工单范围，且配送任务当前为EXCEPTION、关联订单仍为DELIVERING。提交reason和expectedVersion，CAS恢复任务DELIVERING并保留原courierId；原因、操作人和前后状态审计。不得换配送员、改订单履约状态、伪造签收、退款或变更库存。任务不是EXCEPTION或版本冲突409，超处理范围404；恢复后原COURIER可重新按需访问联系信息并凭签收码complete。Idempotency-Key必需；同键不同体409。此文件为契约，尚待实现。
         */
        post: operations["resolveDeliveryException"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ErrorDetail: {
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example items[0].quantity
             */
            field: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 必须为正整数
             */
            reason: string;
        };
        ErrorData: {
            /**
             * @example VALIDATION_ERROR
             * @enum {string}
             */
            errorKey: "VALIDATION_ERROR" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "INVALID_STATE" | "INSUFFICIENT_STOCK" | "SLOT_UNAVAILABLE" | "QUOTE_EXPIRED" | "PAYMENT_MISMATCH" | "SIGNATURE_INVALID" | "REFUND_LIMIT" | "WEIGHT_LIMIT" | "SOD_VIOLATION" | "RATE_LIMITED" | "INTERNAL_ERROR" | "CHANNEL_UNAVAILABLE";
            /** @example false */
            retryable: boolean;
            details: components["schemas"]["ErrorDetail"][];
        };
        ErrorEnvelope: {
            /** @example 1001 */
            code: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 请求参数不合法
             */
            message: string;
            data: components["schemas"]["ErrorData"];
            /**
             * @description 请求追踪标识
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        CommandResult: {
            /** @example true */
            accepted: boolean;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example 1001
             */
            resourceId: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 命令已受理；异步任务完成前不表示资金已到账
             */
            message: string;
        };
        CsrfToken: {
            /**
             * @description 绑定csrf_context cookie的随机token；后续Cookie变更操作通过X-CSRF-Token提交
             * @example csrf-demo-token-001
             */
            csrfToken: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            expiresAt: string;
        };
        User: {
            /** @example false */
            mustChangePassword: boolean;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u1001
             */
            userId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示会员
             */
            displayName: string;
            /**
             * @description 脱敏手机号
             * @example 138****8000
             */
            phoneMasked: string;
            roles: ("MEMBER" | "PICKER" | "COURIER" | "OPERATOR" | "SERVICE" | "FINANCE" | "ADMIN")[];
            /**
             * @example ACTIVE
             * @enum {string}
             */
            status: "ACTIVE" | "DISABLED";
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @example [
             *       "catalog.read",
             *       "auth.self",
             *       "order.create",
             *       "order.self.read"
             *     ]
             */
            permissions: string[];
        };
        AuthSession: {
            /**
             * @description 15分钟access JWT，仅内存保存；refresh不放响应体
             * @example demo.access.token
             */
            accessToken: string;
            /**
             * @example Bearer
             * @enum {string}
             */
            tokenType: "Bearer";
            /** @example 900 */
            expiresIn: number;
            user: components["schemas"]["User"];
            /**
             * @description 绑定csrf_context cookie的随机token；后续Cookie变更操作通过X-CSRF-Token提交
             * @example csrf-demo-token-001
             */
            csrfToken: string;
            /**
             * Format: date-time
             * @example 2026-10-18T13:00:00+08:00
             */
            csrfExpiresAt: string;
        };
        RegisterRequest: {
            /**
             * @description 中国大陆手机号
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 密码仅请求使用；服务器强哈希存储
             * @example DemoPassword123!
             */
            password: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示会员
             */
            displayName: string;
        };
        LoginRequest: {
            /**
             * @description 中国大陆手机号
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 密码仅请求使用；服务器强哈希存储
             * @example DemoPassword123!
             */
            password: string;
        };
        Category: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example C01
             */
            categoryId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example C01
             */
            code: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 时令蔬菜
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 蔬菜
             */
            shortName: string;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /** @example 1 */
            sortOrder: number;
        };
        Sku: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuCode: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄500g/份
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /** @example null */
            priceUnitGram: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 690
             */
            price: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            memberPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            salePrice: number;
            /**
             * @example IN_STOCK
             * @enum {string}
             */
            stockStatus: "IN_STOCK" | "LOW" | "SOLD_OUT";
            /** @example false */
            nearExpiry: boolean;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /** @example null */
            arrivedAt: string | null;
            /** @example null */
            freshness: ("NORMAL" | "NEAR_EXPIRY") | null;
            /** @example null */
            shelfLifeRemainingDays: number | null;
        };
        Product: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            productId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            spuCode: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example C01
             */
            categoryId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 新鲜番茄；以实际商品为准
             */
            description: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 山东寿光
             */
            origin: string;
            /**
             * @example COLD
             * @enum {string}
             */
            storage: "AMBIENT" | "COLD" | "FROZEN" | "LIVE";
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 690
             */
            price: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            memberPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            salePrice: number;
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel: string;
            /**
             * @example IN_STOCK
             * @enum {string}
             */
            stockStatus: "IN_STOCK" | "LOW" | "SOLD_OUT";
            /** @example false */
            nearExpiry: boolean;
            skus: components["schemas"]["Sku"][];
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /** @example null */
            arrivedAt: string | null;
            /** @example null */
            freshness: ("NORMAL" | "NEAR_EXPIRY") | null;
            /** @example null */
            shelfLifeRemainingDays: number | null;
        };
        Banner: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example banner-1
             */
            bannerId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 预约鲜送
             */
            title: string;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /**
             * @example CATEGORY
             * @enum {string}
             */
            targetType: "CATEGORY" | "PRODUCT" | "NEAR_EXPIRY";
            /** @example null */
            targetId: string | null;
        };
        Home: {
            /**
             * @example [
             *       {
             *         "bannerId": "banner-1",
             *         "title": "预约鲜送",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "targetType": "CATEGORY",
             *         "targetId": null
             *       }
             *     ]
             */
            banners: components["schemas"]["Banner"][];
            /**
             * @example [
             *       {
             *         "categoryId": "C01",
             *         "code": "C01",
             *         "name": "时令蔬菜",
             *         "shortName": "蔬菜",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "sortOrder": 1
             *       }
             *     ]
             */
            categories: components["schemas"]["Category"][];
            nearExpiryProducts: components["schemas"]["Product"][];
            /**
             * @example [
             *       {
             *         "productId": "S001",
             *         "spuCode": "S001",
             *         "categoryId": "C01",
             *         "name": "沙瓤番茄",
             *         "description": "新鲜番茄；以实际商品为准",
             *         "origin": "山东寿光",
             *         "storage": "COLD",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "price": 690,
             *         "memberPrice": 590,
             *         "salePrice": 590,
             *         "priceMode": "BY_PIECE",
             *         "unitLabel": "500g/份",
             *         "stockStatus": "IN_STOCK",
             *         "nearExpiry": false,
             *         "skus": [
             *           {
             *             "skuId": "SKU-001",
             *             "skuCode": "SKU-001",
             *             "name": "沙瓤番茄500g/份",
             *             "unitLabel": "500g/份",
             *             "baseUnit": "PIECE",
             *             "priceMode": "BY_PIECE",
             *             "priceUnitGram": null,
             *             "price": 690,
             *             "memberPrice": 590,
             *             "salePrice": 590,
             *             "stockStatus": "IN_STOCK",
             *             "nearExpiry": false,
             *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *             "version": 1,
             *             "arrivedAt": null,
             *             "freshness": null,
             *             "shelfLifeRemainingDays": null
             *           }
             *         ],
             *         "version": 1,
             *         "arrivedAt": null,
             *         "freshness": null,
             *         "shelfLifeRemainingDays": null
             *       }
             *     ]
             */
            recommendedProducts: components["schemas"]["Product"][];
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            generatedAt: string;
        };
        CartItem: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example cart-1
             */
            cartItemId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            productId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            productName: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /** @example 1 */
            quantity: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            unitPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            lineAmount: number;
            /** @example true */
            selected: boolean;
            /**
             * @example IN_STOCK
             * @enum {string}
             */
            stockStatus: "IN_STOCK" | "LOW" | "SOLD_OUT";
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        Cart: {
            /**
             * @example [
             *       {
             *         "cartItemId": "cart-1",
             *         "skuId": "SKU-001",
             *         "productId": "S001",
             *         "productName": "沙瓤番茄",
             *         "unitLabel": "500g/份",
             *         "baseUnit": "PIECE",
             *         "quantity": 1,
             *         "unitPrice": 590,
             *         "lineAmount": 590,
             *         "selected": true,
             *         "stockStatus": "IN_STOCK",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["CartItem"][];
            /** @example 1 */
            selectedItemCount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            estimatedGoodsAmount: number;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        CartAddRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @description PIECE为件数，GRAM为估重克数；计价方式以SKU为准
             * @example 1
             */
            quantity: number;
            /** @example true */
            selected: boolean;
        };
        CartUpdateRequest: {
            /** @example 1 */
            quantity: number;
            /** @example true */
            selected: boolean;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        VersionRequest: {
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        ReasonVersionRequest: {
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 用户请求取消
             */
            reason: string;
        };
        AddressInput: {
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 测试用户
             */
            recipientName: string;
            /**
             * @description 配送联系电话
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市
             */
            province: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市
             */
            city: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 松江区
             */
            district: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示路1号
             */
            detail: string;
            /** @example true */
            isDefault: boolean;
        };
        Address: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example addr-1
             */
            addressId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 测试用户
             */
            recipientName: string;
            /**
             * @description 配送联系电话
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市
             */
            province: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市
             */
            city: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 松江区
             */
            district: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示路1号
             */
            detail: string;
            /** @example true */
            isDefault: boolean;
            /** @example true */
            serviceable: boolean;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        AddressUpdateRequest: {
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 测试用户
             */
            recipientName: string;
            /**
             * @description 配送联系电话
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市
             */
            province: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市
             */
            city: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 松江区
             */
            district: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示路1号
             */
            detail: string;
            /** @example true */
            isDefault: boolean;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        DeliverySlot: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example slot-20261018-2
             */
            slotId: string;
            /**
             * Format: date
             * @example 2026-10-18
             */
            date: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 14:00–17:00
             */
            label: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            startAt: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T17:00:00+08:00
             */
            endAt: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:30:00+08:00
             */
            cutoffAt: string;
            /** @example 20 */
            remaining: number;
            /** @example true */
            available: boolean;
            /** @example null */
            unavailableReason: ("FULL" | "CUTOFF" | "OUT_OF_SERVICE") | null;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        PurchaseItem: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @description SKU基础单位；按重SKU传估重克数
             * @example 1
             */
            quantity: number;
        };
        QuoteRequest: {
            items: components["schemas"]["PurchaseItem"][];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example addr-1
             */
            addressId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example slot-20261018-2
             */
            slotId: string;
            /** @example null */
            couponId: string | null;
        };
        PriceSummary: {
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 690
             */
            referenceGoodsAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            memberGoodsAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            nearExpiryDiscountAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            couponDiscountAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            goodsPayableAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 600
             */
            freightAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 1190
             */
            payableAmount: number;
            /** @example 9900 */
            freeShippingThresholdAmount: number;
            /** @example 9310 */
            freeShippingGapAmount: number;
        };
        QuoteLine: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            productId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            productName: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /** @example 1 */
            quantity: number;
            /** @example null */
            estimatedGram: number | null;
            /** @example null */
            priceUnitGram: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            unitPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            couponAllocationAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            linePayableAmount: number;
            /** @example 690 */
            referenceUnitPrice: number;
            /** @example 590 */
            memberUnitPrice: number;
            /** @example null */
            nearExpiryUnitPrice: number | null;
        };
        Quote: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example quote-1
             */
            quoteId: string;
            /**
             * @description 绑定主体、商品价格/数量、地址、时段、券和有效期的不可伪造报价令牌
             * @example quote-demo-token
             */
            quoteToken: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:05:00+08:00
             */
            expiresAt: string;
            lines: components["schemas"]["QuoteLine"][];
            price: components["schemas"]["PriceSummary"];
            slot: components["schemas"]["DeliverySlot"];
            address: components["schemas"]["Address"];
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        CreateOrderRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example quote-1
             */
            quoteId: string;
            /**
             * @description 绑定主体、商品价格/数量、地址、时段、券和有效期的不可伪造报价令牌
             * @example quote-demo-token
             */
            quoteToken: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 请按预约时段配送
             */
            buyerNote?: string;
        };
        WeightAdjustmentLine: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example oi-1
             */
            orderItemId: string;
            /** @example null */
            estimatedGram: number | null;
            /** @example null */
            actualGram: number | null;
            /** @example null */
            priceUnitGram: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            unitPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            originalPayableAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            recalculatedPayableAmount: number;
            /** @example -590 */
            deltaAmount: number;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /** @example 1 */
            estimatedQuantity: number;
            /** @example 0 */
            actualQuantity: number;
            /**
             * @example SHORTAGE
             * @enum {string}
             */
            reasonCode: "SHORTAGE" | "WEIGHT_VARIANCE";
        };
        /** @description 履约金额差额实体（沿用weightAdjustment字段兼容前端）；同时承载称重变化与部分缺货，按整单净额仅建一张补/退单。 */
        WeightAdjustment: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example wa-1
             */
            adjustmentId: string;
            /**
             * @example REFUND_PENDING
             * @enum {string}
             */
            status: "NONE" | "REFUND_PENDING" | "REFUNDED" | "TOP_UP_PENDING" | "SETTLED" | "CANCELED";
            /**
             * @description 整单净差：正数补款，负数退款，0无差额；只建一笔净补/退单
             * @example -590
             */
            deltaAmount: number;
            /**
             * @example [
             *       {
             *         "orderItemId": "oi-1",
             *         "estimatedGram": null,
             *         "actualGram": null,
             *         "priceUnitGram": null,
             *         "unitPrice": 590,
             *         "originalPayableAmount": 590,
             *         "recalculatedPayableAmount": 0,
             *         "deltaAmount": -590,
             *         "baseUnit": "PIECE",
             *         "priceMode": "BY_PIECE",
             *         "estimatedQuantity": 1,
             *         "actualQuantity": 0,
             *         "reasonCode": "SHORTAGE"
             *       }
             *     ]
             */
            lines: components["schemas"]["WeightAdjustmentLine"][];
            /** @example null */
            topUpPaymentId: string | null;
            /** @example null */
            refundId: string | null;
            /** @example null */
            expiresAt: string | null;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        OrderItem: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example oi-1
             */
            orderItemId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            productId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            productName: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel: string;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /** @example 1 */
            quantity: number;
            /** @example null */
            estimatedGram: number | null;
            /** @example null */
            actualGram: number | null;
            /** @example null */
            priceUnitGram: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            unitPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            couponAllocationAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            originalPayableAmount: number;
            /** @example null */
            finalPayableAmount: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            refundedAmount: number;
        };
        Refund: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example refund-1
             */
            refundId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example pay-1
             */
            paymentId: string;
            /** @example null */
            aftersaleId: string | null;
            /** @example null */
            adjustmentId: string | null;
            /**
             * @example AFTERSALE
             * @enum {string}
             */
            type: "AFTERSALE" | "CANCEL" | "WEIGHT_DIFFERENCE" | "LATE_PAYMENT" | "DUPLICATE_PAYMENT";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 24
             */
            amount: number;
            /**
             * @example CNY
             * @enum {string}
             */
            currency: "CNY";
            /**
             * @example PENDING
             * @enum {string}
             */
            status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 称重退差
             */
            reason: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
            /** @example null */
            completedAt: string | null;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        Order: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example FM20261018000123
             */
            orderNo: string;
            /**
             * @example PENDING_PAY
             * @enum {string}
             */
            status: "PENDING_PAY" | "PAID" | "PICKING" | "READY_TO_SHIP" | "DELIVERING" | "FINISHED" | "CANCELED" | "CLOSED";
            /**
             * @example CNY
             * @enum {string}
             */
            currency: "CNY";
            items: components["schemas"]["OrderItem"][];
            price: components["schemas"]["PriceSummary"];
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            paidAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            refundedAmount: number;
            address: components["schemas"]["Address"];
            slot: components["schemas"]["DeliverySlot"];
            /** @example null */
            weightAdjustment: components["schemas"]["WeightAdjustment"] | null;
            refunds: components["schemas"]["Refund"][];
            /** @example null */
            buyerNote: string | null;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            createdAt: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:15:00+08:00
             */
            paymentExpiresAt: string;
            /** @example null */
            paidAt: string | null;
            /** @example null */
            finishedAt: string | null;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 服务端按当前主体、状态、资金额度和时限计算；执行操作时仍重新授权校验
             * @example [
             *       "PAY",
             *       "CANCEL"
             *     ]
             */
            allowedActions: ("PAY" | "CANCEL" | "TOP_UP" | "APPLY_AFTERSALE" | "REVIEW")[];
            /** @example null */
            deliveryReceiptCode: string | null;
        };
        OrderStatus: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example PENDING_PAY
             * @enum {string}
             */
            status: "PENDING_PAY" | "PAID" | "PICKING" | "READY_TO_SHIP" | "DELIVERING" | "FINISHED" | "CANCELED" | "CLOSED";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            paidAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            refundedAmount: number;
            /**
             * @example NONE
             * @enum {string}
             */
            weightAdjustmentStatus: "NONE" | "REFUND_PENDING" | "REFUNDED" | "TOP_UP_PENDING" | "SETTLED" | "CANCELED";
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            updatedAt: string;
            /**
             * @description 服务端按当前主体、状态、资金额度和时限计算；执行操作时仍重新授权校验
             * @example [
             *       "PAY",
             *       "CANCEL"
             *     ]
             */
            allowedActions: ("PAY" | "CANCEL" | "TOP_UP" | "APPLY_AFTERSALE" | "REVIEW")[];
        };
        PaymentRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example ORDER
             * @enum {string}
             */
            purpose: "ORDER" | "TOP_UP";
            /** @example null */
            adjustmentId?: string | null;
        };
        Payment: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example pay-1
             */
            paymentId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /** @example null */
            adjustmentId: string | null;
            /**
             * @example ORDER
             * @enum {string}
             */
            purpose: "ORDER" | "TOP_UP";
            /**
             * @example SANDBOX
             * @enum {string}
             */
            channel: "SANDBOX";
            /**
             * @example PENDING
             * @enum {string}
             */
            status: "INIT" | "PENDING" | "SUCCESS" | "FAILED" | "CLOSED";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 1190
             */
            amount: number;
            /**
             * @example CNY
             * @enum {string}
             */
            currency: "CNY";
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:15:00+08:00
             */
            expiresAt: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 仅dev/test本人可模拟，production为空
             * @example [
             *       "SIMULATE_PAYMENT"
             *     ]
             */
            allowedActions: "SIMULATE_PAYMENT"[];
        };
        SandboxSimulateRequest: {
            /**
             * @example SUCCESS
             * @enum {string}
             */
            outcome: "SUCCESS" | "FAILED";
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        PaymentCallback: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example evt-1
             */
            eventId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example pay-1
             */
            paymentId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example sandbox-trade-1
             */
            channelTradeNo: string;
            /**
             * @example SUCCESS
             * @enum {string}
             */
            status: "SUCCESS" | "FAILED";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 1190
             */
            amount: number;
            /**
             * @example CNY
             * @enum {string}
             */
            currency: "CNY";
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            occurredAt: string;
        };
        CallbackReceipt: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example evt-1
             */
            eventId: string;
            /** @example true */
            accepted: boolean;
            /** @example false */
            duplicate: boolean;
        };
        AftersaleLineInput: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example oi-1
             */
            orderItemId: string;
            /** @example 1 */
            quantity: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            requestedAmount: number;
        };
        AftersaleRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example QUALITY
             * @enum {string}
             */
            type: "QUALITY" | "SHORTAGE" | "LATE";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 商品质量问题
             */
            reason: string;
            items: components["schemas"]["AftersaleLineInput"][];
            evidenceMediaIds: string[];
        };
        Aftersale: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example after-1
             */
            aftersaleId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example QUALITY
             * @enum {string}
             */
            type: "QUALITY" | "SHORTAGE" | "LATE";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 商品质量问题
             */
            reason: string;
            items: components["schemas"]["AftersaleLineInput"][];
            evidenceMediaIds: string[];
            /**
             * @example APPLIED
             * @enum {string}
             */
            status: "APPLIED" | "APPROVED" | "REJECTED" | "REFUNDING" | "COMPLETED" | "CANCELED";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            requestedAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            approvedAmount: number;
            /** @example null */
            reviewComment: string | null;
            refunds: components["schemas"]["Refund"][];
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            appliedAt: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        ReviewInput: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example oi-1
             */
            orderItemId: string;
            /** @example 5 */
            rating: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 商品新鲜，配送及时
             */
            content: string;
            imageMediaIds: string[];
            /** @example false */
            anonymous: boolean;
        };
        Review: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example review-1
             */
            reviewId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            productId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示会员
             */
            displayName: string;
            /** @example 5 */
            rating: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 商品新鲜，配送及时
             */
            content: string;
            imageUrls: string[];
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
        };
        Coupon: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example coupon-1
             */
            couponId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 新人券
             */
            name: string;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 500
             */
            discountAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 3000
             */
            minGoodsAmount: number;
            /**
             * @example AVAILABLE
             * @enum {string}
             */
            status: "AVAILABLE" | "LOCKED" | "USED" | "EXPIRED";
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            expiresAt: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        MediaReference: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example media-1
             */
            mediaId: string;
            /**
             * @example AFTERSALE
             * @enum {string}
             */
            purpose: "AFTERSALE" | "REVIEW" | "PRODUCT";
            /**
             * @example image/jpeg
             * @enum {string}
             */
            mimeType: "image/jpeg" | "image/png" | "image/webp";
            /** @example 102400 */
            sizeBytes: number;
            /**
             * @example READY
             * @enum {string}
             */
            status: "PENDING_SCAN" | "READY" | "REJECTED";
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
        };
        MediaAccess: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example media-1
             */
            mediaId: string;
            /**
             * Format: uri
             * @description 短效私有签名URL，不可公开缓存；服务端只签发已有授权媒体
             * @example http://localhost:8080/media-content/media-1?token=demo
             */
            url: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            expiresAt: string;
        };
        MediaUploadRequest: {
            /**
             * @example AFTERSALE
             * @enum {string}
             */
            purpose: "AFTERSALE" | "REVIEW";
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * Format: binary
             * @description multipart真实二进制文件；示例只是字段形态，传输时由客户端形成boundary
             * @example <binary image bytes>
             */
            file: string;
        };
        PasswordChangeRequest: {
            /**
             * @description 密码仅请求使用；服务器强哈希存储
             * @example DemoPassword123!
             */
            currentPassword: string;
            /**
             * @description 密码仅请求使用；服务器强哈希存储
             * @example DemoPassword123!
             */
            newPassword: string;
        };
        ProductWriteRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example C01
             */
            categoryId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 新鲜番茄
             */
            description: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 山东寿光
             */
            origin: string;
            /**
             * @example COLD
             * @enum {string}
             */
            storage: "AMBIENT" | "COLD" | "FROZEN" | "LIVE";
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
        };
        /**
         * @example {
         *       "version": 1,
         *       "name": "沙瓤番茄精选"
         *     }
         */
        ProductPatchRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example C01
             */
            categoryId?: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            name?: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 新鲜番茄
             */
            description?: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 山东寿光
             */
            origin?: string;
            /**
             * @example COLD
             * @enum {string}
             */
            storage?: "AMBIENT" | "COLD" | "FROZEN" | "LIVE";
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl?: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        SkuWriteRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuCode: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄500g/份
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /** @example null */
            priceUnitGram: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 690
             */
            price: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            memberPrice: number;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
        };
        /**
         * @example {
         *       "version": 1,
         *       "memberPrice": 590
         *     }
         */
        SkuPatchRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuCode?: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄500g/份
             */
            name?: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel?: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit?: "PIECE" | "GRAM";
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode?: "BY_PIECE" | "BY_WEIGHT";
            /** @example null */
            priceUnitGram?: number | null;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 690
             */
            price?: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            memberPrice?: number;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl?: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        AdminProduct: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            productId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example S001
             */
            spuCode: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example C01
             */
            categoryId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 沙瓤番茄
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 新鲜番茄；以实际商品为准
             */
            description: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 山东寿光
             */
            origin: string;
            /**
             * @example COLD
             * @enum {string}
             */
            storage: "AMBIENT" | "COLD" | "FROZEN" | "LIVE";
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            imageUrl: string;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 690
             */
            price: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            memberPrice: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            salePrice: number;
            /**
             * @example BY_PIECE
             * @enum {string}
             */
            priceMode: "BY_PIECE" | "BY_WEIGHT";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 500g/份
             */
            unitLabel: string;
            /**
             * @example IN_STOCK
             * @enum {string}
             */
            stockStatus: "IN_STOCK" | "LOW" | "SOLD_OUT";
            /** @example false */
            nearExpiry: boolean;
            skus: components["schemas"]["Sku"][];
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @example DRAFT
             * @enum {string}
             */
            status: "DRAFT" | "ON_SALE" | "OFF_SALE";
            /** @example null */
            arrivedAt: string | null;
            /** @example null */
            freshness: ("NORMAL" | "NEAR_EXPIRY") | null;
            /** @example null */
            shelfLifeRemainingDays: number | null;
        };
        ProductStatusRequest: {
            /**
             * @example ON_SALE
             * @enum {string}
             */
            status: "ON_SALE" | "OFF_SALE";
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        Batch: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example batch-1
             */
            batchId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example B20261018-001
             */
            batchNo: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /** @example 100 */
            onHand: number;
            /** @example 5 */
            reserved: number;
            /** @example 0 */
            quarantined: number;
            /** @example 95 */
            available: number;
            /**
             * @example NORMAL
             * @enum {string}
             */
            lifecycle: "NORMAL" | "QUARANTINED" | "DISPOSED";
            /**
             * @example NORMAL
             * @enum {string}
             */
            freshness: "NORMAL" | "NEAR_EXPIRY" | "EXPIRED";
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T00:00:00+08:00
             */
            producedAt: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-21T23:59:59+08:00
             */
            expiresAt: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            receivedAt: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        BatchCreateRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example B20261018-001
             */
            batchNo: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /** @example 100 */
            receivedQuantity: number;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T00:00:00+08:00
             */
            producedAt: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-21T23:59:59+08:00
             */
            expiresAt: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 采购验收入库
             */
            reason: string;
        };
        InventoryAdjustmentRequest: {
            /** @example -1 */
            quantityDelta: number;
            /**
             * @example COUNT_CORRECTION
             * @enum {string}
             */
            reasonCode: "COUNT_CORRECTION" | "DAMAGE" | "EXPIRED_DISPOSAL";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 盘点破损一份
             */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        BatchLifecycleRequest: {
            /**
             * @example NORMAL
             * @enum {string}
             */
            lifecycle: "NORMAL" | "QUARANTINED" | "DISPOSED";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 质检隔离
             */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        InventoryMovement: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example move-1
             */
            movementId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example batch-1
             */
            batchId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example SKU-001
             */
            skuId: string;
            /** @example null */
            orderId: string | null;
            /**
             * @example RECEIVE
             * @enum {string}
             */
            type: "RECEIVE" | "RESERVE" | "RELEASE" | "PICK_OUT" | "RETURN_PASS" | "RETURN_QUARANTINE" | "QUARANTINE" | "DISPOSE" | "ADJUST";
            /** @example 0 */
            onHandDelta: number;
            /** @example 1 */
            reservedDelta: number;
            /** @example 0 */
            quarantinedDelta: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 下单预占
             */
            reason: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u-picker-1
             */
            actorId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
        };
        Allocation: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example alloc-1
             */
            allocationId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example oi-1
             */
            orderItemId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example batch-1
             */
            batchId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example B20261018-001
             */
            batchNo: string;
            /**
             * @example PIECE
             * @enum {string}
             */
            baseUnit: "PIECE" | "GRAM";
            /** @example 1 */
            reservedQuantity: number;
            /** @example 0 */
            pickedQuantity: number;
            /** @example 0 */
            returnedQuantity: number;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        MaskedContact: {
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 测**
             */
            recipientName: string;
            /**
             * @description 按权限脱敏；不用于真实派送拨号
             * @example 138****8000
             */
            phoneMasked: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市松江区
             */
            region: string;
        };
        AdminOrder: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example FM20261018000123
             */
            orderNo: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u1001
             */
            memberId: string;
            /**
             * @example PENDING_PAY
             * @enum {string}
             */
            status: "PENDING_PAY" | "PAID" | "PICKING" | "READY_TO_SHIP" | "DELIVERING" | "FINISHED" | "CANCELED" | "CLOSED";
            items: components["schemas"]["OrderItem"][];
            price: components["schemas"]["PriceSummary"];
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            paidAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            refundedAmount: number;
            contact: components["schemas"]["MaskedContact"];
            slot: components["schemas"]["DeliverySlot"];
            /** @example null */
            weightAdjustment: components["schemas"]["WeightAdjustment"] | null;
            refunds: components["schemas"]["Refund"][];
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 仅当前角色当前数据范围可执行动作；OPERATOR/FINANCE通常为空
             * @example []
             */
            allowedActions: "CANCEL"[];
        };
        PickTask: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example pick-1
             */
            taskId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example UNASSIGNED
             * @enum {string}
             */
            status: "UNASSIGNED" | "CLAIMED" | "COMPLETED" | "CANCELED";
            /** @example null */
            pickerId: string | null;
            items: components["schemas"]["OrderItem"][];
            allocations: components["schemas"]["Allocation"][];
            slot: components["schemas"]["DeliverySlot"];
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        ReallocateLine: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example oi-1
             */
            orderItemId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example batch-2
             */
            batchId: string;
            /** @example 1 */
            quantity: number;
        };
        ReallocateRequest: {
            allocations: components["schemas"]["ReallocateLine"][];
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 原批次拣货时发现质量问题
             */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        PickConfirmLine: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example alloc-1
             */
            allocationId: string;
            /**
             * @description 明确实拣基础单位数量，PIECE为件，GRAM为克；允许0。按件不得超过预占，按重0至floor(估重×1.1)。
             * @example 1
             */
            actualQuantity: number;
            /**
             * @example NORMAL
             * @enum {string}
             */
            reasonCode: "NORMAL" | "SHORTAGE" | "WEIGHT_VARIANCE";
            /** @example 正常拣货 */
            reason: string;
        } & unknown;
        PickConfirmRequest: {
            allocations: components["schemas"]["PickConfirmLine"][];
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        PickConfirmResult: {
            task: components["schemas"]["PickTask"];
            /**
             * @example READY_TO_SHIP
             * @enum {string}
             */
            orderStatus: "PENDING_PAY" | "PAID" | "PICKING" | "READY_TO_SHIP" | "DELIVERING" | "FINISHED" | "CANCELED" | "CLOSED";
            /** @example null */
            weightAdjustment: components["schemas"]["WeightAdjustment"] | null;
        };
        ReturnAllocationInput: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example alloc-1
             */
            allocationId: string;
            /** @example 1 */
            passedQuantity: number;
            /** @example 0 */
            quarantinedQuantity: number;
        };
        ReturnReceiveRequest: {
            allocations: components["schemas"]["ReturnAllocationInput"][];
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 取消订单实物已收回并完成质检
             */
            inspectionNote: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        DeliveryTask: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example delivery-1
             */
            taskId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example PENDING_DISPATCH
             * @enum {string}
             */
            status: "PENDING_DISPATCH" | "DELIVERING" | "COMPLETED" | "EXCEPTION" | "CANCELED";
            /** @example null */
            courierId: string | null;
            contact: components["schemas"]["MaskedContact"];
            slot: components["schemas"]["DeliverySlot"];
            /** @example null */
            dispatchedAt: string | null;
            /** @example null */
            completedAt: string | null;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        DeliveryDispatchRequest: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u-courier-1
             */
            courierId: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        DeliveryCompleteRequest: {
            /**
             * @description 配送签收一次性凭证；不得用公开订单号代替
             * @example 123456
             */
            proofCode: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 用户确认收货
             */
            note?: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        DeliveryExceptionRequest: {
            /**
             * @example RECIPIENT_UNREACHABLE
             * @enum {string}
             */
            type: "RECIPIENT_UNREACHABLE" | "DAMAGED" | "DELAYED" | "OTHER";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 预约时段联系不上收货人
             */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        AftersaleReviewRequest: {
            approvedItems: components["schemas"]["AftersaleLineInput"][];
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 照片证据清晰，批准实付范围退款
             */
            comment: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        AftersaleRejectRequest: {
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 申请超过已完成7天期限
             */
            comment: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        AdminAftersale: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example after-1
             */
            aftersaleId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @example QUALITY
             * @enum {string}
             */
            type: "QUALITY" | "SHORTAGE" | "LATE";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 商品质量问题
             */
            reason: string;
            items: components["schemas"]["AftersaleLineInput"][];
            evidenceMediaIds: string[];
            /**
             * @example APPLIED
             * @enum {string}
             */
            status: "APPLIED" | "APPROVED" | "REJECTED" | "REFUNDING" | "COMPLETED" | "CANCELED";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 590
             */
            requestedAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            approvedAmount: number;
            /** @example null */
            reviewComment: string | null;
            refunds: components["schemas"]["Refund"][];
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            appliedAt: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u1001
             */
            memberId: string;
            /** @example null */
            reviewerId: string | null;
            contact: components["schemas"]["MaskedContact"];
            /**
             * @description 领取客服账号ID；用于领取后证据访问，reviewerId仅在正式审核后设置
             * @example null
             */
            assigneeId: string | null;
        };
        AdminRefund: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example refund-1
             */
            refundId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            orderId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example pay-1
             */
            paymentId: string;
            /** @example null */
            aftersaleId: string | null;
            /** @example null */
            adjustmentId: string | null;
            /**
             * @example AFTERSALE
             * @enum {string}
             */
            type: "AFTERSALE" | "CANCEL" | "WEIGHT_DIFFERENCE" | "LATE_PAYMENT" | "DUPLICATE_PAYMENT";
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 24
             */
            amount: number;
            /**
             * @example CNY
             * @enum {string}
             */
            currency: "CNY";
            /**
             * @example PENDING
             * @enum {string}
             */
            status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 称重退差
             */
            reason: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
            /** @example null */
            completedAt: string | null;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /** @example null */
            reviewerId: string | null;
            /** @example null */
            executorId: string | null;
            /** @example null */
            lastError: string | null;
        };
        RefundExecuteRequest: {
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 复核通过，执行原路沙箱退款
             */
            reason: string;
        };
        Reconciliation: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example recon-1
             */
            reconciliationId: string;
            /**
             * Format: date
             * @example 2026-10-18
             */
            businessDate: string;
            /**
             * @example PENDING
             * @enum {string}
             */
            status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
            /** @example 1 */
            paymentCount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 1190
             */
            paymentAmount: number;
            /** @example 0 */
            refundCount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            refundAmount: number;
            /** @example 0 */
            differenceAmount: number;
            /** @example 0 */
            differenceCount: number;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
            /** @example null */
            completedAt: string | null;
        };
        ReconciliationRequest: {
            /**
             * Format: date
             * @example 2026-10-18
             */
            businessDate: string;
        };
        AuditLog: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example audit-1
             */
            auditId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u1001
             */
            actorId: string;
            actorRoles: ("MEMBER" | "PICKER" | "COURIER" | "OPERATOR" | "SERVICE" | "FINANCE" | "ADMIN")[];
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example ORDER_CANCEL
             */
            action: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example ORDER
             */
            resourceType: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example order-1
             */
            resourceId: string;
            /**
             * @example SUCCESS
             * @enum {string}
             */
            result: "SUCCESS" | "DENIED" | "FAILED";
            /** @example null */
            reason: string | null;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            occurredAt: string;
        };
        Employee: {
            /** @example true */
            mustChangePassword: boolean;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example emp-1
             */
            employeeId: string;
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example u-picker-1
             */
            userId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示仓储
             */
            displayName: string;
            /**
             * @description 脱敏手机号
             * @example 139****0001
             */
            phoneMasked: string;
            roles: ("MEMBER" | "PICKER" | "COURIER" | "OPERATOR" | "SERVICE" | "FINANCE" | "ADMIN")[];
            /**
             * @example ACTIVE
             * @enum {string}
             */
            status: "ACTIVE" | "DISABLED";
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        EmployeeCreateRequest: {
            /**
             * @description 中国大陆手机号
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 演示仓储
             */
            displayName: string;
            /**
             * @description 密码仅请求使用；服务器强哈希存储
             * @example DemoPassword123!
             */
            temporaryPassword: string;
            roles: ("MEMBER" | "PICKER" | "COURIER" | "OPERATOR" | "SERVICE" | "FINANCE" | "ADMIN")[];
        };
        EmployeeRolesRequest: {
            roles: ("MEMBER" | "PICKER" | "COURIER" | "OPERATOR" | "SERVICE" | "FINANCE" | "ADMIN")[];
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 调整岗位职责；MEMBER须显式授予
             */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        EmployeeStatusRequest: {
            /**
             * @example ACTIVE
             * @enum {string}
             */
            status: "ACTIVE" | "DISABLED";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 账号停用
             */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        Role: {
            /**
             * @example MEMBER
             * @enum {string}
             */
            code: "MEMBER" | "PICKER" | "COURIER" | "OPERATOR" | "SERVICE" | "FINANCE" | "ADMIN";
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 会员
             */
            name: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 注册账号基础购物权限；员工身份与购物权限独立
             */
            description: string;
            permissionKeys: string[];
        };
        SlotPolicyUpdateRequest: {
            /** @example 30 */
            capacity: number;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            cutoffAt: string;
            /** @example true */
            enabled: boolean;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        BusinessPolicies: {
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 600
             */
            freightAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 9900
             */
            freeShippingThresholdAmount: number;
            /** @example 3 */
            nearExpiryDays: number;
            /** @example 9000 */
            nearExpiryDiscountBasisPoints: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 500
             */
            newcomerCouponAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 3000
             */
            newcomerCouponMinGoodsAmount: number;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        Dashboard: {
            /**
             * Format: date
             * @example 2026-10-18
             */
            businessDate: string;
            /** @example 1 */
            paidOrderCount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 1190
             */
            capturedPaymentAmount: number;
            /**
             * @description CNY整数分，服务端计算；不得使用浮点金额
             * @example 0
             */
            successfulRefundAmount: number;
            /** @example 1190 */
            netCollectedAmount: number;
            /** @example 1 */
            pendingPickCount: number;
            /** @example 0 */
            nearExpiryBatchCount: number;
            /** @example 0 */
            lowStockSkuCount: number;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            generatedAt: string;
        };
        CsrfTokenEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["CsrfToken"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AuthSessionEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AuthSession"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        CommandResultEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["CommandResult"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        UserEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["User"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        HomeEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Home"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        CategoryList: {
            /**
             * @example [
             *       {
             *         "categoryId": "C01",
             *         "code": "C01",
             *         "name": "时令蔬菜",
             *         "shortName": "蔬菜",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "sortOrder": 1
             *       }
             *     ]
             */
            items: components["schemas"]["Category"][];
        };
        CategoryListEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["CategoryList"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ProductPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "productId": "S001",
             *         "spuCode": "S001",
             *         "categoryId": "C01",
             *         "name": "沙瓤番茄",
             *         "description": "新鲜番茄；以实际商品为准",
             *         "origin": "山东寿光",
             *         "storage": "COLD",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "price": 690,
             *         "memberPrice": 590,
             *         "salePrice": 590,
             *         "priceMode": "BY_PIECE",
             *         "unitLabel": "500g/份",
             *         "stockStatus": "IN_STOCK",
             *         "nearExpiry": false,
             *         "skus": [
             *           {
             *             "skuId": "SKU-001",
             *             "skuCode": "SKU-001",
             *             "name": "沙瓤番茄500g/份",
             *             "unitLabel": "500g/份",
             *             "baseUnit": "PIECE",
             *             "priceMode": "BY_PIECE",
             *             "priceUnitGram": null,
             *             "price": 690,
             *             "memberPrice": 590,
             *             "salePrice": 590,
             *             "stockStatus": "IN_STOCK",
             *             "nearExpiry": false,
             *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *             "version": 1,
             *             "arrivedAt": null,
             *             "freshness": null,
             *             "shelfLifeRemainingDays": null
             *           }
             *         ],
             *         "version": 1,
             *         "arrivedAt": null,
             *         "freshness": null,
             *         "shelfLifeRemainingDays": null
             *       }
             *     ]
             */
            items: components["schemas"]["Product"][];
        };
        ProductPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["ProductPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ProductEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Product"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ReviewPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "reviewId": "review-1",
             *         "productId": "S001",
             *         "displayName": "演示会员",
             *         "rating": 5,
             *         "content": "商品新鲜，配送及时",
             *         "imageUrls": [],
             *         "createdAt": "2026-10-18T14:00:00+08:00"
             *       }
             *     ]
             */
            items: components["schemas"]["Review"][];
        };
        ReviewPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["ReviewPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        CartEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Cart"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AddressList: {
            /**
             * @example [
             *       {
             *         "addressId": "addr-1",
             *         "recipientName": "测试用户",
             *         "phone": "13800138000",
             *         "province": "上海市",
             *         "city": "上海市",
             *         "district": "松江区",
             *         "detail": "演示路1号",
             *         "isDefault": true,
             *         "serviceable": true,
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["Address"][];
        };
        AddressListEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AddressList"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AddressEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Address"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        DeliverySlotList: {
            /**
             * @example [
             *       {
             *         "slotId": "slot-20261018-2",
             *         "date": "2026-10-18",
             *         "label": "14:00–17:00",
             *         "startAt": "2026-10-18T14:00:00+08:00",
             *         "endAt": "2026-10-18T17:00:00+08:00",
             *         "cutoffAt": "2026-10-18T13:30:00+08:00",
             *         "remaining": 20,
             *         "available": true,
             *         "unavailableReason": null,
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["DeliverySlot"][];
        };
        DeliverySlotListEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["DeliverySlotList"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        CouponList: {
            /**
             * @example [
             *       {
             *         "couponId": "coupon-1",
             *         "name": "新人券",
             *         "discountAmount": 500,
             *         "minGoodsAmount": 3000,
             *         "status": "AVAILABLE",
             *         "expiresAt": "2026-10-18T14:00:00+08:00",
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["Coupon"][];
        };
        CouponListEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["CouponList"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        QuoteEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Quote"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        OrderEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Order"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        OrderPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "orderId": "order-1",
             *         "orderNo": "FM20261018000123",
             *         "status": "PENDING_PAY",
             *         "currency": "CNY",
             *         "items": [
             *           {
             *             "orderItemId": "oi-1",
             *             "skuId": "SKU-001",
             *             "productId": "S001",
             *             "productName": "沙瓤番茄",
             *             "unitLabel": "500g/份",
             *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *             "baseUnit": "PIECE",
             *             "priceMode": "BY_PIECE",
             *             "quantity": 1,
             *             "estimatedGram": null,
             *             "actualGram": null,
             *             "priceUnitGram": null,
             *             "unitPrice": 590,
             *             "couponAllocationAmount": 0,
             *             "originalPayableAmount": 590,
             *             "finalPayableAmount": null,
             *             "refundedAmount": 0
             *           }
             *         ],
             *         "price": {
             *           "referenceGoodsAmount": 690,
             *           "memberGoodsAmount": 590,
             *           "nearExpiryDiscountAmount": 0,
             *           "couponDiscountAmount": 0,
             *           "goodsPayableAmount": 590,
             *           "freightAmount": 600,
             *           "payableAmount": 1190,
             *           "freeShippingThresholdAmount": 9900,
             *           "freeShippingGapAmount": 9310
             *         },
             *         "paidAmount": 0,
             *         "refundedAmount": 0,
             *         "address": {
             *           "addressId": "addr-1",
             *           "recipientName": "测试用户",
             *           "phone": "13800138000",
             *           "province": "上海市",
             *           "city": "上海市",
             *           "district": "松江区",
             *           "detail": "演示路1号",
             *           "isDefault": true,
             *           "serviceable": true,
             *           "version": 1
             *         },
             *         "slot": {
             *           "slotId": "slot-20261018-2",
             *           "date": "2026-10-18",
             *           "label": "14:00–17:00",
             *           "startAt": "2026-10-18T14:00:00+08:00",
             *           "endAt": "2026-10-18T17:00:00+08:00",
             *           "cutoffAt": "2026-10-18T13:30:00+08:00",
             *           "remaining": 20,
             *           "available": true,
             *           "unavailableReason": null,
             *           "version": 1
             *         },
             *         "weightAdjustment": null,
             *         "refunds": [],
             *         "buyerNote": null,
             *         "createdAt": "2026-10-18T13:00:00+08:00",
             *         "paymentExpiresAt": "2026-10-18T13:15:00+08:00",
             *         "paidAt": null,
             *         "finishedAt": null,
             *         "version": 1,
             *         "allowedActions": [
             *           "PAY",
             *           "CANCEL"
             *         ],
             *         "deliveryReceiptCode": null
             *       }
             *     ]
             */
            items: components["schemas"]["Order"][];
        };
        OrderPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["OrderPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        OrderStatusEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["OrderStatus"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        PaymentEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Payment"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        CallbackReceiptEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["CallbackReceipt"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        RefundEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Refund"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AftersaleEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Aftersale"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AftersalePage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "aftersaleId": "after-1",
             *         "orderId": "order-1",
             *         "type": "QUALITY",
             *         "reason": "商品质量问题",
             *         "items": [
             *           {
             *             "orderItemId": "oi-1",
             *             "quantity": 1,
             *             "requestedAmount": 590
             *           }
             *         ],
             *         "evidenceMediaIds": [],
             *         "status": "APPLIED",
             *         "requestedAmount": 590,
             *         "approvedAmount": 0,
             *         "reviewComment": null,
             *         "refunds": [],
             *         "appliedAt": "2026-10-18T14:00:00+08:00",
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["Aftersale"][];
        };
        AftersalePageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AftersalePage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ReviewEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Review"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        DashboardEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Dashboard"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminProductPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "productId": "S001",
             *         "spuCode": "S001",
             *         "categoryId": "C01",
             *         "name": "沙瓤番茄",
             *         "description": "新鲜番茄；以实际商品为准",
             *         "origin": "山东寿光",
             *         "storage": "COLD",
             *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *         "price": 690,
             *         "memberPrice": 590,
             *         "salePrice": 590,
             *         "priceMode": "BY_PIECE",
             *         "unitLabel": "500g/份",
             *         "stockStatus": "IN_STOCK",
             *         "nearExpiry": false,
             *         "skus": [
             *           {
             *             "skuId": "SKU-001",
             *             "skuCode": "SKU-001",
             *             "name": "沙瓤番茄500g/份",
             *             "unitLabel": "500g/份",
             *             "baseUnit": "PIECE",
             *             "priceMode": "BY_PIECE",
             *             "priceUnitGram": null,
             *             "price": 690,
             *             "memberPrice": 590,
             *             "salePrice": 590,
             *             "stockStatus": "IN_STOCK",
             *             "nearExpiry": false,
             *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *             "version": 1,
             *             "arrivedAt": null,
             *             "freshness": null,
             *             "shelfLifeRemainingDays": null
             *           }
             *         ],
             *         "version": 1,
             *         "status": "DRAFT",
             *         "arrivedAt": null,
             *         "freshness": null,
             *         "shelfLifeRemainingDays": null
             *       }
             *     ]
             */
            items: components["schemas"]["AdminProduct"][];
        };
        AdminProductPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminProductPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminProductEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminProduct"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        SkuEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Sku"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        BatchPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "batchId": "batch-1",
             *         "batchNo": "B20261018-001",
             *         "skuId": "SKU-001",
             *         "baseUnit": "PIECE",
             *         "onHand": 100,
             *         "reserved": 5,
             *         "quarantined": 0,
             *         "available": 95,
             *         "lifecycle": "NORMAL",
             *         "freshness": "NORMAL",
             *         "producedAt": "2026-10-18T00:00:00+08:00",
             *         "expiresAt": "2026-10-21T23:59:59+08:00",
             *         "receivedAt": "2026-10-18T14:00:00+08:00",
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["Batch"][];
        };
        BatchPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["BatchPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        BatchEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Batch"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        InventoryMovementPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "movementId": "move-1",
             *         "batchId": "batch-1",
             *         "skuId": "SKU-001",
             *         "orderId": null,
             *         "type": "RECEIVE",
             *         "onHandDelta": 0,
             *         "reservedDelta": 1,
             *         "quarantinedDelta": 0,
             *         "reason": "下单预占",
             *         "actorId": "u-picker-1",
             *         "createdAt": "2026-10-18T14:00:00+08:00"
             *       }
             *     ]
             */
            items: components["schemas"]["InventoryMovement"][];
        };
        InventoryMovementPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["InventoryMovementPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminOrderPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "orderId": "order-1",
             *         "orderNo": "FM20261018000123",
             *         "memberId": "u1001",
             *         "status": "PENDING_PAY",
             *         "items": [
             *           {
             *             "orderItemId": "oi-1",
             *             "skuId": "SKU-001",
             *             "productId": "S001",
             *             "productName": "沙瓤番茄",
             *             "unitLabel": "500g/份",
             *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *             "baseUnit": "PIECE",
             *             "priceMode": "BY_PIECE",
             *             "quantity": 1,
             *             "estimatedGram": null,
             *             "actualGram": null,
             *             "priceUnitGram": null,
             *             "unitPrice": 590,
             *             "couponAllocationAmount": 0,
             *             "originalPayableAmount": 590,
             *             "finalPayableAmount": null,
             *             "refundedAmount": 0
             *           }
             *         ],
             *         "price": {
             *           "referenceGoodsAmount": 690,
             *           "memberGoodsAmount": 590,
             *           "nearExpiryDiscountAmount": 0,
             *           "couponDiscountAmount": 0,
             *           "goodsPayableAmount": 590,
             *           "freightAmount": 600,
             *           "payableAmount": 1190,
             *           "freeShippingThresholdAmount": 9900,
             *           "freeShippingGapAmount": 9310
             *         },
             *         "paidAmount": 0,
             *         "refundedAmount": 0,
             *         "contact": {
             *           "recipientName": "测**",
             *           "phoneMasked": "138****8000",
             *           "region": "上海市松江区"
             *         },
             *         "slot": {
             *           "slotId": "slot-20261018-2",
             *           "date": "2026-10-18",
             *           "label": "14:00–17:00",
             *           "startAt": "2026-10-18T14:00:00+08:00",
             *           "endAt": "2026-10-18T17:00:00+08:00",
             *           "cutoffAt": "2026-10-18T13:30:00+08:00",
             *           "remaining": 20,
             *           "available": true,
             *           "unavailableReason": null,
             *           "version": 1
             *         },
             *         "weightAdjustment": null,
             *         "refunds": [],
             *         "createdAt": "2026-10-18T14:00:00+08:00",
             *         "version": 1,
             *         "allowedActions": []
             *       }
             *     ]
             */
            items: components["schemas"]["AdminOrder"][];
        };
        AdminOrderPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminOrderPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminOrderEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminOrder"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        PickTaskPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "taskId": "pick-1",
             *         "orderId": "order-1",
             *         "status": "UNASSIGNED",
             *         "pickerId": null,
             *         "items": [
             *           {
             *             "orderItemId": "oi-1",
             *             "skuId": "SKU-001",
             *             "productId": "S001",
             *             "productName": "沙瓤番茄",
             *             "unitLabel": "500g/份",
             *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
             *             "baseUnit": "PIECE",
             *             "priceMode": "BY_PIECE",
             *             "quantity": 1,
             *             "estimatedGram": null,
             *             "actualGram": null,
             *             "priceUnitGram": null,
             *             "unitPrice": 590,
             *             "couponAllocationAmount": 0,
             *             "originalPayableAmount": 590,
             *             "finalPayableAmount": null,
             *             "refundedAmount": 0
             *           }
             *         ],
             *         "allocations": [
             *           {
             *             "allocationId": "alloc-1",
             *             "orderItemId": "oi-1",
             *             "batchId": "batch-1",
             *             "batchNo": "B20261018-001",
             *             "baseUnit": "PIECE",
             *             "reservedQuantity": 1,
             *             "pickedQuantity": 0,
             *             "returnedQuantity": 0,
             *             "version": 1
             *           }
             *         ],
             *         "slot": {
             *           "slotId": "slot-20261018-2",
             *           "date": "2026-10-18",
             *           "label": "14:00–17:00",
             *           "startAt": "2026-10-18T14:00:00+08:00",
             *           "endAt": "2026-10-18T17:00:00+08:00",
             *           "cutoffAt": "2026-10-18T13:30:00+08:00",
             *           "remaining": 20,
             *           "available": true,
             *           "unavailableReason": null,
             *           "version": 1
             *         },
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["PickTask"][];
        };
        PickTaskPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["PickTaskPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        PickTaskEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["PickTask"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        PickConfirmResultEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["PickConfirmResult"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        DeliveryTaskPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "taskId": "delivery-1",
             *         "orderId": "order-1",
             *         "status": "PENDING_DISPATCH",
             *         "courierId": null,
             *         "contact": {
             *           "recipientName": "测**",
             *           "phoneMasked": "138****8000",
             *           "region": "上海市松江区"
             *         },
             *         "slot": {
             *           "slotId": "slot-20261018-2",
             *           "date": "2026-10-18",
             *           "label": "14:00–17:00",
             *           "startAt": "2026-10-18T14:00:00+08:00",
             *           "endAt": "2026-10-18T17:00:00+08:00",
             *           "cutoffAt": "2026-10-18T13:30:00+08:00",
             *           "remaining": 20,
             *           "available": true,
             *           "unavailableReason": null,
             *           "version": 1
             *         },
             *         "dispatchedAt": null,
             *         "completedAt": null,
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["DeliveryTask"][];
        };
        DeliveryTaskPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["DeliveryTaskPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        DeliveryTaskEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["DeliveryTask"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminAftersalePage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "aftersaleId": "after-1",
             *         "orderId": "order-1",
             *         "type": "QUALITY",
             *         "reason": "商品质量问题",
             *         "items": [
             *           {
             *             "orderItemId": "oi-1",
             *             "quantity": 1,
             *             "requestedAmount": 590
             *           }
             *         ],
             *         "evidenceMediaIds": [],
             *         "status": "APPLIED",
             *         "requestedAmount": 590,
             *         "approvedAmount": 0,
             *         "reviewComment": null,
             *         "refunds": [],
             *         "appliedAt": "2026-10-18T14:00:00+08:00",
             *         "version": 1,
             *         "memberId": "u1001",
             *         "reviewerId": null,
             *         "contact": {
             *           "recipientName": "测**",
             *           "phoneMasked": "138****8000",
             *           "region": "上海市松江区"
             *         },
             *         "assigneeId": null
             *       }
             *     ]
             */
            items: components["schemas"]["AdminAftersale"][];
        };
        AdminAftersalePageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminAftersalePage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminAftersaleEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminAftersale"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminRefundPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "refundId": "refund-1",
             *         "orderId": "order-1",
             *         "paymentId": "pay-1",
             *         "aftersaleId": null,
             *         "adjustmentId": null,
             *         "type": "AFTERSALE",
             *         "amount": 24,
             *         "currency": "CNY",
             *         "status": "PENDING",
             *         "reason": "称重退差",
             *         "createdAt": "2026-10-18T14:00:00+08:00",
             *         "completedAt": null,
             *         "version": 1,
             *         "reviewerId": null,
             *         "executorId": null,
             *         "lastError": null
             *       }
             *     ]
             */
            items: components["schemas"]["AdminRefund"][];
        };
        AdminRefundPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminRefundPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AdminRefundEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AdminRefund"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ReconciliationPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "reconciliationId": "recon-1",
             *         "businessDate": "2026-10-18",
             *         "status": "PENDING",
             *         "paymentCount": 1,
             *         "paymentAmount": 1190,
             *         "refundCount": 0,
             *         "refundAmount": 0,
             *         "differenceAmount": 0,
             *         "differenceCount": 0,
             *         "createdAt": "2026-10-18T14:00:00+08:00",
             *         "completedAt": null
             *       }
             *     ]
             */
            items: components["schemas"]["Reconciliation"][];
        };
        ReconciliationPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["ReconciliationPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ReconciliationEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Reconciliation"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        AuditLogPage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "auditId": "audit-1",
             *         "actorId": "u1001",
             *         "actorRoles": [
             *           "MEMBER"
             *         ],
             *         "action": "ORDER_CANCEL",
             *         "resourceType": "ORDER",
             *         "resourceId": "order-1",
             *         "result": "SUCCESS",
             *         "reason": null,
             *         "traceId": "trace-demo-001",
             *         "occurredAt": "2026-10-18T14:00:00+08:00"
             *       }
             *     ]
             */
            items: components["schemas"]["AuditLog"][];
        };
        AuditLogPageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["AuditLogPage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        EmployeePage: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            size: number;
            /** @example 1 */
            total: number;
            /**
             * @example [
             *       {
             *         "mustChangePassword": true,
             *         "employeeId": "emp-1",
             *         "userId": "u-picker-1",
             *         "displayName": "演示仓储",
             *         "phoneMasked": "139****0001",
             *         "roles": [
             *           "MEMBER"
             *         ],
             *         "status": "ACTIVE",
             *         "version": 1
             *       }
             *     ]
             */
            items: components["schemas"]["Employee"][];
        };
        EmployeePageEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["EmployeePage"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        EmployeeEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["Employee"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        RoleList: {
            /**
             * @example [
             *       {
             *         "code": "MEMBER",
             *         "name": "会员",
             *         "description": "注册账号基础购物权限；员工身份与购物权限独立",
             *         "permissionKeys": []
             *       }
             *     ]
             */
            items: components["schemas"]["Role"][];
        };
        RoleListEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["RoleList"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        DeliverySlotEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["DeliverySlot"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        BusinessPoliciesEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["BusinessPolicies"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        MediaReferenceEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["MediaReference"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        MediaAccessEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["MediaAccess"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        DeliveryContact: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example delivery-1
             */
            taskId: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 测试用户
             */
            recipientName: string;
            /**
             * @description 配送联系电话
             * @example 13800138000
             */
            phone: string;
            /**
             * @description 文本；服务端校验长度并以纯文本处理
             * @example 上海市松江区演示路1号
             */
            addressDetail: string;
        };
        DeliveryContactEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["DeliveryContact"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ContactAccessRequest: {
            /**
             * @example DELIVERY_CONTACT
             * @enum {string}
             */
            purpose: "DELIVERY_CONTACT";
            /** @example 预约配送联系用户 */
            reason: string;
            /**
             * @description 资源乐观锁版本；写入时必须与当前version一致，否则409
             * @example 1
             */
            version: number;
        };
        ProductMediaUploadRequest: {
            /** @example null */
            productId: string | null;
            /**
             * Format: binary
             * @description multipart真实二进制文件；示例只是字段形态，传输时由客户端形成boundary
             * @example <binary image bytes>
             */
            file: string;
        };
        ProductMedia: {
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example media-1
             */
            mediaId: string;
            /**
             * @example PRODUCT
             * @enum {string}
             */
            purpose: "PRODUCT";
            /**
             * @example image/jpeg
             * @enum {string}
             */
            mimeType: "image/jpeg" | "image/png" | "image/webp";
            /** @example 102400 */
            sizeBytes: number;
            /**
             * @example READY
             * @enum {string}
             */
            status: "PENDING_SCAN" | "READY" | "REJECTED";
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T14:00:00+08:00
             */
            createdAt: string;
            /**
             * Format: uri
             * @description 图片地址；开发静态目录以实际部署base URL拼接
             * @example http://localhost:8080/static/products/S001.jpg
             */
            publicUrl: string;
        };
        ProductMediaEnvelope: {
            /**
             * @example 0
             * @constant
             */
            code: 0;
            /**
             * @example ok
             * @constant
             */
            message: "ok";
            data: components["schemas"]["ProductMedia"];
            /**
             * @description 对外字符串ID；不将bigint作为JSON数字传输
             * @example trace-demo-001
             */
            traceId: string;
            /**
             * Format: date-time
             * @description RFC3339带时区；业务日界以Asia/Shanghai解释
             * @example 2026-10-18T13:00:00+08:00
             */
            timestamp: string;
        };
        ResolveDeliveryExceptionRequest: {
            /** @example 已联系收货人确认继续配送 */
            reason: string;
            /**
             * @description 当前配送任务version；恢复时CAS校验，不匹配409
             * @example 2
             */
            expectedVersion: number;
        };
    };
    responses: {
        /** @description HTTP 400: 请求参数不合法。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        BadRequest: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1001,
                 *       "message": "请求参数不合法",
                 *       "data": {
                 *         "errorKey": "VALIDATION_ERROR",
                 *         "retryable": false,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 401: 需要重新登录。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        Unauthorized: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1002,
                 *       "message": "需要重新登录",
                 *       "data": {
                 *         "errorKey": "UNAUTHENTICATED",
                 *         "retryable": false,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 403: 无操作权限或来源校验失败。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        Forbidden: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1003,
                 *       "message": "无操作权限或来源校验失败",
                 *       "data": {
                 *         "errorKey": "FORBIDDEN",
                 *         "retryable": false,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 404: 资源不存在。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        NotFound: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1004,
                 *       "message": "资源不存在",
                 *       "data": {
                 *         "errorKey": "NOT_FOUND",
                 *         "retryable": false,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 409: 资源版本或业务状态冲突。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        Conflict: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1009,
                 *       "message": "资源版本或业务状态冲突",
                 *       "data": {
                 *         "errorKey": "VERSION_CONFLICT",
                 *         "retryable": false,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 422: 库存或业务条件不满足。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        Unprocessable: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1201,
                 *       "message": "库存或业务条件不满足",
                 *       "data": {
                 *         "errorKey": "INSUFFICIENT_STOCK",
                 *         "retryable": false,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 429: 操作频繁，请稍后重试。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        RateLimited: {
            headers: {
                "X-Trace-Id"?: string;
                /** @description 建议重试等待秒数；前端遵从并避免刷新风暴 */
                "Retry-After"?: number;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1029,
                 *       "message": "操作频繁，请稍后重试",
                 *       "data": {
                 *         "errorKey": "RATE_LIMITED",
                 *         "retryable": true,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 500: 系统暂时不可用。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        InternalError: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1050,
                 *       "message": "系统暂时不可用",
                 *       "data": {
                 *         "errorKey": "INTERNAL_ERROR",
                 *         "retryable": true,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description HTTP 503: 沙箱渠道暂时不可用。具体errorKey以该操作x-error-codes为准；错误也返回traceId。 */
        Unavailable: {
            headers: {
                "X-Trace-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 1303,
                 *       "message": "沙箱渠道暂时不可用",
                 *       "data": {
                 *         "errorKey": "CHANNEL_UNAVAILABLE",
                 *         "retryable": true,
                 *         "details": []
                 *       },
                 *       "traceId": "trace-demo-001",
                 *       "timestamp": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
    };
    parameters: {
        Page: number;
        Size: number;
        /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
        IdempotencyKey: string;
        /** @description GET /auth/csrf取得；服务端同时校验绑定cookie、允许Origin及token。 */
        Csrf: string;
        /** @description 浏览器自动发送；仅配置的精确allowlist；非浏览器客户端同样不得略过CSRF。 */
        Origin: string;
        /** @description 小写hex HMAC-SHA256(secret, timestamp + "\n" + nonce + "\n" + 原始请求UTF-8字节)；密钥仅渠道模拟器与后端持有。 */
        Signature: string;
        /** @description 渠道签名时间Unix秒，允许服务器时钟±300秒；与body occurredAt分开。 */
        CallbackTimestamp: string;
        /** @description 签名随机数；防重放，结合eventId持久化。 */
        CallbackNonce: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getCsrfToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    /** @description 设置随机csrf_context HttpOnly/Secure/SameSite=Lax cookie，Path=/api/v1/auth，绑定响应csrfToken，10分钟有效；本地http仅开发可不用Secure。 */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "csrfToken": "csrf-demo-token-001",
                     *         "expiresAt": "2026-10-18T14:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CsrfTokenEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    registerMember: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /auth/csrf取得；服务端同时校验绑定cookie、允许Origin及token。 */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description 浏览器自动发送；仅配置的精确allowlist；非浏览器客户端同样不得略过CSRF。 */
                Origin: components["parameters"]["Origin"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "phone": "13800138000",
                 *       "password": "DemoPassword123!",
                 *       "displayName": "演示会员"
                 *     }
                 */
                "application/json": components["schemas"]["RegisterRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    /** @description 注册成功建立refresh_token并轮换csrf_context；注册只授予MEMBER，不能提交员工角色。 */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accessToken": "demo.access.token",
                     *         "tokenType": "Bearer",
                     *         "expiresIn": 900,
                     *         "user": {
                     *           "mustChangePassword": false,
                     *           "userId": "u1001",
                     *           "displayName": "演示会员",
                     *           "phoneMasked": "138****8000",
                     *           "roles": [
                     *             "MEMBER"
                     *           ],
                     *           "status": "ACTIVE",
                     *           "version": 1,
                     *           "permissions": [
                     *             "catalog.read",
                     *             "auth.self",
                     *             "order.create",
                     *             "order.self.read"
                     *           ]
                     *         },
                     *         "csrfToken": "csrf-demo-token-001",
                     *         "csrfExpiresAt": "2026-10-18T13:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AuthSessionEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    login: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /auth/csrf取得；服务端同时校验绑定cookie、允许Origin及token。 */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description 浏览器自动发送；仅配置的精确allowlist；非浏览器客户端同样不得略过CSRF。 */
                Origin: components["parameters"]["Origin"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "phone": "13800138000",
                 *       "password": "DemoPassword123!"
                 *     }
                 */
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    /** @description 设置HttpOnly/Secure refresh_token，7天，Path=/api/v1/auth。登录失败401，身份状态不对外泄漏。 */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accessToken": "demo.access.token",
                     *         "tokenType": "Bearer",
                     *         "expiresIn": 900,
                     *         "user": {
                     *           "mustChangePassword": false,
                     *           "userId": "u1001",
                     *           "displayName": "演示会员",
                     *           "phoneMasked": "138****8000",
                     *           "roles": [
                     *             "MEMBER"
                     *           ],
                     *           "status": "ACTIVE",
                     *           "version": 1,
                     *           "permissions": [
                     *             "catalog.read",
                     *             "auth.self",
                     *             "order.create",
                     *             "order.self.read"
                     *           ]
                     *         },
                     *         "csrfToken": "csrf-demo-token-001",
                     *         "csrfExpiresAt": "2026-10-18T13:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AuthSessionEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    refreshSession: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /auth/csrf取得；服务端同时校验绑定cookie、允许Origin及token。 */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description 浏览器自动发送；仅配置的精确allowlist；非浏览器客户端同样不得略过CSRF。 */
                Origin: components["parameters"]["Origin"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    /** @description 原refresh一次性消耗，设置新refresh_token；重放吊销token family。 */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accessToken": "demo.access.token",
                     *         "tokenType": "Bearer",
                     *         "expiresIn": 900,
                     *         "user": {
                     *           "mustChangePassword": false,
                     *           "userId": "u1001",
                     *           "displayName": "演示会员",
                     *           "phoneMasked": "138****8000",
                     *           "roles": [
                     *             "MEMBER"
                     *           ],
                     *           "status": "ACTIVE",
                     *           "version": 1,
                     *           "permissions": [
                     *             "catalog.read",
                     *             "auth.self",
                     *             "order.create",
                     *             "order.self.read"
                     *           ]
                     *         },
                     *         "csrfToken": "csrf-demo-token-001",
                     *         "csrfExpiresAt": "2026-10-18T13:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AuthSessionEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    logout: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /auth/csrf取得；服务端同时校验绑定cookie、允许Origin及token。 */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description 浏览器自动发送；仅配置的精确allowlist；非浏览器客户端同样不得略过CSRF。 */
                Origin: components["parameters"]["Origin"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    /** @description 清除refresh_token（Max-Age=0），吊销当前会话access/refresh凭据。 */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accepted": true,
                     *         "resourceId": "1001",
                     *         "version": 1,
                     *         "message": "命令已受理；异步任务完成前不表示资金已到账"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CommandResultEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getCurrentUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mustChangePassword": false,
                     *         "userId": "u1001",
                     *         "displayName": "演示会员",
                     *         "phoneMasked": "138****8000",
                     *         "roles": [
                     *           "MEMBER"
                     *         ],
                     *         "status": "ACTIVE",
                     *         "version": 1,
                     *         "permissions": [
                     *           "catalog.read",
                     *           "auth.self",
                     *           "order.create",
                     *           "order.self.read"
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["UserEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getHome: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "banners": [
                     *           {
                     *             "bannerId": "banner-1",
                     *             "title": "预约鲜送",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "targetType": "CATEGORY",
                     *             "targetId": null
                     *           }
                     *         ],
                     *         "categories": [
                     *           {
                     *             "categoryId": "C01",
                     *             "code": "C01",
                     *             "name": "时令蔬菜",
                     *             "shortName": "蔬菜",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "sortOrder": 1
                     *           }
                     *         ],
                     *         "nearExpiryProducts": [],
                     *         "recommendedProducts": [
                     *           {
                     *             "productId": "S001",
                     *             "spuCode": "S001",
                     *             "categoryId": "C01",
                     *             "name": "沙瓤番茄",
                     *             "description": "新鲜番茄；以实际商品为准",
                     *             "origin": "山东寿光",
                     *             "storage": "COLD",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "priceMode": "BY_PIECE",
                     *             "unitLabel": "500g/份",
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "skus": [
                     *               {
                     *                 "skuId": "SKU-001",
                     *                 "skuCode": "SKU-001",
                     *                 "name": "沙瓤番茄500g/份",
                     *                 "unitLabel": "500g/份",
                     *                 "baseUnit": "PIECE",
                     *                 "priceMode": "BY_PIECE",
                     *                 "priceUnitGram": null,
                     *                 "price": 690,
                     *                 "memberPrice": 590,
                     *                 "salePrice": 590,
                     *                 "stockStatus": "IN_STOCK",
                     *                 "nearExpiry": false,
                     *                 "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *                 "version": 1,
                     *                 "arrivedAt": null,
                     *                 "freshness": null,
                     *                 "shelfLifeRemainingDays": null
                     *               }
                     *             ],
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ],
                     *         "generatedAt": "2026-10-18T14:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["HomeEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listCategories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "categoryId": "C01",
                     *             "code": "C01",
                     *             "name": "时令蔬菜",
                     *             "shortName": "蔬菜",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "sortOrder": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CategoryListEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listProducts: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example C01 */
                categoryId?: string;
                /** @example 番茄 */
                keyword?: string;
                /** @example true */
                nearExpiry?: boolean;
                /** @example RECOMMENDED */
                sort?: "RECOMMENDED" | "PRICE_ASC" | "PRICE_DESC";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "productId": "S001",
                     *             "spuCode": "S001",
                     *             "categoryId": "C01",
                     *             "name": "沙瓤番茄",
                     *             "description": "新鲜番茄；以实际商品为准",
                     *             "origin": "山东寿光",
                     *             "storage": "COLD",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "priceMode": "BY_PIECE",
                     *             "unitLabel": "500g/份",
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "skus": [
                     *               {
                     *                 "skuId": "SKU-001",
                     *                 "skuCode": "SKU-001",
                     *                 "name": "沙瓤番茄500g/份",
                     *                 "unitLabel": "500g/份",
                     *                 "baseUnit": "PIECE",
                     *                 "priceMode": "BY_PIECE",
                     *                 "priceUnitGram": null,
                     *                 "price": 690,
                     *                 "memberPrice": 590,
                     *                 "salePrice": 590,
                     *                 "stockStatus": "IN_STOCK",
                     *                 "nearExpiry": false,
                     *                 "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *                 "version": 1,
                     *                 "arrivedAt": null,
                     *                 "freshness": null,
                     *                 "shelfLifeRemainingDays": null
                     *               }
                     *             ],
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ProductPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getProduct: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example productId-1 */
                productId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "productId": "S001",
                     *         "spuCode": "S001",
                     *         "categoryId": "C01",
                     *         "name": "沙瓤番茄",
                     *         "description": "新鲜番茄；以实际商品为准",
                     *         "origin": "山东寿光",
                     *         "storage": "COLD",
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "priceMode": "BY_PIECE",
                     *         "unitLabel": "500g/份",
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "skus": [
                     *           {
                     *             "skuId": "SKU-001",
                     *             "skuCode": "SKU-001",
                     *             "name": "沙瓤番茄500g/份",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "priceUnitGram": null,
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ],
                     *         "version": 1,
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ProductEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listProductReviews: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path: {
                /** @example productId-1 */
                productId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "reviewId": "review-1",
                     *             "productId": "S001",
                     *             "displayName": "演示会员",
                     *             "rating": 5,
                     *             "content": "商品新鲜，配送及时",
                     *             "imageUrls": [],
                     *             "createdAt": "2026-10-18T14:00:00+08:00"
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ReviewPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getCart: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "cartItemId": "cart-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "quantity": 1,
                     *             "unitPrice": 590,
                     *             "lineAmount": 590,
                     *             "selected": true,
                     *             "stockStatus": "IN_STOCK",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1
                     *           }
                     *         ],
                     *         "selectedItemCount": 1,
                     *         "estimatedGoodsAmount": 590,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CartEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    addCartItem: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "skuId": "SKU-001",
                 *       "quantity": 1,
                 *       "selected": true
                 *     }
                 */
                "application/json": components["schemas"]["CartAddRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "cartItemId": "cart-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "quantity": 1,
                     *             "unitPrice": 590,
                     *             "lineAmount": 590,
                     *             "selected": true,
                     *             "stockStatus": "IN_STOCK",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1
                     *           }
                     *         ],
                     *         "selectedItemCount": 1,
                     *         "estimatedGoodsAmount": 590,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CartEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    removeCartItem: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example cartItemId-1 */
                cartItemId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["VersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "cartItemId": "cart-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "quantity": 1,
                     *             "unitPrice": 590,
                     *             "lineAmount": 590,
                     *             "selected": true,
                     *             "stockStatus": "IN_STOCK",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1
                     *           }
                     *         ],
                     *         "selectedItemCount": 1,
                     *         "estimatedGoodsAmount": 590,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CartEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateCartItem: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example cartItemId-1 */
                cartItemId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "quantity": 1,
                 *       "selected": true,
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["CartUpdateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "cartItemId": "cart-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "quantity": 1,
                     *             "unitPrice": 590,
                     *             "lineAmount": 590,
                     *             "selected": true,
                     *             "stockStatus": "IN_STOCK",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1
                     *           }
                     *         ],
                     *         "selectedItemCount": 1,
                     *         "estimatedGoodsAmount": 590,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CartEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAddresses: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "addressId": "addr-1",
                     *             "recipientName": "测试用户",
                     *             "phone": "13800138000",
                     *             "province": "上海市",
                     *             "city": "上海市",
                     *             "district": "松江区",
                     *             "detail": "演示路1号",
                     *             "isDefault": true,
                     *             "serviceable": true,
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AddressListEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createAddress: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "recipientName": "测试用户",
                 *       "phone": "13800138000",
                 *       "province": "上海市",
                 *       "city": "上海市",
                 *       "district": "松江区",
                 *       "detail": "演示路1号",
                 *       "isDefault": true
                 *     }
                 */
                "application/json": components["schemas"]["AddressInput"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "addressId": "addr-1",
                     *         "recipientName": "测试用户",
                     *         "phone": "13800138000",
                     *         "province": "上海市",
                     *         "city": "上海市",
                     *         "district": "松江区",
                     *         "detail": "演示路1号",
                     *         "isDefault": true,
                     *         "serviceable": true,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AddressEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateAddress: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example addressId-1 */
                addressId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "recipientName": "测试用户",
                 *       "phone": "13800138000",
                 *       "province": "上海市",
                 *       "city": "上海市",
                 *       "district": "松江区",
                 *       "detail": "演示路1号",
                 *       "isDefault": true,
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["AddressUpdateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "addressId": "addr-1",
                     *         "recipientName": "测试用户",
                     *         "phone": "13800138000",
                     *         "province": "上海市",
                     *         "city": "上海市",
                     *         "district": "松江区",
                     *         "detail": "演示路1号",
                     *         "isDefault": true,
                     *         "serviceable": true,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AddressEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteAddress: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example addressId-1 */
                addressId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["VersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accepted": true,
                     *         "resourceId": "1001",
                     *         "version": 1,
                     *         "message": "命令已受理；异步任务完成前不表示资金已到账"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CommandResultEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listDeliverySlots: {
        parameters: {
            query: {
                /** @example 2026-10-18 */
                date: string;
                /** @example addr-1 */
                addressId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "slotId": "slot-20261018-2",
                     *             "date": "2026-10-18",
                     *             "label": "14:00–17:00",
                     *             "startAt": "2026-10-18T14:00:00+08:00",
                     *             "endAt": "2026-10-18T17:00:00+08:00",
                     *             "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *             "remaining": 20,
                     *             "available": true,
                     *             "unavailableReason": null,
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliverySlotListEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listMyCoupons: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "couponId": "coupon-1",
                     *             "name": "新人券",
                     *             "discountAmount": 500,
                     *             "minGoodsAmount": 3000,
                     *             "status": "AVAILABLE",
                     *             "expiresAt": "2026-10-18T14:00:00+08:00",
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CouponListEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    quoteOrder: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "items": [
                 *         {
                 *           "skuId": "SKU-001",
                 *           "quantity": 1
                 *         }
                 *       ],
                 *       "addressId": "addr-1",
                 *       "slotId": "slot-20261018-2",
                 *       "couponId": null
                 *     }
                 */
                "application/json": components["schemas"]["QuoteRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "quoteId": "quote-1",
                     *         "quoteToken": "quote-demo-token",
                     *         "expiresAt": "2026-10-18T13:05:00+08:00",
                     *         "lines": [
                     *           {
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "linePayableAmount": 590,
                     *             "referenceUnitPrice": 690,
                     *             "memberUnitPrice": 590,
                     *             "nearExpiryUnitPrice": null
                     *           }
                     *         ],
                     *         "price": {
                     *           "referenceGoodsAmount": 690,
                     *           "memberGoodsAmount": 590,
                     *           "nearExpiryDiscountAmount": 0,
                     *           "couponDiscountAmount": 0,
                     *           "goodsPayableAmount": 590,
                     *           "freightAmount": 600,
                     *           "payableAmount": 1190,
                     *           "freeShippingThresholdAmount": 9900,
                     *           "freeShippingGapAmount": 9310
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "address": {
                     *           "addressId": "addr-1",
                     *           "recipientName": "测试用户",
                     *           "phone": "13800138000",
                     *           "province": "上海市",
                     *           "city": "上海市",
                     *           "district": "松江区",
                     *           "detail": "演示路1号",
                     *           "isDefault": true,
                     *           "serviceable": true,
                     *           "version": 1
                     *         },
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["QuoteEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listMyOrders: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example PENDING_PAY */
                status?: "PENDING_PAY" | "PAID" | "PICKING" | "READY_TO_SHIP" | "DELIVERING" | "FINISHED" | "CANCELED" | "CLOSED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "orderId": "order-1",
                     *             "orderNo": "FM20261018000123",
                     *             "status": "PENDING_PAY",
                     *             "currency": "CNY",
                     *             "items": [
                     *               {
                     *                 "orderItemId": "oi-1",
                     *                 "skuId": "SKU-001",
                     *                 "productId": "S001",
                     *                 "productName": "沙瓤番茄",
                     *                 "unitLabel": "500g/份",
                     *                 "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *                 "baseUnit": "PIECE",
                     *                 "priceMode": "BY_PIECE",
                     *                 "quantity": 1,
                     *                 "estimatedGram": null,
                     *                 "actualGram": null,
                     *                 "priceUnitGram": null,
                     *                 "unitPrice": 590,
                     *                 "couponAllocationAmount": 0,
                     *                 "originalPayableAmount": 590,
                     *                 "finalPayableAmount": null,
                     *                 "refundedAmount": 0
                     *               }
                     *             ],
                     *             "price": {
                     *               "referenceGoodsAmount": 690,
                     *               "memberGoodsAmount": 590,
                     *               "nearExpiryDiscountAmount": 0,
                     *               "couponDiscountAmount": 0,
                     *               "goodsPayableAmount": 590,
                     *               "freightAmount": 600,
                     *               "payableAmount": 1190,
                     *               "freeShippingThresholdAmount": 9900,
                     *               "freeShippingGapAmount": 9310
                     *             },
                     *             "paidAmount": 0,
                     *             "refundedAmount": 0,
                     *             "address": {
                     *               "addressId": "addr-1",
                     *               "recipientName": "测试用户",
                     *               "phone": "13800138000",
                     *               "province": "上海市",
                     *               "city": "上海市",
                     *               "district": "松江区",
                     *               "detail": "演示路1号",
                     *               "isDefault": true,
                     *               "serviceable": true,
                     *               "version": 1
                     *             },
                     *             "slot": {
                     *               "slotId": "slot-20261018-2",
                     *               "date": "2026-10-18",
                     *               "label": "14:00–17:00",
                     *               "startAt": "2026-10-18T14:00:00+08:00",
                     *               "endAt": "2026-10-18T17:00:00+08:00",
                     *               "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *               "remaining": 20,
                     *               "available": true,
                     *               "unavailableReason": null,
                     *               "version": 1
                     *             },
                     *             "weightAdjustment": null,
                     *             "refunds": [],
                     *             "buyerNote": null,
                     *             "createdAt": "2026-10-18T13:00:00+08:00",
                     *             "paymentExpiresAt": "2026-10-18T13:15:00+08:00",
                     *             "paidAt": null,
                     *             "finishedAt": null,
                     *             "version": 1,
                     *             "allowedActions": [
                     *               "PAY",
                     *               "CANCEL"
                     *             ],
                     *             "deliveryReceiptCode": null
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["OrderPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createOrder: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "quoteId": "quote-1",
                 *       "quoteToken": "quote-demo-token"
                 *     }
                 */
                "application/json": components["schemas"]["CreateOrderRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "orderId": "order-1",
                     *         "orderNo": "FM20261018000123",
                     *         "status": "PENDING_PAY",
                     *         "currency": "CNY",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "price": {
                     *           "referenceGoodsAmount": 690,
                     *           "memberGoodsAmount": 590,
                     *           "nearExpiryDiscountAmount": 0,
                     *           "couponDiscountAmount": 0,
                     *           "goodsPayableAmount": 590,
                     *           "freightAmount": 600,
                     *           "payableAmount": 1190,
                     *           "freeShippingThresholdAmount": 9900,
                     *           "freeShippingGapAmount": 9310
                     *         },
                     *         "paidAmount": 0,
                     *         "refundedAmount": 0,
                     *         "address": {
                     *           "addressId": "addr-1",
                     *           "recipientName": "测试用户",
                     *           "phone": "13800138000",
                     *           "province": "上海市",
                     *           "city": "上海市",
                     *           "district": "松江区",
                     *           "detail": "演示路1号",
                     *           "isDefault": true,
                     *           "serviceable": true,
                     *           "version": 1
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "weightAdjustment": null,
                     *         "refunds": [],
                     *         "buyerNote": null,
                     *         "createdAt": "2026-10-18T13:00:00+08:00",
                     *         "paymentExpiresAt": "2026-10-18T13:15:00+08:00",
                     *         "paidAt": null,
                     *         "finishedAt": null,
                     *         "version": 1,
                     *         "allowedActions": [
                     *           "PAY",
                     *           "CANCEL"
                     *         ],
                     *         "deliveryReceiptCode": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["OrderEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getMyOrder: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example orderId-1 */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "orderId": "order-1",
                     *         "orderNo": "FM20261018000123",
                     *         "status": "PENDING_PAY",
                     *         "currency": "CNY",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "price": {
                     *           "referenceGoodsAmount": 690,
                     *           "memberGoodsAmount": 590,
                     *           "nearExpiryDiscountAmount": 0,
                     *           "couponDiscountAmount": 0,
                     *           "goodsPayableAmount": 590,
                     *           "freightAmount": 600,
                     *           "payableAmount": 1190,
                     *           "freeShippingThresholdAmount": 9900,
                     *           "freeShippingGapAmount": 9310
                     *         },
                     *         "paidAmount": 0,
                     *         "refundedAmount": 0,
                     *         "address": {
                     *           "addressId": "addr-1",
                     *           "recipientName": "测试用户",
                     *           "phone": "13800138000",
                     *           "province": "上海市",
                     *           "city": "上海市",
                     *           "district": "松江区",
                     *           "detail": "演示路1号",
                     *           "isDefault": true,
                     *           "serviceable": true,
                     *           "version": 1
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "weightAdjustment": null,
                     *         "refunds": [],
                     *         "buyerNote": null,
                     *         "createdAt": "2026-10-18T13:00:00+08:00",
                     *         "paymentExpiresAt": "2026-10-18T13:15:00+08:00",
                     *         "paidAt": null,
                     *         "finishedAt": null,
                     *         "version": 1,
                     *         "allowedActions": [
                     *           "PAY",
                     *           "CANCEL"
                     *         ],
                     *         "deliveryReceiptCode": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["OrderEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getOrderStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example orderId-1 */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "orderId": "order-1",
                     *         "status": "PENDING_PAY",
                     *         "paidAmount": 0,
                     *         "refundedAmount": 0,
                     *         "weightAdjustmentStatus": "NONE",
                     *         "version": 1,
                     *         "updatedAt": "2026-10-18T14:00:00+08:00",
                     *         "allowedActions": [
                     *           "PAY",
                     *           "CANCEL"
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["OrderStatusEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    cancelMyOrder: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example orderId-1 */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "reason": "用户请求取消"
                 *     }
                 */
                "application/json": components["schemas"]["ReasonVersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "orderId": "order-1",
                     *         "orderNo": "FM20261018000123",
                     *         "status": "PENDING_PAY",
                     *         "currency": "CNY",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "price": {
                     *           "referenceGoodsAmount": 690,
                     *           "memberGoodsAmount": 590,
                     *           "nearExpiryDiscountAmount": 0,
                     *           "couponDiscountAmount": 0,
                     *           "goodsPayableAmount": 590,
                     *           "freightAmount": 600,
                     *           "payableAmount": 1190,
                     *           "freeShippingThresholdAmount": 9900,
                     *           "freeShippingGapAmount": 9310
                     *         },
                     *         "paidAmount": 0,
                     *         "refundedAmount": 0,
                     *         "address": {
                     *           "addressId": "addr-1",
                     *           "recipientName": "测试用户",
                     *           "phone": "13800138000",
                     *           "province": "上海市",
                     *           "city": "上海市",
                     *           "district": "松江区",
                     *           "detail": "演示路1号",
                     *           "isDefault": true,
                     *           "serviceable": true,
                     *           "version": 1
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "weightAdjustment": null,
                     *         "refunds": [],
                     *         "buyerNote": null,
                     *         "createdAt": "2026-10-18T13:00:00+08:00",
                     *         "paymentExpiresAt": "2026-10-18T13:15:00+08:00",
                     *         "paidAt": null,
                     *         "finishedAt": null,
                     *         "version": 1,
                     *         "allowedActions": [
                     *           "PAY",
                     *           "CANCEL"
                     *         ],
                     *         "deliveryReceiptCode": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["OrderEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createPayment: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "orderId": "order-1",
                 *       "purpose": "ORDER"
                 *     }
                 */
                "application/json": components["schemas"]["PaymentRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "paymentId": "pay-1",
                     *         "orderId": "order-1",
                     *         "adjustmentId": null,
                     *         "purpose": "ORDER",
                     *         "channel": "SANDBOX",
                     *         "status": "PENDING",
                     *         "amount": 1190,
                     *         "currency": "CNY",
                     *         "expiresAt": "2026-10-18T13:15:00+08:00",
                     *         "version": 1,
                     *         "allowedActions": [
                     *           "SIMULATE_PAYMENT"
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PaymentEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["Unavailable"];
        };
    };
    getPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example paymentId-1 */
                paymentId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "paymentId": "pay-1",
                     *         "orderId": "order-1",
                     *         "adjustmentId": null,
                     *         "purpose": "ORDER",
                     *         "channel": "SANDBOX",
                     *         "status": "PENDING",
                     *         "amount": 1190,
                     *         "currency": "CNY",
                     *         "expiresAt": "2026-10-18T13:15:00+08:00",
                     *         "version": 1,
                     *         "allowedActions": [
                     *           "SIMULATE_PAYMENT"
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PaymentEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["Unavailable"];
        };
    };
    simulateSandboxPayment: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example paymentId-1 */
                paymentId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "outcome": "SUCCESS",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["SandboxSimulateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "paymentId": "pay-1",
                     *         "orderId": "order-1",
                     *         "adjustmentId": null,
                     *         "purpose": "ORDER",
                     *         "channel": "SANDBOX",
                     *         "status": "PENDING",
                     *         "amount": 1190,
                     *         "currency": "CNY",
                     *         "expiresAt": "2026-10-18T13:15:00+08:00",
                     *         "version": 1,
                     *         "allowedActions": [
                     *           "SIMULATE_PAYMENT"
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PaymentEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["Unavailable"];
        };
    };
    receiveSandboxPaymentCallback: {
        parameters: {
            query?: never;
            header: {
                /** @description 小写hex HMAC-SHA256(secret, timestamp + "\n" + nonce + "\n" + 原始请求UTF-8字节)；密钥仅渠道模拟器与后端持有。 */
                "X-Sandbox-Signature": components["parameters"]["Signature"];
                /** @description 渠道签名时间Unix秒，允许服务器时钟±300秒；与body occurredAt分开。 */
                "X-Sandbox-Timestamp": components["parameters"]["CallbackTimestamp"];
                /** @description 签名随机数；防重放，结合eventId持久化。 */
                "X-Sandbox-Nonce": components["parameters"]["CallbackNonce"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "eventId": "evt-1",
                 *       "paymentId": "pay-1",
                 *       "channelTradeNo": "sandbox-trade-1",
                 *       "status": "SUCCESS",
                 *       "amount": 1190,
                 *       "currency": "CNY",
                 *       "occurredAt": "2026-10-18T14:00:00+08:00"
                 *     }
                 */
                "application/json": components["schemas"]["PaymentCallback"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "eventId": "evt-1",
                     *         "accepted": true,
                     *         "duplicate": false
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CallbackReceiptEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getMyRefund: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example refundId-1 */
                refundId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "refundId": "refund-1",
                     *         "orderId": "order-1",
                     *         "paymentId": "pay-1",
                     *         "aftersaleId": null,
                     *         "adjustmentId": null,
                     *         "type": "AFTERSALE",
                     *         "amount": 24,
                     *         "currency": "CNY",
                     *         "status": "PENDING",
                     *         "reason": "称重退差",
                     *         "createdAt": "2026-10-18T14:00:00+08:00",
                     *         "completedAt": null,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["RefundEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listMyAftersales: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example APPLIED */
                status?: "APPLIED" | "APPROVED" | "REJECTED" | "REFUNDING" | "COMPLETED" | "CANCELED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "aftersaleId": "after-1",
                     *             "orderId": "order-1",
                     *             "type": "QUALITY",
                     *             "reason": "商品质量问题",
                     *             "items": [
                     *               {
                     *                 "orderItemId": "oi-1",
                     *                 "quantity": 1,
                     *                 "requestedAmount": 590
                     *               }
                     *             ],
                     *             "evidenceMediaIds": [],
                     *             "status": "APPLIED",
                     *             "requestedAmount": 590,
                     *             "approvedAmount": 0,
                     *             "reviewComment": null,
                     *             "refunds": [],
                     *             "appliedAt": "2026-10-18T14:00:00+08:00",
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AftersalePageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    applyAftersale: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "orderId": "order-1",
                 *       "type": "QUALITY",
                 *       "reason": "商品质量问题",
                 *       "items": [
                 *         {
                 *           "orderItemId": "oi-1",
                 *           "quantity": 1,
                 *           "requestedAmount": 590
                 *         }
                 *       ],
                 *       "evidenceMediaIds": []
                 *     }
                 */
                "application/json": components["schemas"]["AftersaleRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [],
                     *         "status": "APPLIED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 0,
                     *         "reviewComment": null,
                     *         "refunds": [],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getMyAftersale: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example aftersaleId-1 */
                aftersaleId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [],
                     *         "status": "APPLIED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 0,
                     *         "reviewComment": null,
                     *         "refunds": [],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    cancelMyAftersale: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example aftersaleId-1 */
                aftersaleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "reason": "用户请求取消"
                 *     }
                 */
                "application/json": components["schemas"]["ReasonVersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [],
                     *         "status": "APPLIED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 0,
                     *         "reviewComment": null,
                     *         "refunds": [],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createReview: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "orderItemId": "oi-1",
                 *       "rating": 5,
                 *       "content": "商品新鲜，配送及时",
                 *       "imageMediaIds": [],
                 *       "anonymous": false
                 *     }
                 */
                "application/json": components["schemas"]["ReviewInput"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "reviewId": "review-1",
                     *         "productId": "S001",
                     *         "displayName": "演示会员",
                     *         "rating": 5,
                     *         "content": "商品新鲜，配送及时",
                     *         "imageUrls": [],
                     *         "createdAt": "2026-10-18T14:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ReviewEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getAdminDashboard: {
        parameters: {
            query: {
                /** @example 2026-10-18 */
                businessDate: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "businessDate": "2026-10-18",
                     *         "paidOrderCount": 1,
                     *         "capturedPaymentAmount": 1190,
                     *         "successfulRefundAmount": 0,
                     *         "netCollectedAmount": 1190,
                     *         "pendingPickCount": 1,
                     *         "nearExpiryBatchCount": 0,
                     *         "lowStockSkuCount": 0,
                     *         "generatedAt": "2026-10-18T14:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DashboardEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAdminProducts: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example DRAFT */
                status?: "DRAFT" | "ON_SALE" | "OFF_SALE";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "productId": "S001",
                     *             "spuCode": "S001",
                     *             "categoryId": "C01",
                     *             "name": "沙瓤番茄",
                     *             "description": "新鲜番茄；以实际商品为准",
                     *             "origin": "山东寿光",
                     *             "storage": "COLD",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "priceMode": "BY_PIECE",
                     *             "unitLabel": "500g/份",
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "skus": [
                     *               {
                     *                 "skuId": "SKU-001",
                     *                 "skuCode": "SKU-001",
                     *                 "name": "沙瓤番茄500g/份",
                     *                 "unitLabel": "500g/份",
                     *                 "baseUnit": "PIECE",
                     *                 "priceMode": "BY_PIECE",
                     *                 "priceUnitGram": null,
                     *                 "price": 690,
                     *                 "memberPrice": 590,
                     *                 "salePrice": 590,
                     *                 "stockStatus": "IN_STOCK",
                     *                 "nearExpiry": false,
                     *                 "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *                 "version": 1,
                     *                 "arrivedAt": null,
                     *                 "freshness": null,
                     *                 "shelfLifeRemainingDays": null
                     *               }
                     *             ],
                     *             "version": 1,
                     *             "status": "DRAFT",
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminProductPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createProduct: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "categoryId": "C01",
                 *       "name": "沙瓤番茄",
                 *       "description": "新鲜番茄",
                 *       "origin": "山东寿光",
                 *       "storage": "COLD",
                 *       "imageUrl": "http://localhost:8080/static/products/S001.jpg"
                 *     }
                 */
                "application/json": components["schemas"]["ProductWriteRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "productId": "S001",
                     *         "spuCode": "S001",
                     *         "categoryId": "C01",
                     *         "name": "沙瓤番茄",
                     *         "description": "新鲜番茄；以实际商品为准",
                     *         "origin": "山东寿光",
                     *         "storage": "COLD",
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "priceMode": "BY_PIECE",
                     *         "unitLabel": "500g/份",
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "skus": [
                     *           {
                     *             "skuId": "SKU-001",
                     *             "skuCode": "SKU-001",
                     *             "name": "沙瓤番茄500g/份",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "priceUnitGram": null,
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ],
                     *         "version": 1,
                     *         "status": "DRAFT",
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminProductEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getAdminProduct: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example productId-1 */
                productId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "productId": "S001",
                     *         "spuCode": "S001",
                     *         "categoryId": "C01",
                     *         "name": "沙瓤番茄",
                     *         "description": "新鲜番茄；以实际商品为准",
                     *         "origin": "山东寿光",
                     *         "storage": "COLD",
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "priceMode": "BY_PIECE",
                     *         "unitLabel": "500g/份",
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "skus": [
                     *           {
                     *             "skuId": "SKU-001",
                     *             "skuCode": "SKU-001",
                     *             "name": "沙瓤番茄500g/份",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "priceUnitGram": null,
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ],
                     *         "version": 1,
                     *         "status": "DRAFT",
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminProductEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    patchProduct: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example productId-1 */
                productId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "name": "沙瓤番茄精选"
                 *     }
                 */
                "application/json": components["schemas"]["ProductPatchRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "productId": "S001",
                     *         "spuCode": "S001",
                     *         "categoryId": "C01",
                     *         "name": "沙瓤番茄",
                     *         "description": "新鲜番茄；以实际商品为准",
                     *         "origin": "山东寿光",
                     *         "storage": "COLD",
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "priceMode": "BY_PIECE",
                     *         "unitLabel": "500g/份",
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "skus": [
                     *           {
                     *             "skuId": "SKU-001",
                     *             "skuCode": "SKU-001",
                     *             "name": "沙瓤番茄500g/份",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "priceUnitGram": null,
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ],
                     *         "version": 1,
                     *         "status": "DRAFT",
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminProductEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    setProductStatus: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example productId-1 */
                productId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "ON_SALE",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["ProductStatusRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "productId": "S001",
                     *         "spuCode": "S001",
                     *         "categoryId": "C01",
                     *         "name": "沙瓤番茄",
                     *         "description": "新鲜番茄；以实际商品为准",
                     *         "origin": "山东寿光",
                     *         "storage": "COLD",
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "priceMode": "BY_PIECE",
                     *         "unitLabel": "500g/份",
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "skus": [
                     *           {
                     *             "skuId": "SKU-001",
                     *             "skuCode": "SKU-001",
                     *             "name": "沙瓤番茄500g/份",
                     *             "unitLabel": "500g/份",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "priceUnitGram": null,
                     *             "price": 690,
                     *             "memberPrice": 590,
                     *             "salePrice": 590,
                     *             "stockStatus": "IN_STOCK",
                     *             "nearExpiry": false,
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "version": 1,
                     *             "arrivedAt": null,
                     *             "freshness": null,
                     *             "shelfLifeRemainingDays": null
                     *           }
                     *         ],
                     *         "version": 1,
                     *         "status": "DRAFT",
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminProductEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createSku: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example productId-1 */
                productId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "skuCode": "SKU-001",
                 *       "name": "沙瓤番茄500g/份",
                 *       "unitLabel": "500g/份",
                 *       "baseUnit": "PIECE",
                 *       "priceMode": "BY_PIECE",
                 *       "priceUnitGram": null,
                 *       "price": 690,
                 *       "memberPrice": 590,
                 *       "imageUrl": "http://localhost:8080/static/products/S001.jpg"
                 *     }
                 */
                "application/json": components["schemas"]["SkuWriteRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "skuId": "SKU-001",
                     *         "skuCode": "SKU-001",
                     *         "name": "沙瓤番茄500g/份",
                     *         "unitLabel": "500g/份",
                     *         "baseUnit": "PIECE",
                     *         "priceMode": "BY_PIECE",
                     *         "priceUnitGram": null,
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "version": 1,
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["SkuEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    patchSku: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example skuId-1 */
                skuId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "memberPrice": 590
                 *     }
                 */
                "application/json": components["schemas"]["SkuPatchRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "skuId": "SKU-001",
                     *         "skuCode": "SKU-001",
                     *         "name": "沙瓤番茄500g/份",
                     *         "unitLabel": "500g/份",
                     *         "baseUnit": "PIECE",
                     *         "priceMode": "BY_PIECE",
                     *         "priceUnitGram": null,
                     *         "price": 690,
                     *         "memberPrice": 590,
                     *         "salePrice": 590,
                     *         "stockStatus": "IN_STOCK",
                     *         "nearExpiry": false,
                     *         "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *         "version": 1,
                     *         "arrivedAt": null,
                     *         "freshness": null,
                     *         "shelfLifeRemainingDays": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["SkuEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listBatches: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example SKU-001 */
                skuId?: string;
                /** @example NORMAL */
                lifecycle?: "NORMAL" | "QUARANTINED" | "DISPOSED";
                /** @example NORMAL */
                freshness?: "NORMAL" | "NEAR_EXPIRY" | "EXPIRED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "batchId": "batch-1",
                     *             "batchNo": "B20261018-001",
                     *             "skuId": "SKU-001",
                     *             "baseUnit": "PIECE",
                     *             "onHand": 100,
                     *             "reserved": 5,
                     *             "quarantined": 0,
                     *             "available": 95,
                     *             "lifecycle": "NORMAL",
                     *             "freshness": "NORMAL",
                     *             "producedAt": "2026-10-18T00:00:00+08:00",
                     *             "expiresAt": "2026-10-21T23:59:59+08:00",
                     *             "receivedAt": "2026-10-18T14:00:00+08:00",
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BatchPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    receiveBatch: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "batchNo": "B20261018-001",
                 *       "skuId": "SKU-001",
                 *       "receivedQuantity": 100,
                 *       "producedAt": "2026-10-18T00:00:00+08:00",
                 *       "expiresAt": "2026-10-21T23:59:59+08:00",
                 *       "reason": "采购验收入库"
                 *     }
                 */
                "application/json": components["schemas"]["BatchCreateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "batchId": "batch-1",
                     *         "batchNo": "B20261018-001",
                     *         "skuId": "SKU-001",
                     *         "baseUnit": "PIECE",
                     *         "onHand": 100,
                     *         "reserved": 5,
                     *         "quarantined": 0,
                     *         "available": 95,
                     *         "lifecycle": "NORMAL",
                     *         "freshness": "NORMAL",
                     *         "producedAt": "2026-10-18T00:00:00+08:00",
                     *         "expiresAt": "2026-10-21T23:59:59+08:00",
                     *         "receivedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BatchEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getBatch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example batchId-1 */
                batchId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "batchId": "batch-1",
                     *         "batchNo": "B20261018-001",
                     *         "skuId": "SKU-001",
                     *         "baseUnit": "PIECE",
                     *         "onHand": 100,
                     *         "reserved": 5,
                     *         "quarantined": 0,
                     *         "available": 95,
                     *         "lifecycle": "NORMAL",
                     *         "freshness": "NORMAL",
                     *         "producedAt": "2026-10-18T00:00:00+08:00",
                     *         "expiresAt": "2026-10-21T23:59:59+08:00",
                     *         "receivedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BatchEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    adjustInventory: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example batchId-1 */
                batchId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "quantityDelta": -1,
                 *       "reasonCode": "COUNT_CORRECTION",
                 *       "reason": "盘点破损一份",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["InventoryAdjustmentRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "batchId": "batch-1",
                     *         "batchNo": "B20261018-001",
                     *         "skuId": "SKU-001",
                     *         "baseUnit": "PIECE",
                     *         "onHand": 100,
                     *         "reserved": 5,
                     *         "quarantined": 0,
                     *         "available": 95,
                     *         "lifecycle": "NORMAL",
                     *         "freshness": "NORMAL",
                     *         "producedAt": "2026-10-18T00:00:00+08:00",
                     *         "expiresAt": "2026-10-21T23:59:59+08:00",
                     *         "receivedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BatchEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    setBatchLifecycle: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example batchId-1 */
                batchId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "lifecycle": "NORMAL",
                 *       "reason": "质检隔离",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["BatchLifecycleRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "batchId": "batch-1",
                     *         "batchNo": "B20261018-001",
                     *         "skuId": "SKU-001",
                     *         "baseUnit": "PIECE",
                     *         "onHand": 100,
                     *         "reserved": 5,
                     *         "quarantined": 0,
                     *         "available": 95,
                     *         "lifecycle": "NORMAL",
                     *         "freshness": "NORMAL",
                     *         "producedAt": "2026-10-18T00:00:00+08:00",
                     *         "expiresAt": "2026-10-21T23:59:59+08:00",
                     *         "receivedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BatchEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listInventoryMovements: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example batch-1 */
                batchId?: string;
                /** @example order-1 */
                orderId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "movementId": "move-1",
                     *             "batchId": "batch-1",
                     *             "skuId": "SKU-001",
                     *             "orderId": null,
                     *             "type": "RECEIVE",
                     *             "onHandDelta": 0,
                     *             "reservedDelta": 1,
                     *             "quarantinedDelta": 0,
                     *             "reason": "下单预占",
                     *             "actorId": "u-picker-1",
                     *             "createdAt": "2026-10-18T14:00:00+08:00"
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["InventoryMovementPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAdminOrders: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example PENDING_PAY */
                status?: "PENDING_PAY" | "PAID" | "PICKING" | "READY_TO_SHIP" | "DELIVERING" | "FINISHED" | "CANCELED" | "CLOSED";
                /** @example FM20261018000123 */
                orderNo?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "orderId": "order-1",
                     *             "orderNo": "FM20261018000123",
                     *             "memberId": "u1001",
                     *             "status": "PENDING_PAY",
                     *             "items": [
                     *               {
                     *                 "orderItemId": "oi-1",
                     *                 "skuId": "SKU-001",
                     *                 "productId": "S001",
                     *                 "productName": "沙瓤番茄",
                     *                 "unitLabel": "500g/份",
                     *                 "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *                 "baseUnit": "PIECE",
                     *                 "priceMode": "BY_PIECE",
                     *                 "quantity": 1,
                     *                 "estimatedGram": null,
                     *                 "actualGram": null,
                     *                 "priceUnitGram": null,
                     *                 "unitPrice": 590,
                     *                 "couponAllocationAmount": 0,
                     *                 "originalPayableAmount": 590,
                     *                 "finalPayableAmount": null,
                     *                 "refundedAmount": 0
                     *               }
                     *             ],
                     *             "price": {
                     *               "referenceGoodsAmount": 690,
                     *               "memberGoodsAmount": 590,
                     *               "nearExpiryDiscountAmount": 0,
                     *               "couponDiscountAmount": 0,
                     *               "goodsPayableAmount": 590,
                     *               "freightAmount": 600,
                     *               "payableAmount": 1190,
                     *               "freeShippingThresholdAmount": 9900,
                     *               "freeShippingGapAmount": 9310
                     *             },
                     *             "paidAmount": 0,
                     *             "refundedAmount": 0,
                     *             "contact": {
                     *               "recipientName": "测**",
                     *               "phoneMasked": "138****8000",
                     *               "region": "上海市松江区"
                     *             },
                     *             "slot": {
                     *               "slotId": "slot-20261018-2",
                     *               "date": "2026-10-18",
                     *               "label": "14:00–17:00",
                     *               "startAt": "2026-10-18T14:00:00+08:00",
                     *               "endAt": "2026-10-18T17:00:00+08:00",
                     *               "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *               "remaining": 20,
                     *               "available": true,
                     *               "unavailableReason": null,
                     *               "version": 1
                     *             },
                     *             "weightAdjustment": null,
                     *             "refunds": [],
                     *             "createdAt": "2026-10-18T14:00:00+08:00",
                     *             "version": 1,
                     *             "allowedActions": []
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminOrderPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getAdminOrder: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example orderId-1 */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "orderId": "order-1",
                     *         "orderNo": "FM20261018000123",
                     *         "memberId": "u1001",
                     *         "status": "PENDING_PAY",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "price": {
                     *           "referenceGoodsAmount": 690,
                     *           "memberGoodsAmount": 590,
                     *           "nearExpiryDiscountAmount": 0,
                     *           "couponDiscountAmount": 0,
                     *           "goodsPayableAmount": 590,
                     *           "freightAmount": 600,
                     *           "payableAmount": 1190,
                     *           "freeShippingThresholdAmount": 9900,
                     *           "freeShippingGapAmount": 9310
                     *         },
                     *         "paidAmount": 0,
                     *         "refundedAmount": 0,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "weightAdjustment": null,
                     *         "refunds": [],
                     *         "createdAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1,
                     *         "allowedActions": []
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminOrderEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    cancelOrderAsService: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example orderId-1 */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "reason": "用户请求取消"
                 *     }
                 */
                "application/json": components["schemas"]["ReasonVersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "orderId": "order-1",
                     *         "orderNo": "FM20261018000123",
                     *         "memberId": "u1001",
                     *         "status": "PENDING_PAY",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "price": {
                     *           "referenceGoodsAmount": 690,
                     *           "memberGoodsAmount": 590,
                     *           "nearExpiryDiscountAmount": 0,
                     *           "couponDiscountAmount": 0,
                     *           "goodsPayableAmount": 590,
                     *           "freightAmount": 600,
                     *           "payableAmount": 1190,
                     *           "freeShippingThresholdAmount": 9900,
                     *           "freeShippingGapAmount": 9310
                     *         },
                     *         "paidAmount": 0,
                     *         "refundedAmount": 0,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "weightAdjustment": null,
                     *         "refunds": [],
                     *         "createdAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1,
                     *         "allowedActions": []
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminOrderEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    receiveCanceledOrderReturn: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example orderId-1 */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "allocations": [
                 *         {
                 *           "allocationId": "alloc-1",
                 *           "passedQuantity": 1,
                 *           "quarantinedQuantity": 0
                 *         }
                 *       ],
                 *       "inspectionNote": "取消订单实物已收回并完成质检",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["ReturnReceiveRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accepted": true,
                     *         "resourceId": "1001",
                     *         "version": 1,
                     *         "message": "命令已受理；异步任务完成前不表示资金已到账"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CommandResultEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listPickTasks: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "taskId": "pick-1",
                     *             "orderId": "order-1",
                     *             "status": "UNASSIGNED",
                     *             "pickerId": null,
                     *             "items": [
                     *               {
                     *                 "orderItemId": "oi-1",
                     *                 "skuId": "SKU-001",
                     *                 "productId": "S001",
                     *                 "productName": "沙瓤番茄",
                     *                 "unitLabel": "500g/份",
                     *                 "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *                 "baseUnit": "PIECE",
                     *                 "priceMode": "BY_PIECE",
                     *                 "quantity": 1,
                     *                 "estimatedGram": null,
                     *                 "actualGram": null,
                     *                 "priceUnitGram": null,
                     *                 "unitPrice": 590,
                     *                 "couponAllocationAmount": 0,
                     *                 "originalPayableAmount": 590,
                     *                 "finalPayableAmount": null,
                     *                 "refundedAmount": 0
                     *               }
                     *             ],
                     *             "allocations": [
                     *               {
                     *                 "allocationId": "alloc-1",
                     *                 "orderItemId": "oi-1",
                     *                 "batchId": "batch-1",
                     *                 "batchNo": "B20261018-001",
                     *                 "baseUnit": "PIECE",
                     *                 "reservedQuantity": 1,
                     *                 "pickedQuantity": 0,
                     *                 "returnedQuantity": 0,
                     *                 "version": 1
                     *               }
                     *             ],
                     *             "slot": {
                     *               "slotId": "slot-20261018-2",
                     *               "date": "2026-10-18",
                     *               "label": "14:00–17:00",
                     *               "startAt": "2026-10-18T14:00:00+08:00",
                     *               "endAt": "2026-10-18T17:00:00+08:00",
                     *               "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *               "remaining": 20,
                     *               "available": true,
                     *               "unavailableReason": null,
                     *               "version": 1
                     *             },
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PickTaskPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getPickTask: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "pick-1",
                     *         "orderId": "order-1",
                     *         "status": "UNASSIGNED",
                     *         "pickerId": null,
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "allocations": [
                     *           {
                     *             "allocationId": "alloc-1",
                     *             "orderItemId": "oi-1",
                     *             "batchId": "batch-1",
                     *             "batchNo": "B20261018-001",
                     *             "baseUnit": "PIECE",
                     *             "reservedQuantity": 1,
                     *             "pickedQuantity": 0,
                     *             "returnedQuantity": 0,
                     *             "version": 1
                     *           }
                     *         ],
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PickTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    claimPickTask: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["VersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "pick-1",
                     *         "orderId": "order-1",
                     *         "status": "UNASSIGNED",
                     *         "pickerId": null,
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "allocations": [
                     *           {
                     *             "allocationId": "alloc-1",
                     *             "orderItemId": "oi-1",
                     *             "batchId": "batch-1",
                     *             "batchNo": "B20261018-001",
                     *             "baseUnit": "PIECE",
                     *             "reservedQuantity": 1,
                     *             "pickedQuantity": 0,
                     *             "returnedQuantity": 0,
                     *             "version": 1
                     *           }
                     *         ],
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PickTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    reallocatePickTask: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "allocations": [
                 *         {
                 *           "orderItemId": "oi-1",
                 *           "batchId": "batch-2",
                 *           "quantity": 1
                 *         }
                 *       ],
                 *       "reason": "原批次拣货时发现质量问题",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["ReallocateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "pick-1",
                     *         "orderId": "order-1",
                     *         "status": "UNASSIGNED",
                     *         "pickerId": null,
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "skuId": "SKU-001",
                     *             "productId": "S001",
                     *             "productName": "沙瓤番茄",
                     *             "unitLabel": "500g/份",
                     *             "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *             "baseUnit": "PIECE",
                     *             "priceMode": "BY_PIECE",
                     *             "quantity": 1,
                     *             "estimatedGram": null,
                     *             "actualGram": null,
                     *             "priceUnitGram": null,
                     *             "unitPrice": 590,
                     *             "couponAllocationAmount": 0,
                     *             "originalPayableAmount": 590,
                     *             "finalPayableAmount": null,
                     *             "refundedAmount": 0
                     *           }
                     *         ],
                     *         "allocations": [
                     *           {
                     *             "allocationId": "alloc-1",
                     *             "orderItemId": "oi-1",
                     *             "batchId": "batch-1",
                     *             "batchNo": "B20261018-001",
                     *             "baseUnit": "PIECE",
                     *             "reservedQuantity": 1,
                     *             "pickedQuantity": 0,
                     *             "returnedQuantity": 0,
                     *             "version": 1
                     *           }
                     *         ],
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PickTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    confirmPickTask: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "allocations": [
                 *         {
                 *           "allocationId": "alloc-1",
                 *           "actualQuantity": 1,
                 *           "reasonCode": "NORMAL",
                 *           "reason": "正常拣货"
                 *         }
                 *       ],
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["PickConfirmRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "task": {
                     *           "taskId": "pick-1",
                     *           "orderId": "order-1",
                     *           "status": "UNASSIGNED",
                     *           "pickerId": null,
                     *           "items": [
                     *             {
                     *               "orderItemId": "oi-1",
                     *               "skuId": "SKU-001",
                     *               "productId": "S001",
                     *               "productName": "沙瓤番茄",
                     *               "unitLabel": "500g/份",
                     *               "imageUrl": "http://localhost:8080/static/products/S001.jpg",
                     *               "baseUnit": "PIECE",
                     *               "priceMode": "BY_PIECE",
                     *               "quantity": 1,
                     *               "estimatedGram": null,
                     *               "actualGram": null,
                     *               "priceUnitGram": null,
                     *               "unitPrice": 590,
                     *               "couponAllocationAmount": 0,
                     *               "originalPayableAmount": 590,
                     *               "finalPayableAmount": null,
                     *               "refundedAmount": 0
                     *             }
                     *           ],
                     *           "allocations": [
                     *             {
                     *               "allocationId": "alloc-1",
                     *               "orderItemId": "oi-1",
                     *               "batchId": "batch-1",
                     *               "batchNo": "B20261018-001",
                     *               "baseUnit": "PIECE",
                     *               "reservedQuantity": 1,
                     *               "pickedQuantity": 0,
                     *               "returnedQuantity": 0,
                     *               "version": 1
                     *             }
                     *           ],
                     *           "slot": {
                     *             "slotId": "slot-20261018-2",
                     *             "date": "2026-10-18",
                     *             "label": "14:00–17:00",
                     *             "startAt": "2026-10-18T14:00:00+08:00",
                     *             "endAt": "2026-10-18T17:00:00+08:00",
                     *             "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *             "remaining": 20,
                     *             "available": true,
                     *             "unavailableReason": null,
                     *             "version": 1
                     *           },
                     *           "version": 1
                     *         },
                     *         "orderStatus": "READY_TO_SHIP",
                     *         "weightAdjustment": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["PickConfirmResultEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listDeliveryTasks: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "taskId": "delivery-1",
                     *             "orderId": "order-1",
                     *             "status": "PENDING_DISPATCH",
                     *             "courierId": null,
                     *             "contact": {
                     *               "recipientName": "测**",
                     *               "phoneMasked": "138****8000",
                     *               "region": "上海市松江区"
                     *             },
                     *             "slot": {
                     *               "slotId": "slot-20261018-2",
                     *               "date": "2026-10-18",
                     *               "label": "14:00–17:00",
                     *               "startAt": "2026-10-18T14:00:00+08:00",
                     *               "endAt": "2026-10-18T17:00:00+08:00",
                     *               "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *               "remaining": 20,
                     *               "available": true,
                     *               "unavailableReason": null,
                     *               "version": 1
                     *             },
                     *             "dispatchedAt": null,
                     *             "completedAt": null,
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryTaskPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getDeliveryTask: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "delivery-1",
                     *         "orderId": "order-1",
                     *         "status": "PENDING_DISPATCH",
                     *         "courierId": null,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "dispatchedAt": null,
                     *         "completedAt": null,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    dispatchDelivery: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "courierId": "u-courier-1",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["DeliveryDispatchRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "delivery-1",
                     *         "orderId": "order-1",
                     *         "status": "PENDING_DISPATCH",
                     *         "courierId": null,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "dispatchedAt": null,
                     *         "completedAt": null,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    completeDelivery: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "proofCode": "123456",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["DeliveryCompleteRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "delivery-1",
                     *         "orderId": "order-1",
                     *         "status": "PENDING_DISPATCH",
                     *         "courierId": null,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "dispatchedAt": null,
                     *         "completedAt": null,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    reportDeliveryException: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "type": "RECIPIENT_UNREACHABLE",
                 *       "reason": "预约时段联系不上收货人",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["DeliveryExceptionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "delivery-1",
                     *         "orderId": "order-1",
                     *         "status": "EXCEPTION",
                     *         "courierId": "u-courier-1",
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "dispatchedAt": "2026-10-18T14:00:00+08:00",
                     *         "completedAt": null,
                     *         "version": 2
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAdminAftersales: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example APPLIED */
                status?: "APPLIED" | "APPROVED" | "REJECTED" | "REFUNDING" | "COMPLETED" | "CANCELED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "aftersaleId": "after-1",
                     *             "orderId": "order-1",
                     *             "type": "QUALITY",
                     *             "reason": "商品质量问题",
                     *             "items": [
                     *               {
                     *                 "orderItemId": "oi-1",
                     *                 "quantity": 1,
                     *                 "requestedAmount": 590
                     *               }
                     *             ],
                     *             "evidenceMediaIds": [],
                     *             "status": "APPLIED",
                     *             "requestedAmount": 590,
                     *             "approvedAmount": 0,
                     *             "reviewComment": null,
                     *             "refunds": [],
                     *             "appliedAt": "2026-10-18T14:00:00+08:00",
                     *             "version": 1,
                     *             "memberId": "u1001",
                     *             "reviewerId": null,
                     *             "contact": {
                     *               "recipientName": "测**",
                     *               "phoneMasked": "138****8000",
                     *               "region": "上海市松江区"
                     *             },
                     *             "assigneeId": null
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminAftersalePageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getAdminAftersale: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example aftersaleId-1 */
                aftersaleId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [],
                     *         "status": "APPLIED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 0,
                     *         "reviewComment": null,
                     *         "refunds": [],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 1,
                     *         "memberId": "u1001",
                     *         "reviewerId": null,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "assigneeId": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminAftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    approveAftersale: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example aftersaleId-1 */
                aftersaleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "approvedItems": [
                 *         {
                 *           "orderItemId": "oi-1",
                 *           "quantity": 1,
                 *           "requestedAmount": 590
                 *         }
                 *       ],
                 *       "comment": "照片证据清晰，批准实付范围退款",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["AftersaleReviewRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [
                     *           "media-1"
                     *         ],
                     *         "status": "APPROVED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 590,
                     *         "reviewComment": "照片证据核验通过",
                     *         "refunds": [
                     *           {
                     *             "refundId": "refund-1",
                     *             "orderId": "order-1",
                     *             "paymentId": "pay-1",
                     *             "aftersaleId": "after-1",
                     *             "adjustmentId": null,
                     *             "type": "AFTERSALE",
                     *             "amount": 590,
                     *             "currency": "CNY",
                     *             "status": "PENDING",
                     *             "reason": "客服核验证据批准品质售后",
                     *             "createdAt": "2026-10-18T14:20:00+08:00",
                     *             "completedAt": null,
                     *             "version": 1
                     *           }
                     *         ],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 3,
                     *         "memberId": "u1001",
                     *         "reviewerId": "u-service-1",
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "assigneeId": "u-service-1"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T14:20:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminAftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    rejectAftersale: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example aftersaleId-1 */
                aftersaleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "comment": "申请超过已完成7天期限",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["AftersaleRejectRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [],
                     *         "status": "REJECTED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 0,
                     *         "reviewComment": "证据不满足赔付条件",
                     *         "refunds": [],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 3,
                     *         "memberId": "u1001",
                     *         "reviewerId": "u-service-1",
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "assigneeId": "u-service-1"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminAftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAdminRefunds: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example PENDING */
                status?: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
                /** @example order-1 */
                orderId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "refundId": "refund-1",
                     *             "orderId": "order-1",
                     *             "paymentId": "pay-1",
                     *             "aftersaleId": null,
                     *             "adjustmentId": null,
                     *             "type": "AFTERSALE",
                     *             "amount": 24,
                     *             "currency": "CNY",
                     *             "status": "PENDING",
                     *             "reason": "称重退差",
                     *             "createdAt": "2026-10-18T14:00:00+08:00",
                     *             "completedAt": null,
                     *             "version": 1,
                     *             "reviewerId": null,
                     *             "executorId": null,
                     *             "lastError": null
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminRefundPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    executeRefund: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example refundId-1 */
                refundId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "reason": "复核通过，执行原路沙箱退款"
                 *     }
                 */
                "application/json": components["schemas"]["RefundExecuteRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "refundId": "refund-1",
                     *         "orderId": "order-1",
                     *         "paymentId": "pay-1",
                     *         "aftersaleId": "after-1",
                     *         "adjustmentId": null,
                     *         "type": "AFTERSALE",
                     *         "amount": 590,
                     *         "currency": "CNY",
                     *         "status": "PROCESSING",
                     *         "reason": "客服核验证据批准品质售后",
                     *         "createdAt": "2026-10-18T14:20:00+08:00",
                     *         "completedAt": null,
                     *         "version": 2,
                     *         "reviewerId": "u-service-1",
                     *         "executorId": "u-finance-1",
                     *         "lastError": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T14:30:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminRefundEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["Unavailable"];
        };
    };
    retryRefund: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example refundId-1 */
                refundId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1,
                 *       "reason": "复核通过，执行原路沙箱退款"
                 *     }
                 */
                "application/json": components["schemas"]["RefundExecuteRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "refundId": "refund-1",
                     *         "orderId": "order-1",
                     *         "paymentId": "pay-1",
                     *         "aftersaleId": "after-1",
                     *         "adjustmentId": null,
                     *         "type": "AFTERSALE",
                     *         "amount": 590,
                     *         "currency": "CNY",
                     *         "status": "PROCESSING",
                     *         "reason": "客服核验证据批准品质售后",
                     *         "createdAt": "2026-10-18T14:20:00+08:00",
                     *         "completedAt": null,
                     *         "version": 3,
                     *         "reviewerId": "u-service-1",
                     *         "executorId": "u-finance-1",
                     *         "lastError": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T14:30:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminRefundEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["Unavailable"];
        };
    };
    listReconciliations: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example 2026-10-18 */
                businessDate?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "reconciliationId": "recon-1",
                     *             "businessDate": "2026-10-18",
                     *             "status": "PENDING",
                     *             "paymentCount": 1,
                     *             "paymentAmount": 1190,
                     *             "refundCount": 0,
                     *             "refundAmount": 0,
                     *             "differenceAmount": 0,
                     *             "differenceCount": 0,
                     *             "createdAt": "2026-10-18T14:00:00+08:00",
                     *             "completedAt": null
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ReconciliationPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createReconciliation: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "businessDate": "2026-10-18"
                 *     }
                 */
                "application/json": components["schemas"]["ReconciliationRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            202: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "reconciliationId": "recon-1",
                     *         "businessDate": "2026-10-18",
                     *         "status": "PENDING",
                     *         "paymentCount": 1,
                     *         "paymentAmount": 1190,
                     *         "refundCount": 0,
                     *         "refundAmount": 0,
                     *         "differenceAmount": 0,
                     *         "differenceCount": 0,
                     *         "createdAt": "2026-10-18T14:00:00+08:00",
                     *         "completedAt": null
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ReconciliationEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAuditLogs: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
                /** @example u1001 */
                actorId?: string;
                /** @example order-1 */
                resourceId?: string;
                /** @example 2026-10-18T14:00:00+08:00 */
                from?: string;
                /** @example 2026-10-18T14:00:00+08:00 */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "auditId": "audit-1",
                     *             "actorId": "u1001",
                     *             "actorRoles": [
                     *               "MEMBER"
                     *             ],
                     *             "action": "ORDER_CANCEL",
                     *             "resourceType": "ORDER",
                     *             "resourceId": "order-1",
                     *             "result": "SUCCESS",
                     *             "reason": null,
                     *             "traceId": "trace-demo-001",
                     *             "occurredAt": "2026-10-18T14:00:00+08:00"
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AuditLogPageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listEmployees: {
        parameters: {
            query?: {
                page?: components["parameters"]["Page"];
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "page": 1,
                     *         "size": 20,
                     *         "total": 1,
                     *         "items": [
                     *           {
                     *             "mustChangePassword": true,
                     *             "employeeId": "emp-1",
                     *             "userId": "u-picker-1",
                     *             "displayName": "演示仓储",
                     *             "phoneMasked": "139****0001",
                     *             "roles": [
                     *               "MEMBER"
                     *             ],
                     *             "status": "ACTIVE",
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["EmployeePageEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createEmployee: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "phone": "13800138000",
                 *       "displayName": "演示仓储",
                 *       "temporaryPassword": "DemoPassword123!",
                 *       "roles": [
                 *         "MEMBER"
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["EmployeeCreateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mustChangePassword": true,
                     *         "employeeId": "emp-1",
                     *         "userId": "u-picker-1",
                     *         "displayName": "演示仓储",
                     *         "phoneMasked": "139****0001",
                     *         "roles": [
                     *           "MEMBER"
                     *         ],
                     *         "status": "ACTIVE",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["EmployeeEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    setEmployeeRoles: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example employeeId-1 */
                employeeId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "roles": [
                 *         "MEMBER"
                 *       ],
                 *       "reason": "调整岗位职责；MEMBER须显式授予",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["EmployeeRolesRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mustChangePassword": true,
                     *         "employeeId": "emp-1",
                     *         "userId": "u-picker-1",
                     *         "displayName": "演示仓储",
                     *         "phoneMasked": "139****0001",
                     *         "roles": [
                     *           "MEMBER"
                     *         ],
                     *         "status": "ACTIVE",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["EmployeeEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    setEmployeeStatus: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example employeeId-1 */
                employeeId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "ACTIVE",
                 *       "reason": "账号停用",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["EmployeeStatusRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mustChangePassword": true,
                     *         "employeeId": "emp-1",
                     *         "userId": "u-picker-1",
                     *         "displayName": "演示仓储",
                     *         "phoneMasked": "139****0001",
                     *         "roles": [
                     *           "MEMBER"
                     *         ],
                     *         "status": "ACTIVE",
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["EmployeeEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listRoles: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "code": "MEMBER",
                     *             "name": "会员",
                     *             "description": "注册账号基础购物权限；员工身份与购物权限独立",
                     *             "permissionKeys": []
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["RoleListEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAdminDeliverySlots: {
        parameters: {
            query: {
                /** @example 2026-10-18 */
                date: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "items": [
                     *           {
                     *             "slotId": "slot-20261018-2",
                     *             "date": "2026-10-18",
                     *             "label": "14:00–17:00",
                     *             "startAt": "2026-10-18T14:00:00+08:00",
                     *             "endAt": "2026-10-18T17:00:00+08:00",
                     *             "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *             "remaining": 20,
                     *             "available": true,
                     *             "unavailableReason": null,
                     *             "version": 1
                     *           }
                     *         ]
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliverySlotListEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateDeliverySlot: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example slotId-1 */
                slotId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "capacity": 30,
                 *       "cutoffAt": "2026-10-18T14:00:00+08:00",
                 *       "enabled": true,
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["SlotPolicyUpdateRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "slotId": "slot-20261018-2",
                     *         "date": "2026-10-18",
                     *         "label": "14:00–17:00",
                     *         "startAt": "2026-10-18T14:00:00+08:00",
                     *         "endAt": "2026-10-18T17:00:00+08:00",
                     *         "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *         "remaining": 20,
                     *         "available": true,
                     *         "unavailableReason": null,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliverySlotEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getBusinessPolicies: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "freightAmount": 600,
                     *         "freeShippingThresholdAmount": 9900,
                     *         "nearExpiryDays": 3,
                     *         "nearExpiryDiscountBasisPoints": 9000,
                     *         "newcomerCouponAmount": 500,
                     *         "newcomerCouponMinGoodsAmount": 3000,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BusinessPoliciesEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateBusinessPolicies: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "freightAmount": 600,
                 *       "freeShippingThresholdAmount": 9900,
                 *       "nearExpiryDays": 3,
                 *       "nearExpiryDiscountBasisPoints": 9000,
                 *       "newcomerCouponAmount": 500,
                 *       "newcomerCouponMinGoodsAmount": 3000,
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["BusinessPolicies"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "freightAmount": 600,
                     *         "freeShippingThresholdAmount": 9900,
                     *         "nearExpiryDays": 3,
                     *         "nearExpiryDiscountBasisPoints": 9000,
                     *         "newcomerCouponAmount": 500,
                     *         "newcomerCouponMinGoodsAmount": 3000,
                     *         "version": 1
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["BusinessPoliciesEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    changePassword: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "currentPassword": "DemoPassword123!",
                 *       "newPassword": "DemoPassword123!"
                 *     }
                 */
                "application/json": components["schemas"]["PasswordChangeRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "accepted": true,
                     *         "resourceId": "1001",
                     *         "version": 1,
                     *         "message": "命令已受理；异步任务完成前不表示资金已到账"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["CommandResultEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    uploadEvidenceImage: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "purpose": "AFTERSALE",
                 *       "orderId": "order-1",
                 *       "file": "<binary image bytes>"
                 *     }
                 */
                "multipart/form-data": components["schemas"]["MediaUploadRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mediaId": "media-1",
                     *         "purpose": "AFTERSALE",
                     *         "mimeType": "image/jpeg",
                     *         "sizeBytes": 102400,
                     *         "status": "READY",
                     *         "createdAt": "2026-10-18T14:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["MediaReferenceEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getPrivateMediaAccess: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example mediaId-1 */
                mediaId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mediaId": "media-1",
                     *         "url": "http://localhost:8080/media-content/media-1?token=demo",
                     *         "expiresAt": "2026-10-18T14:00:00+08:00"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["MediaAccessEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    accessDeliveryContact: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "purpose": "DELIVERY_CONTACT",
                 *       "reason": "预约配送联系用户",
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["ContactAccessRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "delivery-1",
                     *         "recipientName": "测试用户",
                     *         "phone": "13800138000",
                     *         "addressDetail": "上海市松江区演示路1号"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryContactEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    uploadProductImage: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "productId": null,
                 *       "file": "<binary image bytes>"
                 *     }
                 */
                "multipart/form-data": components["schemas"]["ProductMediaUploadRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            201: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "mediaId": "media-1",
                     *         "purpose": "PRODUCT",
                     *         "mimeType": "image/jpeg",
                     *         "sizeBytes": 102400,
                     *         "status": "READY",
                     *         "createdAt": "2026-10-18T14:00:00+08:00",
                     *         "publicUrl": "http://localhost:8080/static/products/S001.jpg"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["ProductMediaEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            409: components["responses"]["Conflict"];
            422: components["responses"]["Unprocessable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    claimAftersale: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example aftersaleId-1 */
                aftersaleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "version": 1
                 *     }
                 */
                "application/json": components["schemas"]["VersionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "aftersaleId": "after-1",
                     *         "orderId": "order-1",
                     *         "type": "QUALITY",
                     *         "reason": "商品质量问题",
                     *         "items": [
                     *           {
                     *             "orderItemId": "oi-1",
                     *             "quantity": 1,
                     *             "requestedAmount": 590
                     *           }
                     *         ],
                     *         "evidenceMediaIds": [
                     *           "media-1"
                     *         ],
                     *         "status": "APPLIED",
                     *         "requestedAmount": 590,
                     *         "approvedAmount": 0,
                     *         "reviewComment": null,
                     *         "refunds": [],
                     *         "appliedAt": "2026-10-18T14:00:00+08:00",
                     *         "version": 2,
                     *         "memberId": "u1001",
                     *         "reviewerId": null,
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "assigneeId": "u-service-1"
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T13:00:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["AdminAftersaleEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    resolveDeliveryException: {
        parameters: {
            query?: never;
            header: {
                /** @description 主体+路由+键持久化幂等；相同键同请求返回原结果，不同请求体409；建议UUID，保留至少24小时。 */
                "Idempotency-Key": components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @example taskId-1 */
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "reason": "已联系收货人确认继续配送",
                 *       "expectedVersion": 2
                 *     }
                 */
                "application/json": components["schemas"]["ResolveDeliveryExceptionRequest"];
            };
        };
        responses: {
            /** @description 成功（此文件为契约，后端尚待实现） */
            200: {
                headers: {
                    "X-Trace-Id"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "ok",
                     *       "data": {
                     *         "taskId": "delivery-1",
                     *         "orderId": "order-1",
                     *         "status": "DELIVERING",
                     *         "courierId": "u-courier-1",
                     *         "contact": {
                     *           "recipientName": "测**",
                     *           "phoneMasked": "138****8000",
                     *           "region": "上海市松江区"
                     *         },
                     *         "slot": {
                     *           "slotId": "slot-20261018-2",
                     *           "date": "2026-10-18",
                     *           "label": "14:00–17:00",
                     *           "startAt": "2026-10-18T14:00:00+08:00",
                     *           "endAt": "2026-10-18T17:00:00+08:00",
                     *           "cutoffAt": "2026-10-18T13:30:00+08:00",
                     *           "remaining": 20,
                     *           "available": true,
                     *           "unavailableReason": null,
                     *           "version": 1
                     *         },
                     *         "dispatchedAt": "2026-10-18T14:00:00+08:00",
                     *         "completedAt": null,
                     *         "version": 3
                     *       },
                     *       "traceId": "trace-demo-001",
                     *       "timestamp": "2026-10-18T14:15:00+08:00"
                     *     }
                     */
                    "application/json": components["schemas"]["DeliveryTaskEnvelope"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            409: components["responses"]["Conflict"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
}
