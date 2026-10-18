/// <reference types="vite/client" />
interface ImportMetaEnv {
    /** 东小锦问答接口地址，例如 /api/v1/mascot/chat。留空则使用本地 FAQ mock。不得放置任何密钥。 */
    readonly VITE_MASCOT_CHAT_URL?: string;
}
