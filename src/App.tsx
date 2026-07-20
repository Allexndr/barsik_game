import { useEffect } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { QuickStartScreen } from '@/components/QuickStartScreen';
import { Mission0Screen } from '@/components/Mission0Screen';
import { GamePage } from '@/pages/GamePage';
import { readStoredLang, t, type Lang } from '@/i18n';
import type { Player } from '@/types';
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

    const saved = localStorage.getItem('barsik_player');
    if (saved) {
      try {
        const player = migratePlayer(JSON.parse(saved));
        useGameStore.setState({ player });
        applyLang(player.lang);
        const missionDone = localStorage.getItem('barsik_mission0_done') === '1';
        useUIStore.setState({
          currentScreen: missionDone ? 'game' : 'mission0',
          sessionPlayMs: 0,
        });
      } catch (e) {
        console.error('Failed to load player', e);
      }
    }

    const progress = localStorage.getItem('barsik_progress');
    if (progress) {
      try {
        const data = JSON.parse(progress);
        useGameStore.setState({
          friends: data.friends ?? [],
          unlockedLevels: data.unlockedLevels ?? [],
          currentLevel: data.currentLevel ?? 0,
          stars: data.stars ?? 0,
        });
      } catch (e) {
        console.error('Failed to load progress', e);
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
      {currentScreen === 'welcome' && <WelcomeScreen />}
      {currentScreen === 'quick' && <QuickStartScreen />}
      {currentScreen === 'mission0' && <Mission0Screen />}
      {currentScreen === 'game' && <GamePage />}
    </div>
  );
}
