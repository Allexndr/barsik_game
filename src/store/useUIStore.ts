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
const VOICE_GENDER_KEY = 'barsik_voice_gender';
const FREE_CHAT_KEY = 'barsik_free_chat';

export type VoiceGender = 'f' | 'm';

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

function readStoredVoiceGender(): VoiceGender {
  try {
    return localStorage.getItem(VOICE_GENDER_KEY) === 'm' ? 'm' : 'f';
  } catch {
    return 'f';
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
  /** Пакет голоса рассказчика: f — voice/{lang}/, m — voice/m/{lang}/. */
  voiceGender: VoiceGender;
  freeChatEnabled: boolean;
  showSettings: boolean;
  paused: boolean;
  /** Меняется при каждом старте миссии, чтобы повтор того же уровня заново его монтировал. */
  episodeRunId: number;

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
  setVoiceGender: (g: VoiceGender) => void;
  setFreeChat: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setPaused: (v: boolean) => void;
}

/** Последний уровень с собственной 3D-сценой: экраны mission0…mission16. */
const LAST_MISSION = 16;

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
  voiceGender: typeof window !== 'undefined' ? readStoredVoiceGender() : 'f',
  freeChatEnabled: typeof window !== 'undefined' ? readStoredFreeChat() : false,
  showSettings: false,
  paused: false,
  episodeRunId: 0,

  setScreen: (screen) => set({ currentScreen: screen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  startEpisode: (episodeId) => {
    set((state) => ({
      paused: false,
      showSettings: false,
      episodeRunId: state.episodeRunId + 1,
    }));
    // У каждого уровня 0–16 своя 3D-сцена, и экран называется по номеру.
    // Всё, что вне этого диапазона, — карточка эпизода на карте.
    if (Number.isInteger(episodeId) && episodeId >= 0 && episodeId <= LAST_MISSION) {
      set({
        currentScreen: `mission${episodeId}` as UIState['currentScreen'],
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
    // Держим профиль игрока в согласии, чтобы язык переживал облако и перезагрузку.
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
      /* не важно */
    }
  },
  toggleMuted: () =>
    set((s) => {
      const muted = !s.muted;
      try {
        localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
      } catch {
        /* не важно */
      }
      return { muted };
    }),
  setVolume: (v) => {
    try {
      localStorage.setItem(VOL_KEY, String(v));
    } catch {
      /* не важно */
    }
    set({ volume: v });
  },
  toggleTts: () =>
    set((s) => {
      const ttsEnabled = !s.ttsEnabled;
      try {
        localStorage.setItem(TTS_KEY, ttsEnabled ? '1' : '0');
      } catch {
        /* не важно */
      }
      return { ttsEnabled };
    }),
  setVoiceGender: (g) => {
    try {
      localStorage.setItem(VOICE_GENDER_KEY, g);
    } catch {
      /* не важно */
    }
    set({ voiceGender: g });
  },
  setFreeChat: (v) =>
    set(() => {
      try {
        localStorage.setItem(FREE_CHAT_KEY, v ? '1' : '0');
      } catch {
        /* не важно */
      }
      return { freeChatEnabled: v };
    }),
  setShowSettings: (v) => set({ showSettings: v }),
  setPaused: (v) => set({ paused: v }),
}));

// Для проверки: та же схема отладочного доступа, что и у `window.__gameStore` в
// useGameStore.ts, — позволяет вызывать мягкие гейты напрямую, а не высиживать
// настоящие пороги по времени сессии.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __uiStore?: typeof useUIStore }).__uiStore = useUIStore;
}
