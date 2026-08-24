import { create } from 'zustand';
import {
  type Lang,
  readStoredLang,
  writeStoredLang,
  t as translate,
} from '@/i18n';

const MUTED_KEY = 'barsik_muted';
const VOL_KEY = 'barsik_volume';
const TTS_KEY = 'barsik_tts';
const FREE_CHAT_KEY = 'barsik_free_chat';

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredVolume(): number {
  try {
    const v = localStorage.getItem(VOL_KEY);
    return v ? Math.max(0, Math.min(1, parseFloat(v))) : 0.6;
  } catch {
    return 0.6;
  }
}

function readStoredTts(): boolean {
  try {
    return localStorage.getItem(TTS_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * Свободный ввод в чате хаба.
 *
 * По умолчанию выключен, и это не перестраховка: игроки — дети 5–12 лет, а
 * открытый текст между детьми это канал для травли и выманивания личных
 * данных. Включается только осознанно, в родительском разделе настроек.
 *
 * Даже включённый, он не отменяет проверок: `checkText` стоит и на отправке, и
 * на приёме, а фильтр на приёме — единственный, который нельзя обойти чужим
 * изменённым клиентом.
 */
function readStoredFreeChat(): boolean {
  try {
    return localStorage.getItem(FREE_CHAT_KEY) === '1';
  } catch {
    return false;
  }
}

export interface UIState {
  currentScreen: 'welcome' | 'quick' | 'mission0' | 'mission1' | 'mission2' | 'mission3' | 'mission4' | 'mission5' | 'mission6' | 'mission7' | 'mission8' | 'mission9' | 'mission10' | 'mission11' | 'mission12' | 'mission13' | 'mission14' | 'mission15' | 'mission16' | 'mission' | 'game' | 'hub';
  activeTab: 'travel' | 'friends' | 'city' | 'shop' | 'leaderboard' | 'qr' | 'episode';
  showEpisode: boolean;
  episodeId: number | null;
  softGate: 'phone_1min' | 'phone_5levels' | 'email' | null;
  sessionPlayMs: number;
  lang: Lang;
  muted: boolean;
  volume: number;
  ttsEnabled: boolean;
  freeChatEnabled: boolean;
  showSettings: boolean;
  paused: boolean;

  setScreen: (screen: UIState['currentScreen']) => void;
  setActiveTab: (tab: UIState['activeTab']) => void;
  startEpisode: (episodeId: number) => void;
  endEpisode: () => void;
  openSoftGate: (gate: UIState['softGate']) => void;
  closeSoftGate: () => void;
  addSessionPlayMs: (ms: number) => void;
  setLang: (lang: Lang) => void;
  toggleMuted: () => void;
  setVolume: (v: number) => void;
  toggleTts: () => void;
  setFreeChat: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setPaused: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentScreen: 'welcome',
  activeTab: 'travel',
  showEpisode: false,
  episodeId: null,
  softGate: null,
  sessionPlayMs: 0,
  lang: typeof window !== 'undefined' ? readStoredLang() : 'ru',
  muted: typeof window !== 'undefined' ? readStoredMuted() : false,
  volume: typeof window !== 'undefined' ? readStoredVolume() : 0.6,
  ttsEnabled: typeof window !== 'undefined' ? readStoredTts() : true,
  freeChatEnabled: typeof window !== 'undefined' ? readStoredFreeChat() : false,
  showSettings: false,
  paused: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  startEpisode: (episodeId) => {
    set({ paused: false, showSettings: false });
    // Level 0 = Mission0 (real 3D «Первое утро»)
    if (episodeId === 0) {
      set({
        currentScreen: 'mission0',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 1 = Mission1 (real 3D «Первый друг»)
    if (episodeId === 1) {
      set({
        currentScreen: 'mission1',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 2 = Mission2 (real 3D «Яблоневый сад»)
    if (episodeId === 2) {
      set({
        currentScreen: 'mission2',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 3 = Mission3 (real 3D «Потерявшийся ёжик»)
    if (episodeId === 3) {
      set({
        currentScreen: 'mission3',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 4 = Mission4 (real 3D «Качающийся мостик»)
    if (episodeId === 4) {
      set({
        currentScreen: 'mission4',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 5 = Mission5 (real 3D «Корзина для белочки»)
    if (episodeId === 5) {
      set({
        currentScreen: 'mission5',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 6 = Mission6 (real 3D «Лесная загадка»)
    if (episodeId === 6) {
      set({
        currentScreen: 'mission6',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 7 = Mission7 (real 3D «Встреча с Путало»)
    if (episodeId === 7) {
      set({
        currentScreen: 'mission7',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 8 = Mission8 (real 3D «Лесной праздник»)
    if (episodeId === 8) {
      set({
        currentScreen: 'mission8',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Level 9 = Mission9 (real 3D «QR-сундук»)
    if (episodeId === 9) {
      set({
        currentScreen: 'mission9',
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    // Levels 10-16 = Mission10-16 (real 3D winter chapter 1B)
    const missionScreens: Record<number, string> = {
      10: 'mission10', 11: 'mission11', 12: 'mission12',
      13: 'mission13', 14: 'mission14', 15: 'mission15', 16: 'mission16',
    };
    const screen = missionScreens[episodeId];
    if (screen) {
      set({
        currentScreen: screen as UIState['currentScreen'],
        showEpisode: false,
        episodeId: null,
        activeTab: 'travel',
      });
      return;
    }
    set({ showEpisode: true, episodeId, activeTab: 'episode' });
  },
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
  toggleMuted: () =>
    set((s) => {
      const muted = !s.muted;
      try {
        localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { muted };
    }),
  setVolume: (v) => {
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch {
      /* ignore */
    }
    set({ volume: v });
  },
  toggleTts: () =>
    set((s) => {
      const ttsEnabled = !s.ttsEnabled;
      try {
        localStorage.setItem(TTS_KEY, ttsEnabled ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { ttsEnabled };
    }),
  setFreeChat: (v) =>
    set(() => {
      try {
        localStorage.setItem(FREE_CHAT_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { freeChatEnabled: v };
    }),
  setShowSettings: (v) => set({ showSettings: v }),
  setPaused: (v) => set({ paused: v }),
}));
