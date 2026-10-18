import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Application } from './app/application';
function Demo() { const view = useRef<HTMLDivElement>(null); const notice = useRef<HTMLDivElement>(null); useEffect(() => { const app = new Application(view.current!, notice.current!); void app.start(); return () => app.destroy(); }, []); return <><div ref={notice} role="status" aria-live="polite" style={{ fontFamily: 'sans-serif', fontSize: 13, padding: '8px 24px', borderBottom: '1px solid #E3E6EA', background: '#FFFFFF' }}>课程 Demo · 数据来自本地后端 · 沙箱支付 · 界面仍为候选稿</div><div ref={view}/></>; }
createRoot(document.getElementById('root')!).render(<Demo />);
