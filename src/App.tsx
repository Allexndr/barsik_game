import { lazy, Suspense, useEffect } from 'react';
import { useGameStore, type Friend } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { QuickStartScreen } from '@/components/QuickStartScreen';
import { GamePage } from '@/pages/GamePage';
import { ScreenFade } from '@/components/ui/ScreenFade';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { readStoredLang, t, type Lang } from '@/i18n';
import type { Player } from '@/types';
import { AudioManager } from '@/audio/AudioManager';
import { LEVEL_CONFIGS } from '@/utils/levels';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import './App.css';

const Mission0Screen = lazy(() => import('@/components/Mission0Screen').then(m => ({ default: m.Mission0Screen })));
const Mission1Screen = lazy(() => import('@/components/Mission1Screen').then(m => ({ default: m.Mission1Screen })));
const Mission2Screen = lazy(() => import('@/components/Mission2Screen').then(m => ({ default: m.Mission2Screen })));
const Mission3Screen = lazy(() => import('@/components/Mission3Screen').then(m => ({ default: m.Mission3Screen })));
const Mission4Screen = lazy(() => import('@/components/Mission4Screen').then(m => ({ default: m.Mission4Screen })));
const Mission5Screen = lazy(() => import('@/components/Mission5Screen').then(m => ({ default: m.Mission5Screen })));
const Mission6Screen = lazy(() => import('@/components/Mission6Screen').then(m => ({ default: m.Mission6Screen })));
const Mission7Screen = lazy(() => import('@/components/Mission7Screen').then(m => ({ default: m.Mission7Screen })));
const Mission8Screen = lazy(() => import('@/components/Mission8Screen').then(m => ({ default: m.Mission8Screen })));
const Mission9Screen = lazy(() => import('@/components/Mission9Screen').then(m => ({ default: m.Mission9Screen })));
const Mission10Screen = lazy(() => import('@/components/Mission10Screen').then(m => ({ default: m.Mission10Screen })));
const Mission11Screen = lazy(() => import('@/components/Mission11Screen').then(m => ({ default: m.Mission11Screen })));
const Mission12Screen = lazy(() => import('@/components/Mission12Screen').then(m => ({ default: m.Mission12Screen })));
const Mission13Screen = lazy(() => import('@/components/Mission13Screen').then(m => ({ default: m.Mission13Screen })));
const Mission14Screen = lazy(() => import('@/components/Mission14Screen').then(m => ({ default: m.Mission14Screen })));
const Mission15Screen = lazy(() => import('@/components/Mission15Screen').then(m => ({ default: m.Mission15Screen })));
const Mission16Screen = lazy(() => import('@/components/Mission16Screen').then(m => ({ default: m.Mission16Screen })));

function ScreenLoader() {
  return <LoadingOverlay />;
}

function migratePlayer(raw: Partial<Player> & { nick?: string }): Player {
  return {
    id: raw.id || `player_${Date.now()}`,
    nick: raw.nick || 'Гость',
    gender: raw.gender === 'girl' ? 'girl' : 'boy',
    ageCategory: raw.ageCategory || '',
    phone: raw.phone || '',
    email: raw.email || '',
    lang: raw.lang === 'kk' ? 'kk' : 'ru',
    level: raw.level || 0,
    stars: raw.stars || 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    profileStage: raw.profileStage || (raw.phone ? 'phone' : 'guest_nick'),
    phoneAskedAt: raw.phoneAskedAt,
    emailAskedAt: raw.emailAskedAt,
    playStartedAt: raw.playStartedAt,
  };
}

function applyLang(lang: Lang) {
  useUIStore.getState().setLang(lang);
}

function migrateProgress(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid_progress');
  const data = raw as Record<string, unknown>;
  const unlockedLevels = Array.isArray(data.unlockedLevels)
    ? [...new Set(
        data.unlockedLevels.filter(
          (value): value is number =>
            Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 16,
        ),
      )]
    : [];
  const savedLevelStars =
    data.levelStars && typeof data.levelStars === 'object'
      ? Object.fromEntries(
          Object.entries(data.levelStars as Record<string, unknown>)
            .filter(([levelId, value]) => {
              const id = Number(levelId);
              return Number.isInteger(id) && id >= 0 && id <= 16 && typeof value === 'number' && Number.isFinite(value);
            })
            .map(([levelId, value]) => [Number(levelId), Math.max(0, Number(value))]),
        )
      : null;
  const levelStars =
    savedLevelStars ??
    Object.fromEntries(
      unlockedLevels.map((levelId) => [levelId, LEVEL_CONFIGS[levelId]?.reward.stars ?? 0]),
    );
  const migratedFriends = Array.isArray(data.friends)
    ? data.friends
        .filter(
          (friend): friend is Record<string, unknown> =>
            Boolean(friend) && typeof friend === 'object' && typeof (friend as Record<string, unknown>).id === 'string',
        )
        .map((friend) => {
          const id = String(friend.id) === 'gardener_l1' ? 'gardener' : String(friend.id);
          const catalogFriend = SEASON1_FRIENDS.find((entry) => entry.id === id);
          return {
            id,
            name: catalogFriend?.name ?? (typeof friend.name === 'string' ? friend.name : id),
            description: typeof friend.description === 'string' ? friend.description : '',
            rarity: catalogFriend?.rarity ?? 'common',
            chapter: catalogFriend?.chapter ?? 1,
            unlocked: true,
            asset: typeof friend.asset === 'string' ? friend.asset : '',
          } satisfies Friend;
        })
    : [];
  const friends = [...new Map(migratedFriends.map((friend) => [friend.id, friend])).values()];
  return {
    friends,
    unlockedLevels,
    currentLevel: Math.trunc(
      Math.max(
        0,
        Math.min(17, Number.isFinite(data.currentLevel) ? Number(data.currentLevel) : 0),
      ),
    ),
    levelStars,
    stars: Math.max(0, Number.isFinite(data.stars) ? Number(data.stars) : 0),
    cityObjects:
      data.cityObjects && typeof data.cityObjects === 'object'
        ? (data.cityObjects as Record<string, boolean>)
        : {},
    // Saves written before the wardrobe existed have no outfit; those players
    // get the starter cap and glasses rather than a bare Barsik. Without this
    // the outfit was persisted correctly and then thrown away on every
    // reload, because whatever this function omits is left at its default.
    outfit: Array.isArray(data.outfit)
      ? data.outfit.filter((id): id is string => typeof id === 'string')
      : ['cap_green', 'glasses_yellow'],
    season1Complete:
      data.season1Complete === true ||
      (Number.isFinite(data.currentLevel) && Number(data.currentLevel) >= 17) ||
      unlockedLevels.includes(16),
  };
}

export function App() {
  const currentScreen = useUIStore((s) => s.currentScreen);

  useEffect(() => {
    // Language first: stored preference, then player's lang if returning
    applyLang(readStoredLang());

    // Fetch the voice manifest early, so the first line of the first level is
    // already a rendered clip rather than the browser's synthesiser. Costs one
    // request, and a 404 leaves the old behaviour untouched.
    void AudioManager.loadVoicePack();

    const saved = localStorage.getItem('barsik_player');
    if (saved) {
      try {
        const player = migratePlayer(JSON.parse(saved));
        useGameStore.setState({ player });
        applyLang(player.lang);
        useUIStore.setState({
          // The welcome page is the public front door for new and returning
          // players. A saved player gets a prominent Continue action there.
          currentScreen: 'welcome',
          sessionPlayMs: 0,
        });
      } catch (e) {
        console.error('Failed to load player', e);
        localStorage.removeItem('barsik_player');
      }
    }

    const progress = localStorage.getItem('barsik_progress');
    if (progress) {
      try {
        const migrated = migrateProgress(JSON.parse(progress));
        useGameStore.setState(migrated);
      } catch (e) {
        console.error('Failed to load progress', e);
        localStorage.removeItem('barsik_progress');
      }
    }

    // Development-only direct mission launcher for repeatable desktop/mobile QA:
    // http://127.0.0.1:5174/?mission=4&lang=kk
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const missionParam = params.get('mission');
      const missionId = missionParam === null ? Number.NaN : Number(missionParam);
      if (Number.isInteger(missionId) && missionId >= 0 && missionId <= 16) {
        const requestedLang = params.get('lang') === 'kk' ? 'kk' : 'ru';
        const existingPlayer = useGameStore.getState().player;
        useGameStore.setState({
          player:
            existingPlayer ??
            migratePlayer({
              id: 'qa-player',
              nick: requestedLang === 'kk' ? 'Сынақшы' : 'Тест',
              gender: 'boy',
              lang: requestedLang,
            }),
        });
        applyLang(requestedLang);
        useUIStore.getState().startEpisode(missionId);
      }

      // Switch levels without a page reload, so a QA pass over all seventeen
      // is one script instead of seventeen navigations. Reloading each time
      // is how a sweep across every level ends up never actually being run.
      (window as unknown as { __goto?: (n: number) => void }).__goto = (n: number) => {
        (window as unknown as { __level?: unknown }).__level = undefined;
        useUIStore.getState().startEpisode(n);
      };

      // `?tab=shop` opens a navbar page directly. The meta screens sit behind
      // the welcome flow, so checking one otherwise means clicking through
      // onboarding every time — which in practice means they get checked far
      // less often than the levels do.
      const tab = params.get('tab');
      const tabs = ['travel', 'friends', 'city', 'shop', 'leaderboard', 'qr'] as const;
      type Tab = (typeof tabs)[number];
      if (tab && (tabs as readonly string[]).includes(tab)) {
        const existingPlayer = useGameStore.getState().player;
        useGameStore.setState({
          player:
            existingPlayer ??
            migratePlayer({ id: 'qa-player', nick: 'Тест', gender: 'boy', lang: 'ru' }),
        });
        useUIStore.setState({ currentScreen: 'game', activeTab: tab as Tab });
      }
    }
  }, []);

  useEffect(() => {
    const lang = useUIStore.getState().lang;
    document.title = t(lang, 'doc.title');
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
  }, [currentScreen]);

  return (
    <div className="app">
      <ScreenFade screenKey={currentScreen}>
        {currentScreen === 'welcome' && <WelcomeScreen />}
        {currentScreen === 'quick' && <QuickStartScreen />}
        {currentScreen === 'mission0' && (
          <Suspense fallback={<ScreenLoader />}><Mission0Screen /></Suspense>
        )}
        {currentScreen === 'mission1' && (
          <Suspense fallback={<ScreenLoader />}><Mission1Screen /></Suspense>
        )}
        {currentScreen === 'mission2' && (
          <Suspense fallback={<ScreenLoader />}><Mission2Screen /></Suspense>
        )}
        {currentScreen === 'mission3' && (
          <Suspense fallback={<ScreenLoader />}><Mission3Screen /></Suspense>
        )}
        {currentScreen === 'mission4' && (
          <Suspense fallback={<ScreenLoader />}><Mission4Screen /></Suspense>
        )}
        {currentScreen === 'mission5' && (
          <Suspense fallback={<ScreenLoader />}><Mission5Screen /></Suspense>
        )}
        {currentScreen === 'mission6' && (
          <Suspense fallback={<ScreenLoader />}><Mission6Screen /></Suspense>
        )}
        {currentScreen === 'mission7' && (
          <Suspense fallback={<ScreenLoader />}><Mission7Screen /></Suspense>
        )}
        {currentScreen === 'mission8' && (
          <Suspense fallback={<ScreenLoader />}><Mission8Screen /></Suspense>
        )}
        {currentScreen === 'mission9' && (
          <Suspense fallback={<ScreenLoader />}><Mission9Screen /></Suspense>
        )}
        {currentScreen === 'mission10' && (
          <Suspense fallback={<ScreenLoader />}><Mission10Screen /></Suspense>
        )}
        {currentScreen === 'mission11' && (
          <Suspense fallback={<ScreenLoader />}><Mission11Screen /></Suspense>
        )}
        {currentScreen === 'mission12' && (
          <Suspense fallback={<ScreenLoader />}><Mission12Screen /></Suspense>
        )}
        {currentScreen === 'mission13' && (
          <Suspense fallback={<ScreenLoader />}><Mission13Screen /></Suspense>
        )}
        {currentScreen === 'mission14' && (
          <Suspense fallback={<ScreenLoader />}><Mission14Screen /></Suspense>
        )}
        {currentScreen === 'mission15' && (
          <Suspense fallback={<ScreenLoader />}><Mission15Screen /></Suspense>
        )}
        {currentScreen === 'mission16' && (
          <Suspense fallback={<ScreenLoader />}><Mission16Screen /></Suspense>
        )}
        {currentScreen === 'game' && <GamePage />}
      </ScreenFade>
    </div>
  );
}
