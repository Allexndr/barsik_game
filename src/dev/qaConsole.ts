/**
 * QA console-error collector — enable with `?qa=1`.
 * Exposes `window.__qaErrors()` for Playwright / manual audits (S1 A1).
 */
export type QaErrorEntry = {
  at: number;
  source: 'error' | 'unhandledrejection' | 'console.error';
  message: string;
};

declare global {
  interface Window {
    __qaErrors?: () => QaErrorEntry[];
    __qaClearErrors?: () => void;
  }
}

export function installQaConsoleCollector() {
  if (typeof window === 'undefined') return () => {};
  const enabled = new URLSearchParams(window.location.search).get('qa') === '1';
  if (!enabled) return () => {};

  const entries: QaErrorEntry[] = [];
  const push = (source: QaErrorEntry['source'], message: string) => {
    entries.push({ at: Date.now(), source, message: message.slice(0, 500) });
  };

  const onError = (ev: ErrorEvent) => {
    push('error', ev.message || String(ev.error ?? 'error'));
  };
  const onReject = (ev: PromiseRejectionEvent) => {
    push('unhandledrejection', String(ev.reason ?? 'rejection'));
  };
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    push('console.error', args.map(String).join(' '));
    orig(...args);
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onReject);
  window.__qaErrors = () => [...entries];
  window.__qaClearErrors = () => {
    entries.length = 0;
  };

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onReject);
    console.error = orig;
    delete window.__qaErrors;
    delete window.__qaClearErrors;
  };
}
