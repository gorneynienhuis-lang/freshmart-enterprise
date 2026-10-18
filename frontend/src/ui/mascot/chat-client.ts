/**
 * 东小锦聊天的前端适配层。
 *
 * 接口契约（后端实现时遵守，见 README）：
 *   POST {VITE_MASCOT_CHAT_URL}            默认路径约定为 /api/v1/mascot/chat
 *   请求体  MascotChatRequest
 *   响应体  项目统一返回结构 { code: 0, message, data: MascotChatReply, traceId, timestamp }
 *
 * 安全：前端只读取 VITE_MASCOT_CHAT_URL（一个地址），绝不放 API Key。
 * 真实大模型的密钥只保存在后端，由后端代为调用。
 * 未配置地址或请求失败时，自动回落到本地 FAQ mock。
 */
import { MASCOT_FALLBACK, MASCOT_FAQ, matchFaq } from './faq';

export interface MascotChatRequest {
    /** 用户输入的问题，1–500 字 */
    message: string;
    /** 前端生成的会话 ID，便于后端串联上下文；不含个人信息 */
    sessionId: string;
    /** 最近几轮对话（可选），最多 6 条 */
    history?: { role: 'user' | 'assistant'; content: string }[];
    /** 当前页面路径，帮助后端给出更贴切的回答 */
    page?: string;
}

export interface MascotChatReply {
    /** 回复正文，每个元素一段纯文本（不渲染 HTML） */
    reply: string[];
    /** 推荐的后续问题 */
    suggestions?: string[];
    /** 来源：'faq' 表示来自知识库，'model' 表示模型生成 */
    source: 'faq' | 'model' | 'fallback';
}

interface Envelope<T> { code: number; message: string; data: T; traceId?: string }

// Same-origin by default: local Vite proxies `/api` to the backend, while the
// deployed storefront reaches the Railway backend without exposing a secret.
const endpoint: string = (import.meta.env.VITE_MASCOT_CHAT_URL ?? '/api/v1/mascot/chat').trim();

export const mascotChatMode: 'api' | 'mock' = endpoint ? 'api' : 'mock';

function mockReply(message: string): MascotChatReply {
    const hit = matchFaq(message);
    if (!hit) return { reply: [...MASCOT_FALLBACK], suggestions: MASCOT_FAQ.filter(f => f.quick).map(f => f.question), source: 'fallback' };
    const suggestions = MASCOT_FAQ.filter(f => f.quick && f.id !== hit.id).slice(0, 3).map(f => f.question);
    return { reply: [...hit.answer], suggestions, source: 'faq' };
}

export async function askMascot(request: MascotChatRequest, signal?: AbortSignal): Promise<MascotChatReply> {
    if (!endpoint) {
        await new Promise(resolve => setTimeout(resolve, 450));
        return mockReply(request.message);
    }
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(request),
            ...(signal ? { signal } : {}),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as Envelope<MascotChatReply>;
        if (body.code !== 0 || !Array.isArray(body.data?.reply)) throw new Error(body.message || 'invalid reply');
        return body.data;
    } catch (error) {
        if (signal?.aborted) throw error;
        const local = mockReply(request.message);
        return { ...local, reply: ['（暂时连不上问答服务，先用常见问题回答你）', ...local.reply] };
    }
}
