/**
 * 东小锦 FAQ 知识库（前端可维护）。
 * 内容只取自本项目已有页面文案、角色权限与操作流程；不要加入系统尚未实现的功能。
 * 新增条目：补一个 id、question、keywords（用户可能输入的词）和 answer（段落数组）。
 */
export interface MascotFaqEntry {
    readonly id: string;
    /** 快捷问题按钮上显示的文字 */
    readonly question: string;
    /** 用于本地匹配的关键词，越具体越好 */
    readonly keywords: readonly string[];
    /** 回复正文，每个元素一段 */
    readonly answer: readonly string[];
    /** 是否作为面板里的快捷问题展示 */
    readonly quick?: boolean;
}

export const MASCOT_FAQ: readonly MascotFaqEntry[] = [
    {
        id: 'order-flow',
        question: '怎么下单？',
        quick: true,
        keywords: ['下单', '购买', '买', '结算', '购物车', '怎么买', '支付', '付款'],
        answer: [
            '1. 用会员账户登录，在首页、分类或搜索里找到商品，点“加入购物车”。称重商品按估重先付，拣货后按实重多退少补。',
            '2. 打开购物车点“去结算”，选择收货地址和配送时段。',
            '3. 确认金额后点“提交订单并支付”。库存和配送名额会在提交时再次校验，最终金额以服务端计算为准。',
            '4. 本站是课程演示，使用沙箱支付，不会产生真实扣费。付款后可在“我的订单”查看进度。',
        ],
    },
    {
        id: 'delivery-slot',
        question: '如何预约配送？',
        quick: true,
        keywords: ['配送', '预约', '时段', '送达', '什么时候送', '几点', '名额'],
        answer: [
            '配送时段在结算页选择：先选好收货地址，页面会显示该地址的实时可约时段。',
            '每天分 09:00–12:00、14:00–17:00、18:00–21:00 三个时段，已截止或约满的时段不能选择。名额以提交订单时的校验为准。',
            '如果显示“暂无可预约时段”，可以换一个日期再看。',
        ],
    },
    {
        id: 'address',
        question: '如何修改收货地址？',
        quick: true,
        keywords: ['地址', '收货', '修改地址', '默认地址', '删除地址', '新增地址'],
        answer: [
            '用会员账户登录后，进入“会员中心”的“我的收货地址”，可以编辑、设为默认地址或删除不用的地址。',
            '结算页也可以点“+ 新增收货地址”。配送范围由服务端校验。',
            '已下单的订单会保留下单时的收货信息，修改地址不会影响已有订单。',
        ],
    },
    {
        id: 'account-roles',
        question: '会员和员工账号有什么区别？',
        quick: true,
        keywords: ['会员', '员工', '账号', '账户', '角色', '权限', '工作台', '注册'],
        answer: [
            '会员和员工使用各自的账户登录。会员账户用来选购商品、管理收货地址、查看订单和申请售后。',
            '员工账户登录后进入“员工工作台”，按角色只显示自己有权限的操作，例如仓储拣货、配送、运营、客服审核和财务退款。',
            '员工账户不能购物，需要购物请切换到会员账户。所有操作都由服务端独立校验角色和资源归属。',
        ],
    },
    {
        id: 'order-problem',
        question: '订单出现问题怎么办？',
        quick: true,
        keywords: ['订单', '问题', '取消', '退款', '售后', '坏', '少发', '退'],
        answer: [
            '先在“我的订单”查看订单状态：待支付的订单可以继续“去支付”，也可以取消订单。',
            '收到商品后如有品质或少发问题，在订单里“提交售后申请”，填写售后类型、数量和说明，之后可在“售后进度”查看。',
            '售后由客服审核，退款由财务执行，同一笔人工退款不会由同一人审核并执行。',
        ],
    },
    {
        id: 'weight-topup',
        question: '称重商品怎么结算？',
        keywords: ['称重', '补款', '多退少补', '实重', '估重', '差额'],
        answer: [
            '称重商品下单时按估重预付，拣货时按实际重量结算，多退少补；实重上限为估重的 110%。',
            '如果需要补款，请在订单里点“支付称重补款”，须在 10 分钟内且不晚于配送时段开始前完成。',
        ],
    },
    {
        id: 'signing-code',
        question: '收货时要做什么？',
        keywords: ['签收', '签收码', '收货', '配送员'],
        answer: [
            '订单交接发货后，可以在会员订单里查看六位签收码。配送员送达时会向你核对这串签收码。',
        ],
    },
    {
        id: 'password',
        question: '怎么修改登录密码？',
        keywords: ['密码', '修改密码', '登录不了', '忘记'],
        answer: [
            '登录后在账户安全里“修改登录密码”，密码至少 12 位。',
            '修改后所有已登录设备都会退出，需要用新密码重新登录。',
        ],
    },
];

/**
 * 东小锦平时会主动冒出来的小气泡（不点它时轮流出现）。
 * 同样只写本站真实存在的功能和规则，一句话以内。
 */
export const MASCOT_IDLE_LINES: readonly string[] = [
    '今天想吃点什么？分类和搜索都能帮你找。',
    '称重商品先按估重付，拣货后按实重多退少补。',
    '配送分上午、下午、晚上三个时段，结算时选就好。',
    '收货时把六位签收码告诉配送员就行。',
    '不知道怎么下单？点我，我一步步告诉你。',
    '收货地址可以在 会员中心 → 我的收货地址 里改。',
    '订单有问题别着急，在“我的订单”里可以申请售后。',
    '我拎着菜袋在这儿，有问题随时点我。',
];

export const MASCOT_FALLBACK: readonly string[] = [
    '这个问题我暂时还答不上来。可以试试下面的常见问题，或者在“我的订单”“会员中心”里查看对应页面。',
];

/** 本地关键词匹配：命中关键词最多的条目胜出，没有命中返回 null。 */
export function matchFaq(input: string): MascotFaqEntry | null {
    const text = input.trim().toLowerCase();
    if (!text) return null;
    let best: MascotFaqEntry | null = null;
    let bestScore = 0;
    for (const entry of MASCOT_FAQ) {
        if (text === entry.question.toLowerCase()) return entry;
        const score = entry.keywords.reduce((sum, word) => sum + (text.includes(word.toLowerCase()) ? word.length : 0), 0);
        if (score > bestScore) { best = entry; bestScore = score; }
    }
    return best;
}
