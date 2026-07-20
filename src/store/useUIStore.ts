import { create } from 'zustand';
import {
  type Lang,
  readStoredLang,
  writeStoredLang,
  t as translate,
} from '@/i18n';

export interface UIState {
  currentScreen: 'welcome' | 'quick' | 'mission0' | 'game';
  activeTab: 'travel' | 'friends' | 'city' | 'shop' | 'leaderboard' | 'qr' | 'episode';
  showEpisode: boolean;
  episodeId: number | null;
  softGate: 'phone_1min' | 'phone_5levels' | 'email' | null;
  sessionPlayMs: number;
  lang: Lang;

  setScreen: (screen: UIState['currentScreen']) => void;
  setActiveTab: (tab: UIState['activeTab']) => void;
  startEpisode: (episodeId: number) => void;
  endEpisode: () => void;
  openSoftGate: (gate: UIState['softGate']) => void;
  closeSoftGate: () => void;
  addSessionPlayMs: (ms: number) => void;
  setLang: (lang: Lang) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentScreen: 'welcome',
  activeTab: 'travel',
  showEpisode: false,
  episodeId: null,
  softGate: null,
  sessionPlayMs: 0,
  lang: typeof window !== 'undefined' ? readStoredLang() : 'ru',

  setScreen: (screen) => set({ currentScreen: screen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  startEpisode: (episodeId) => set({ showEpisode: true, episodeId, activeTab: 'episode' }),
  endEpisode: () => set({ showEpisode: false, episodeId: null, activeTab: 'travel' }),
  openSoftGate: (gate) => set({ softGate: gate }),
  closeSoftGate: () => set({ softGate: null }),
  addSessionPlayMs: (ms) => set((s) => ({ sessionPlayMs: s.sessionPlayMs + ms })),
  setLang: (lang) => {
    writeStoredLang(lang);
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
    document.title = translate(lang, 'doc.title');
    set({ lang });
    // Keep player profile in sync so clouds/reload keep language
    try {
      const raw = localStorage.getItem('barsik_player');
      if (raw) {
        const player = JSON.parse(raw);
        if (player && player.lang !== lang) {
          player.lang = lang;
          localStorage.setItem('barsik_player', JSON.stringify(player));
        }
      }
    } catch {
      /* ignore */
    }
  },
}));
