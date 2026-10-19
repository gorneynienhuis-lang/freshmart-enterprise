import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { MASCOT_FAQ, MASCOT_IDLE_LINES } from './faq';
import { askMascot, mascotChatMode } from './chat-client';
import type { MascotChatRequest } from './chat-client';
import '../../styles/mascot.css';

/** 东小锦的四个姿态（素材来自已确认的东小锦 v2 概念图，抠图后放在 public/brand/mascot/）。 */
type Pose = 'grocery' | 'wave' | 'clipboard' | 'basket';
/** 不被点击时的小动作 */
type Act = 'none' | 'hop' | 'look';

interface PoseSpec {
    readonly src: string;
    readonly alt: string;
    /** 相对舞台高度的比例，让不同姿态里的角色大小一致 */
    readonly scale: number;
    /** 眼睛位置（占图片宽高的百分比）：中心 x、中心 y、宽、高 */
    readonly eyes: readonly (readonly [number, number, number, number])[];
}

const POSES: Record<Pose, PoseSpec> = {
    grocery: { src: '/brand/mascot/dongxiaojin-grocery.png', alt: '东小锦拎着装满蔬菜的购物袋', scale: 1, eyes: [[56.1, 8.0, 5.6, 4.6], [70.4, 11.4, 5.0, 4.6]] },
    wave: { src: '/brand/mascot/dongxiaojin-wave.png', alt: '东小锦挥手打招呼', scale: 0.94, eyes: [[58.1, 8.9, 7.2, 4.4], [77.9, 11.6, 6.0, 4.6]] },
    clipboard: { src: '/brand/mascot/dongxiaojin-clipboard.png', alt: '东小锦拿着记录板查找答案', scale: 0.94, eyes: [[58.4, 13.5, 7.6, 4.8], [78.6, 16.8, 5.4, 4.4]] },
    basket: { src: '/brand/mascot/dongxiaojin-basket.png', alt: '东小锦坐在菜篮里', scale: 0.72, eyes: [[47.4, 13.9, 7.4, 6.2], [68.2, 16.4, 6.8, 6.2]] },
};

interface Message { id: number; role: 'user' | 'assistant'; text: string[] }

const QUICK = MASCOT_FAQ.filter(entry => entry.quick).map(entry => entry.question);
const GREETING = ['你好，我是东小锦。下单、预约配送、收货地址、账号和订单售后的问题都可以问我。'];
const FIRST_LINE = '你好，我是东小锦！有问题可以点我问。';
const HINT_KEY = 'dxj-hint-shown';
const BUBBLE_MS = 6000;

function sessionId(): string {
    try {
        const saved = sessionStorage.getItem('dxj-session');
        if (saved) return saved;
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
        sessionStorage.setItem('dxj-session', id);
        return id;
    } catch {
        return String(Date.now());
    }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function prefersReducedMotion(): boolean {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** 散步距离：桌面走得远一点，平板短一点，手机只挪一小步 */
function strollDistance(): number {
    const w = window.innerWidth;
    if (w > 1024) return 90;
    if (w > 640) return 64;
    return 36;
}

export function MascotAssistant() {
    const [open, setOpen] = useState(false);
    const [pose, setPose] = useState<Pose>('grocery');
    const [hovering, setHovering] = useState(false);
    const [bubble, setBubble] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState('');
    const [peek, setPeek] = useState(false);
    const [walkX, setWalkX] = useState(0);
    const [walkMs, setWalkMs] = useState(0);
    const [walking, setWalking] = useState(false);
    const [act, setAct] = useState<Act>('none');
    const [messages, setMessages] = useState<Message[]>([{ id: 0, role: 'assistant', text: GREETING }]);
    const [suggestions, setSuggestions] = useState<string[]>(QUICK);
    const stageRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLOListElement>(null);
    const nextId = useRef(1);
    const abortRef = useRef<AbortController | null>(null);
    const poseTimer = useRef<number | undefined>(undefined);
    const bubbleTimer = useRef<number | undefined>(undefined);
    const timers = useRef(new Set<number>());
    const session = useRef<string>('');
    const titleId = useId();

    // 供空闲调度读取的最新状态（避免闭包拿到旧值）
    const calmRef = useRef(true);
    calmRef.current = !open && !hovering && !busy && !peek;
    const walkingRef = useRef(false);
    walkingRef.current = walking || walkX !== 0;
    const walkXRef = useRef(0);
    walkXRef.current = walkX;

    const later = useCallback((fn: () => void, ms: number) => {
        const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
        timers.current.add(id);
        return id;
    }, []);

    const showPose = useCallback((next: Pose, holdMs?: number) => {
        window.clearTimeout(poseTimer.current);
        setPose(next);
        if (holdMs) poseTimer.current = window.setTimeout(() => setPose('grocery'), holdMs);
    }, []);

    const say = useCallback((text: string) => {
        window.clearTimeout(bubbleTimer.current);
        setBubble(text);
        showPose('wave', 1800);
        bubbleTimer.current = window.setTimeout(() => setBubble(null), BUBBLE_MS);
    }, [showPose]);

    /** 走两步：先往左走，停一会儿（可能顺便说句话），再走回原位 */
    const walkTo = useCallback((x: number, after?: () => void) => {
        const ms = Math.round(Math.max(700, Math.abs(x - walkXRef.current) * 14 + 500));
        setWalkMs(ms);
        setWalking(true);
        setWalkX(x);
        later(() => { setWalking(false); after?.(); }, ms);
    }, [later]);

    // 空闲时的小剧场：时不时说句话、散个步、蹦一下或翻翻记录板。
    useEffect(() => {
        let alive = true;
        let lineIndex = Math.floor(Math.random() * MASCOT_IDLE_LINES.length);
        const nextLine = () => MASCOT_IDLE_LINES[lineIndex++ % MASCOT_IDLE_LINES.length] ?? FIRST_LINE;

        const tick = () => {
            if (!alive) return;
            if (!calmRef.current || document.hidden || walkingRef.current) { later(tick, 3000); return; }
            const still = prefersReducedMotion();
            const r = Math.random();
            if (r < 0.42 || still) {
                say(nextLine());
                later(tick, rand(11000, 17000));
            } else if (r < 0.74) {
                walkTo(-strollDistance(), () => {
                    if (Math.random() < 0.5 && calmRef.current) say(nextLine());
                    later(() => { if (alive) walkTo(0); }, rand(3200, 5200));
                });
                later(tick, rand(15000, 21000));
            } else if (r < 0.88) {
                setAct('hop');
                later(() => setAct('none'), 1100);
                later(tick, rand(8000, 12000));
            } else {
                setAct('look');
                showPose('clipboard', 2600);
                later(() => setAct('none'), 2600);
                later(tick, rand(9000, 13000));
            }
        };

        let first = false;
        try { first = sessionStorage.getItem(HINT_KEY) !== '1'; sessionStorage.setItem(HINT_KEY, '1'); } catch { /* 无痕模式等情况下忽略 */ }
        later(() => { if (alive && calmRef.current) say(first ? FIRST_LINE : nextLine()); later(tick, rand(9000, 13000)); }, first ? 1200 : 5000);

        const pending = timers.current;
        return () => {
            alive = false;
            pending.forEach(id => window.clearTimeout(id));
            pending.clear();
        };
    }, [later, say, showPose, walkTo]);

    // 页面向下滚动后，东小锦退到屏幕边缘“探头”，避免遮挡商品；悬停、聚焦或打开面板时完整出现。
    useEffect(() => {
        const onScroll = () => setPeek(window.scrollY > 160);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // 探头时不散步、不冒泡，直接回到原位
    useEffect(() => {
        if (!peek) return;
        setBubble(null);
        setWalking(false);
        setWalkMs(0);
        setWalkX(0);
    }, [peek]);

    useEffect(() => { listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' }); }, [messages, busy]);

    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => () => { abortRef.current?.abort(); window.clearTimeout(poseTimer.current); window.clearTimeout(bubbleTimer.current); }, []);

    function toggle() {
        window.clearTimeout(bubbleTimer.current);
        setBubble(null);
        if (open) { close(); return; }
        setOpen(true);
        setAct('none');
        if (walkX !== 0) walkTo(0);
        showPose('wave', 1600);
    }

    function close() {
        setOpen(false);
        abortRef.current?.abort();
        setBusy(false);
        showPose('grocery');
        stageRef.current?.focus();
    }

    function onContextMenu(event: ReactMouseEvent) {
        event.preventDefault();
        if (!open) toggle();
    }

    function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        event.currentTarget.style.setProperty('--dxj-ry', `${(x * 22).toFixed(1)}deg`);
        event.currentTarget.style.setProperty('--dxj-rx', `${(-y * 14).toFixed(1)}deg`);
    }

    function onPointerLeave(event: ReactPointerEvent<HTMLButtonElement>) {
        event.currentTarget.style.setProperty('--dxj-ry', '0deg');
        event.currentTarget.style.setProperty('--dxj-rx', '0deg');
        setHovering(false);
        if (!busy) showPose('grocery');
    }

    async function send(text: string) {
        const message = text.trim().slice(0, 500);
        if (!message || busy) return;
        if (!session.current) session.current = sessionId();
        const user: Message = { id: nextId.current++, role: 'user', text: [message] };
        const history = messages.slice(-6).map(m => ({ role: m.role, content: m.text.join('\n') }));
        setMessages(list => [...list, user]);
        setDraft('');
        setBusy(true);
        showPose('clipboard');
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        const request: MascotChatRequest = { message, sessionId: session.current, history, page: window.location.pathname };
        try {
            const reply = await askMascot(request, controller.signal);
            setMessages(list => [...list, { id: nextId.current++, role: 'assistant', text: reply.reply }]);
            setSuggestions(reply.suggestions && reply.suggestions.length > 0 ? reply.suggestions : QUICK);
            showPose('basket', 2600);
        } catch {
            if (!controller.signal.aborted) {
                setMessages(list => [...list, { id: nextId.current++, role: 'assistant', text: ['刚才没有收到回复，请稍后再试。'] }]);
                showPose('grocery');
            }
        } finally {
            if (abortRef.current === controller) setBusy(false);
        }
    }

    function onInputKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send(draft);
        }
    }

    const showBubble = bubble !== null && !open && !peek;
    const actorStyle = { '--dxj-x': `${walkX}px`, '--dxj-walk-ms': `${walkMs}ms` } as CSSProperties;

    return (
        <div
            className="dxj"
            data-open={open ? 'true' : 'false'}
            data-peek={peek && !open && !hovering ? 'true' : 'false'}
            data-walking={walking ? 'true' : 'false'}
            data-act={act}
        >
            {open && (
                <section className="dxj-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
                    <header className="dxj-head">
                        <span className="dxj-head-avatar" aria-hidden="true"><img src={POSES.wave.src} alt="" /></span>
                        <div className="dxj-head-text">
                            <h2 id={titleId}>问东小锦</h2>
                            <p><span className="dxj-dot" aria-hidden="true" />{mascotChatMode === 'mock' ? '常见问题助手 · 演示模式' : '常见问题助手 · 在线'}</p>
                        </div>
                        <button type="button" className="dxj-close" onClick={close} aria-label="关闭问东小锦">
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        </button>
                    </header>
                    <ol className="dxj-log" ref={listRef} aria-live="polite" aria-relevant="additions">
                        {messages.map(m => (
                            <li key={m.id} className={`dxj-msg dxj-msg-${m.role}`}>
                                {m.text.map((line, i) => <p key={i}>{line}</p>)}
                            </li>
                        ))}
                        {busy && <li className="dxj-msg dxj-msg-assistant dxj-typing" aria-label="东小锦正在查找答案"><span /><span /><span /></li>}
                    </ol>
                    <div className="dxj-quick" role="group" aria-label="常见问题">
                        {suggestions.map(q => (
                            <button type="button" key={q} onClick={() => void send(q)} disabled={busy}>{q}</button>
                        ))}
                    </div>
                    <form className="dxj-compose" onSubmit={event => { event.preventDefault(); void send(draft); }}>
                        <label className="dxj-sr" htmlFor={`${titleId}-input`}>输入你的问题</label>
                        <textarea id={`${titleId}-input`} ref={inputRef} rows={1} maxLength={500} value={draft} placeholder="输入问题，回车发送" onChange={event => setDraft(event.target.value)} onKeyDown={onInputKey} />
                        <button type="submit" disabled={busy || !draft.trim()} aria-label="发送问题">
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                    </form>
                    <p className="dxj-foot">回答来自本站常见问题，以页面实际显示为准。</p>
                </section>
            )}

            <div className="dxj-actor" style={actorStyle}>
                {showBubble && (
                    <button type="button" key={bubble} className="dxj-bubble" onClick={toggle} aria-label={`${bubble}（点击打开问东小锦）`}>
                        <span role="status">{bubble}</span>
                    </button>
                )}
                {hovering && !open && !showBubble && <p className="dxj-hint dxj-hint-hover" aria-hidden="true">问东小锦</p>}

                <button
                    type="button"
                    ref={stageRef}
                    className="dxj-stage"
                    data-pose={pose}
                    aria-label={open ? '关闭问东小锦' : '打开问东小锦，查看常见问题'}
                    aria-expanded={open}
                    onClick={toggle}
                    onContextMenu={onContextMenu}
                    onPointerEnter={() => { setHovering(true); if (!busy && !open) showPose('wave'); }}
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                    onFocus={() => { if (!open) setHovering(true); }}
                    onBlur={() => setHovering(false)}
                >
                    <span className="dxj-shadow" aria-hidden="true" />
                    <span className="dxj-body">
                        <span className="dxj-hop">
                            {(Object.keys(POSES) as Pose[]).map(key => {
                                const spec = POSES[key];
                                return (
                                    <span key={key} className="dxj-pose" data-active={pose === key ? 'true' : 'false'} style={{ height: `${spec.scale * 100}%` }}>
                                        <img src={spec.src} alt={pose === key ? spec.alt : ''} draggable={false} />
                                        {spec.eyes.map(([x, y, w, h], i) => (
                                            <span key={i} className="dxj-lid" aria-hidden="true" style={{ left: `${x - w / 2}%`, top: `${y - h / 2}%`, width: `${w}%`, height: `${h}%` }} />
                                        ))}
                                    </span>
                                );
                            })}
                        </span>
                    </span>
                </button>
            </div>
        </div>
    );
}
