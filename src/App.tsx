import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { QuickStartScreen } from '@/components/QuickStartScreen';
import { Mission0Screen } from '@/components/Mission0Screen';
import { GamePage } from '@/pages/GamePage';
import { ScreenFade } from '@/components/ui/ScreenFade';
import { readStoredLang, t, type Lang } from '@/i18n';
import { STORAGE_KEYS, isFlagSet, readJson } from '@/utils/storage';
import type { Friend, Player } from '@/types';
import './App.css';

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

export function App() {
  const currentScreen = useUIStore((s) => s.currentScreen);

  useEffect(() => {
    // Language first: stored preference, then player's lang if returning
    applyLang(readStoredLang());

    const saved = readJson<Partial<Player>>(STORAGE_KEYS.player);
    if (saved) {
      const player = migratePlayer(saved);
      useGameStore.setState({ player });
      applyLang(player.lang);
      useUIStore.setState({
        currentScreen: isFlagSet(STORAGE_KEYS.mission0Done) ? 'game' : 'mission0',
        sessionPlayMs: 0,
      });
    }

    const progress = readJson<{
      friends?: Friend[];
      unlockedLevels?: number[];
      currentLevel?: number;
      stars?: number;
    }>(STORAGE_KEYS.progress);
    if (progress) {
      useGameStore.setState({
        friends: progress.friends ?? [],
        unlockedLevels: progress.unlockedLevels ?? [],
        currentLevel: progress.currentLevel ?? 0,
        stars: progress.stars ?? 0,
      });
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
        {currentScreen === 'mission0' && <Mission0Screen />}
        {currentScreen === 'game' && <GamePage />}
      </ScreenFade>
    </div>
  );
}
