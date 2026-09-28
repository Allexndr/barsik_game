import { lazy, Suspense, useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { QuickStartScreen } from '@/components/QuickStartScreen';
import { GamePage } from '@/pages/GamePage';
import { ScreenFade } from '@/components/ui/ScreenFade';
import { MissionRoute } from '@/components/MissionRoute';
import { hasMission } from '@/components/missions';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { readStoredLang, t, type Lang } from '@/i18n';
import { AudioManager } from '@/audio/AudioManager';
import { migratePlayer, migrateProgress, readPlayerProgress } from '@/utils/progressMigration';
import { restoreAccount, toPlayer } from '@/net/account';
import './App.css';

const Mission0Screen = lazy(() => import('@/components/Mission0Screen').then(m => ({ default: m.Mission0Screen })));
const HubScreen = lazy(() =>
  import('@/components/screens/HubScreen').then((mod) => ({ default: mod.HubScreen })),
);

function ScreenLoader() {
  return <LoadingOverlay />;
}

function applyLang(lang: Lang) {
  useUIStore.getState().setLang(lang);
}

export function App() {
  const currentScreen = useUIStore((s) => s.currentScreen);
  // Уровни 1–16 различаются только данными — см. `missions.ts`.
  // У нулевого свой экран: там собственный HUD с фонарями, колышками и кюем.
  const missionId = Number(/^mission(\d+)$/.exec(currentScreen)?.[1]);
  const episodeRunId = useUIStore((s) => s.episodeRunId);

  useEffect(() => {
    // Сначала язык: сохранённый выбор, затем язык игрока, если он возвращается.
    applyLang(readStoredLang());

    // Манифест озвучки запрашивается заранее, чтобы первая реплика первого уровня
    // была уже записанным клипом, а не синтезом браузера. Стоит одного запроса, а
    // 404 оставляет прежнее поведение нетронутым.
    void AudioManager.loadVoicePack().catch((error) => {
      console.warn('[audio] voice_pack_unavailable', { error });
    });
    AudioManager.setVoiceGender(useUIStore.getState().voiceGender);

    let saved: string | null = null;
    try {
      saved = localStorage.getItem('barsik_player');
    } catch (error) {
      console.warn('[storage] player_read_failed', { error });
    }
    if (saved) {
      try {
        const player = migratePlayer(JSON.parse(saved));
        const progress = readPlayerProgress(player.id, localStorage);
        useGameStore.setState({ player, ...(progress ?? {}) });
        applyLang(player.lang);
        useUIStore.setState({
          // Приветственная страница — парадный вход и для новых, и для
          // возвращающихся игроков. Тому, у кого есть сохранение, там показывается
          // заметная кнопка продолжения.
          currentScreen: 'welcome',
          sessionPlayMs: 0,
        });
      } catch (e) {
        console.error('Failed to load player', e);
        localStorage.removeItem('barsik_player');
      }
    }

    // Общий ключ `barsik_progress` больше не читается: раньше он принадлежал
    // браузеру, а не игроку, поэтому новый ник видел чужой сейв.
    void restoreAccount().then((account) => {
      if (!account) return;
      const player = toPlayer(account.user);
      const migrated = account.progress
        ? migrateProgress(account.progress)
        : readPlayerProgress(player.id, localStorage);
      useGameStore.getState().resetProgress();
      useGameStore.setState({ player, ...(migrated ?? {}) });
      applyLang(player.lang);
      useUIStore.setState({ currentScreen: 'welcome', sessionPlayMs: 0 });
    }).catch((error) => {
      console.warn('[account] restore_failed', error);
    });

    // Прямой запуск миссии только в отладочной сборке, для повторяемых проверок на
    // десктопе и телефоне: http://127.0.0.1:5174/?mission=4&lang=kk
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

      // Прямой вход в хаб для проверки: ?hub=1 — иначе до него надо пройти
      // половину сезона, а чинить его приходится каждый раз.
      if (params.get('hub')) {
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
        useUIStore.getState().setScreen('hub');
      }

      // Смена уровня без перезагрузки страницы: проход по всем семнадцати — это
      // один скрипт вместо семнадцати переходов. Перезагрузка каждый раз — верный
      // способ добиться того, чтобы сквозной прогон так и не был проведён.
      (window as unknown as { __goto?: (n: number) => void }).__goto = (n: number) => {
        (window as unknown as { __level?: unknown }).__level = undefined;
        useUIStore.getState().startEpisode(n);
      };
    }

    // `?tab=shop` открывает страницу меню напрямую. Мета-экраны спрятаны за
    // приветственным потоком, и проверить один из них иначе значит каждый раз
    // прокликивать онбординг, — а на практике это значит, что их проверяют
    // заметно реже, чем уровни.
    const allParams = new URLSearchParams(window.location.search);
    const tab = allParams.get('tab');
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
  }, []);

  useEffect(() => {
    const lang = useUIStore.getState().lang;
    document.title = t(lang, 'doc.title');
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
  }, [currentScreen]);

  return (
    <div className="app">
      <ScreenFade screenKey={`${currentScreen}:${episodeRunId}`}>
        {currentScreen === 'welcome' && <WelcomeScreen />}
        {currentScreen === 'quick' && <QuickStartScreen />}
        {currentScreen === 'mission0' && (
          <Suspense fallback={<ScreenLoader />}><Mission0Screen /></Suspense>
        )}
        {hasMission(missionId) && (
          <Suspense fallback={<ScreenLoader />}><MissionRoute levelId={missionId} /></Suspense>
        )}
        {currentScreen === 'hub' && (
          <Suspense fallback={<ScreenLoader />}><HubScreen /></Suspense>
        )}
        {currentScreen === 'game' && <GamePage />}
      </ScreenFade>
    </div>
  );
}
