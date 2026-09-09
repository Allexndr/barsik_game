/**
 * Browser-safe loading progress state.
 *
 * Kept separate from Three.js' LoadingManager so the app shell and loading
 * overlay do not pull the 554 kB Three vendor chunk onto the first route.
 */

export interface LoadProgress {
  loaded: number;
  total: number;
  /** 0..1. Stays below 1 until the manager reports completion. */
  ratio: number;
  /** Child-facing description of what is arriving right now. */
  label: string;
  done: boolean;
}

type Listener = (p: LoadProgress) => void;

const listeners = new Set<Listener>();
let state: LoadProgress = { loaded: 0, total: 0, ratio: 0, label: '', done: false };
let lang: 'ru' | 'kk' = 'ru';

/** Asset filenames mean nothing to a five-year-old, so translate them into actions. */
function friendlyLabel(url: string): string {
  const file = url.split('/').pop()?.replace('.glb', '') ?? '';
  const ru: Array<[RegExp, string]> = [
    [/barsik/i, 'Будим Барсика'],
    [/aya|zhuldyz|aibek|yagodka|putalo|ice_master/i, 'Зовём друзей'],
    [/tree|pine|bush|grass|flower|plant|mushroom/i, 'Выращиваем лес'],
    [/snow|ice|winter/i, 'Насыпаем снег'],
    [/rock|stone|log|stump/i, 'Раскладываем камни'],
    [/house|cabin|treehouse|tent|table|bench|fence/i, 'Строим домики'],
    [/fox|rabbit|owl|penguin|polar|bird|frog|deer|bee/i, 'Выпускаем зверят'],
    [/apple|fruit|berry|carrot|basket|cake|honey/i, 'Раскладываем угощения'],
  ];
  const kk: Array<[RegExp, string]> = [
    [/barsik/i, 'Барсикті оятамыз'],
    [/aya|zhuldyz|aibek|yagodka|putalo|ice_master/i, 'Достарды шақырамыз'],
    [/tree|pine|bush|grass|flower|plant|mushroom/i, 'Орман өсіреміз'],
    [/snow|ice|winter/i, 'Қар себеміз'],
    [/rock|stone|log|stump/i, 'Тастарды қоямыз'],
    [/house|cabin|treehouse|tent|table|bench|fence/i, 'Үйлер саламыз'],
    [/fox|rabbit|owl|penguin|polar|bird|frog|deer|bee/i, 'Аңдарды жібереміз'],
    [/apple|fruit|berry|carrot|basket|cake|honey/i, 'Дәмдіні қоямыз'],
  ];
  for (const [re, text] of (lang === 'kk' ? kk : ru)) if (re.test(file)) return text;
  return lang === 'kk' ? 'Әлемді дайындаймыз' : 'Готовим мир';
}

export function setLoadProgressLang(next: 'ru' | 'kk') {
  lang = next;
}

function emit(next: Partial<LoadProgress>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener(state);
}

export function onLoadProgress(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function resetLoadProgress() {
  state = { loaded: 0, total: 0, ratio: 0, label: '', done: false };
  for (const listener of listeners) listener(state);
}

/** Adapter called by the Three.js LoadingManager without exposing Three here. */
export function reportLoadProgress(url: string, loaded: number, total: number) {
  emit({
    loaded,
    total,
    ratio: total > 0 ? Math.min(0.97, loaded / total) : 0,
    label: friendlyLabel(url),
    done: false,
  });
}

export function reportLoadComplete() {
  emit({ ratio: 1, done: true });
}

export function reportLoadError(url: string) {
  console.warn('[load] failed:', url);
}
