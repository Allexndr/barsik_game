import { lazy, Suspense, useEffect } from 'react';
import { useGameStore, type Friend, GAME_SAVE_VERSION } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { QuickStartScreen } from '@/components/QuickStartScreen';
import { GamePage } from '@/pages/GamePage';
import { ScreenFade } from '@/components/ui/ScreenFade';
import { MissionRoute } from '@/components/MissionRoute';
import { hasMission } from '@/components/missions';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { readStoredLang, t, type Lang } from '@/i18n';
import type { Player } from '@/types';
import { AudioManager } from '@/audio/AudioManager';
import { LEVEL_CONFIGS } from '@/utils/levels';
import { SEASON1_FRIENDS } from '@/utils/season1Friends';
import './App.css';

const Mission0Screen = lazy(() => import('@/components/Mission0Screen').then(m => ({ default: m.Mission0Screen })));
const HubScreen = lazy(() =>
  import('@/components/screens/HubScreen').then((mod) => ({ default: mod.HubScreen })),
);

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

export function migrateProgress(raw: unknown) {
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
  // Отметки о чистом прохождении. В старых сейвах их нет, и это читается как «ни
   // один уровень пока не пройден чисто» — верно, и заполнится при повторных
   // прохождениях.
  const levelClean =
    data.levelClean && typeof data.levelClean === 'object'
      ? Object.fromEntries(
          Object.entries(data.levelClean as Record<string, unknown>)
            .filter(([levelId, value]) => {
              const id = Number(levelId);
              return Number.isInteger(id) && id >= 0 && id <= 16 && value === true;
            })
            .map(([levelId]) => [Number(levelId), true]),
        )
      : {};

  const highestDone = Math.max(
    -1,
    ...unlockedLevels,
    ...Object.entries(levelStars)
      .filter(([, stars]) => Number(stars) > 0)
      .map(([id]) => Number(id)),
  );
  const requestedLevel = Math.trunc(
    Math.max(
      0,
      Math.min(17, Number.isFinite(data.currentLevel) ? Number(data.currentLevel) : 0),
    ),
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
    // Указатель не доказывает прохождение. Ограничиваем его первым уровнем после
    // подтверждённого прогресса, чтобы испорченное значение вроде 9999 не
    // перескочило сезон и не заставило интерфейс заявить, что финал пройден.
    currentLevel: highestDone >= 0
      ? Math.min(requestedLevel, Math.min(17, highestDone + 1))
      : 0,
    levelStars,
    levelClean,
    stars: Math.max(0, Number.isFinite(data.stars) ? Number(data.stars) : 0),
    cityObjects:
      data.cityObjects && typeof data.cityObjects === 'object'
        ? (data.cityObjects as Record<string, boolean>)
        : {},
    // В сейвах, написанных до появления гардероба, наряда нет; таким игрокам
    // выдаётся стартовая кепка с очками, а не голый Барсик. Без этого наряд
    // корректно сохранялся и выбрасывался при каждой перезагрузке: всё, что эта
    // функция не перечислит, остаётся значением по умолчанию.
    outfit: Array.isArray(data.outfit)
      ? (() => {
          const ids = data.outfit.filter((id): id is string => typeof id === 'string');
          const cool = ['hoodie_green', 'jeans_blue', 'tubeteika_blue', 'glasses_yellow'];
          // Снятый с производства красный набор (правка заказчика) — в зелёный cool.
          const redPack = ['hoodie_red', 'jeans_blue', 'tubeteika_red', 'glasses_clear'];
          if (
            ids.length === redPack.length
            && redPack.every((id) => ids.includes(id))
          ) {
            return cool;
          }
          if (ids.length === 2 && ids.includes('cap_green') && ids.includes('glasses_yellow')) {
            return cool;
          }
          return ids.length ? ids : cool;
        })()
      : ['hoodie_green', 'jeans_blue', 'tubeteika_blue', 'glasses_yellow'],
    // Завершение сезона выводится из канонического последнего уровня, а не из
    // редактируемого пользователем указателя или устаревшего флага в localStorage.
    season1Complete: unlockedLevels.includes(16),
  };
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
        useGameStore.setState({ player });
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

    let progress: string | null = null;
    try {
      progress = localStorage.getItem('barsik_progress');
    } catch (error) {
      console.warn('[storage] progress_read_failed', { error });
    }
    if (progress) {
      try {
        const migrated = migrateProgress(JSON.parse(progress));
        // Heal: currentLevel must be at least one past the highest completed
        // level. Older saves / aborted outros could leave the pointer on a
        // finished mission, so «Продолжить» restarted that same level.
        const highestDone = Math.max(
          -1,
          ...migrated.unlockedLevels,
          ...Object.entries(migrated.levelStars)
            .filter(([, stars]) => Number(stars) > 0)
            .map(([id]) => Number(id)),
        );
        if (highestDone >= 0 && migrated.currentLevel <= highestDone) {
          migrated.currentLevel = Math.min(17, highestDone + 1);
        }
        useGameStore.setState(migrated);
        try {
          localStorage.setItem(
            'barsik_progress',
            JSON.stringify({ version: GAME_SAVE_VERSION, ...migrated }),
          );
        } catch {
          /* не важно */
        }
      } catch (e) {
        console.error('Failed to load progress', e);
        localStorage.removeItem('barsik_progress');
      }
    }

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

      // `?tab=shop` открывает страницу меню напрямую. Мета-экраны спрятаны за
      // приветственным потоком, и проверить один из них иначе значит каждый раз
      // прокликивать онбординг, — а на практике это значит, что их проверяют
      // заметно реже, чем уровни.
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
