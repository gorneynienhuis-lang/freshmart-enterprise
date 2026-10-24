/** Home-page motion that survives `mountTemplate` replacing the DOM. */

export type MotionVisit = { consumed: boolean };
export type HomeMotion = 'reduced' | 'enter' | 'settled';

const visit: MotionVisit = { consumed: false };
let scrollInstalled = false;
let observer: IntersectionObserver | null = null;

export function nextHomeMotion(state: MotionVisit, reduced: boolean): HomeMotion {
    if (reduced) return 'reduced';
    if (state.consumed) return 'settled';
    state.consumed = true;
    return 'enter';
}

export function resetHomeVisit(state: MotionVisit): void {
    state.consumed = false;
}

export function viewTransitionName(productId: string): string {
    const safe = productId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    return `p-${safe || 'item'}`;
}

export function supportsViewTimeline(supports: (query: string) => boolean = cssSupports): boolean {
    try { return supports('animation-timeline: view()'); }
    catch { return false; }
}

export function supportsScrollTimeline(supports: (query: string) => boolean = cssSupports): boolean {
    try { return supports('animation-timeline: scroll()'); }
    catch { return false; }
}

function cssSupports(query: string): boolean {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(query);
}

function reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Mark the home root before new children paint, so a data refresh does not replay the entrance. */
export function prepareHomeRoot(root: HTMLElement): void {
    const mode = nextHomeMotion(visit, reducedMotion());
    root.dataset.motion = mode;
    root.dataset.revealMode = mode === 'reduced' ? 'off' : (supportsViewTimeline() ? 'view' : 'io');
}

export function leaveHome(root?: HTMLElement): void {
    resetHomeVisit(visit);
    observer?.disconnect();
    observer = null;
    if (!root) return;
    delete root.dataset.motion;
    delete root.dataset.revealMode;
}

export function syncChrome(root: ParentNode = document): void {
    const chrome = root.querySelector<HTMLElement>('.fm-chrome');
    if (!chrome || document.documentElement.dataset.design === 'r04') return;
    chrome.classList.toggle('is-condensed', !reducedMotion() && window.scrollY > 24);
}

function parallaxFallback(): void {
    if (document.documentElement.dataset.design === 'r04' || supportsScrollTimeline()) return;
    const root = document.querySelector<HTMLElement>('[data-page="Home"]');
    const image = root?.querySelector<HTMLElement>('.fm-market-photo');
    if (!image) return;
    if (!root || root.dataset.motion === 'reduced') {
        image.style.transform = '';
        return;
    }
    const progress = Math.max(0, Math.min(1, window.scrollY / Math.max(window.innerHeight * 0.85, 1)));
    const scale = 1.2 - progress * 0.08;
    const shift = -2 + progress * 7;
    image.style.transform = `scale(${scale}) translate3d(0, ${shift}%, 0)`;
}

function onScroll(): void {
    syncChrome();
    parallaxFallback();
}

export function installHomeMotion(): void {
    if (scrollInstalled) {
        onScroll();
        return;
    }
    scrollInstalled = true;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

export function stopHomeMotion(): void {
    if (scrollInstalled) window.removeEventListener('scroll', onScroll);
    scrollInstalled = false;
    observer?.disconnect();
    observer = null;
}

const revealSelector = '.fm-reveal, .fm-product-card';

/** Scroll reveals for browsers without `animation-timeline: view()`. */
export function bindHomeReveals(root: HTMLElement): void {
    observer?.disconnect();
    observer = null;
    syncChrome(root);
    parallaxFallback();
    if (root.dataset.page !== 'Home' || root.dataset.revealMode !== 'io') return;
    const nodes = [...root.querySelectorAll<HTMLElement>(revealSelector)];
    const settled = root.dataset.motion === 'settled';
    observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-shown');
            observer?.unobserve(entry.target);
        }
    }, { threshold: 0.22, rootMargin: '0px 0px -6% 0px' });
    for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight * 0.92;
        if (settled && visible) {
            node.classList.add('is-shown', 'is-instant');
            continue;
        }
        observer.observe(node);
    }
}
