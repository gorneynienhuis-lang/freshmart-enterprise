import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Application } from './app/application';
import { designVersion, designVersionHref } from './app/design-version';
import './styles/r04-foundation.css';
import './styles/r03-motion.css';
import './styles/runtime-r04.css';
import './styles/r03-polish.css';
import { MascotAssistant } from './ui/mascot/MascotAssistant';

function Demo() {
    const view = useRef<HTMLDivElement>(null);
    const notice = useRef<HTMLDivElement>(null);
    const current = designVersion();
    document.documentElement.dataset.design = current;
    useEffect(() => {
        const app = new Application(view.current!, notice.current!);
        void app.start();
        return () => app.destroy();
    }, []);
    return <>
        <div className="demo-status-bar" style={{ fontFamily: 'sans-serif', fontSize: 12, padding: '7px 24px', borderBottom: '1px solid #E3E6EA', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div ref={notice} role="status" aria-live="polite">课程演示 · 数据来自后端服务 · 沙箱支付{current === 'r04' ? ' · 备选设计待确认' : ''}</div>
            <nav className="demo-design-switch" aria-label="界面版本" style={{ display: 'flex', gap: 14, whiteSpace: 'nowrap' }}>
                <a href={designVersionHref('r03')} aria-current={current === 'r03' ? 'page' : undefined} onClick={event => { event.currentTarget.href = designVersionHref('r03'); }}>当前版</a>
                <a href={designVersionHref('r04')} aria-current={current === 'r04' ? 'page' : undefined} onClick={event => { event.currentTarget.href = designVersionHref('r04'); }}>备选设计</a>
            </nav>
        </div>
        <div ref={view}/>
        <MascotAssistant />
    </>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
