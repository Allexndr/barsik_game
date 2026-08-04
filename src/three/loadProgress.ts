import * as THREE from 'three';

/**
 * Real load progress for the loading screen.
 *
 * The overlay used to animate a bar that measured nothing, so a child had
 * no idea whether the game was ten seconds away or stuck. This wires the
 * shared LoadingManager so the bar reflects actual assets.
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

/**
 * Asset filenames mean nothing to a five-year-old, so they are translated
 * into things happening in the world rather than files being fetched.
 */
function friendlyLabel(url: string, lang: 'ru' | 'kk'): string {
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
  const table = lang === 'kk' ? kk : ru;
  for (const [re, text] of table) if (re.test(file)) return text;
  return lang === 'kk' ? 'Әлемді дайындаймыз' : 'Готовим мир';
}

let lang: 'ru' | 'kk' = 'ru';
export function setLoadProgressLang(next: 'ru' | 'kk') {
  lang = next;
}

function emit(next: Partial<LoadProgress>) {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

export function onLoadProgress(listener: Listener) {
  listeners.add(listener);
  listener(state);
  // Returns void, not Set.delete's boolean — React expects a cleanup
  // function whose result is ignored.
  return () => {
    listeners.delete(listener);
  };
}

/** Call when a scene starts loading, so the bar restarts from zero. */
export function resetLoadProgress() {
  state = { loaded: 0, total: 0, ratio: 0, label: '', done: false };
  for (const l of listeners) l(state);
}

export const gameLoadingManager = new THREE.LoadingManager();

gameLoadingManager.onProgress = (url, loaded, total) => {
  emit({
    loaded,
    total,
    // Held back from 1 so the bar never sits full while work continues —
    // a full bar that keeps spinning reads as a hang.
    ratio: total > 0 ? Math.min(0.97, loaded / total) : 0,
    label: friendlyLabel(url, lang),
    done: false,
  });
};

gameLoadingManager.onLoad = () => emit({ ratio: 1, done: true });

gameLoadingManager.onError = (url) => {
  // A missing asset must not strand the overlay at 40% forever; the scene
  // has its own fallbacks for every model.
  console.warn('[load] failed:', url);
};
