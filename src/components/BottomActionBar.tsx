import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { t } from '@/i18n';
import './BottomActionBar.css';

interface Props {
  difficulty: 'easy' | 'brave' | 'super';
  setDifficulty: (d: 'easy' | 'brave' | 'super') => void;
}

export function BottomActionBar({ difficulty, setDifficulty }: Props) {
  const currentLevel = useGameStore((s) => s.currentLevel);
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);
  const startEpisode = useUIStore((s) => s.startEpisode);
  const lang = useUIStore((s) => s.lang);

  const progress = Math.min(unlockedLevels.length, 100);

  const handlePlayLevel = () => {
    startEpisode(currentLevel);
  };

  return (
    <div className="bottom-action-bar">
      <button className="btn-play-level" onClick={handlePlayLevel}>
        {t(lang, 'bar.play', { n: currentLevel + 1 })}
      </button>

      <div className="difficulty-selector">
        <label>{t(lang, 'bar.mode')}</label>
        {(['easy', 'brave', 'super'] as const).map((d) => (
          <button
            key={d}
            className={`difficulty-btn ${difficulty === d ? 'active' : ''}`}
            onClick={() => setDifficulty(d)}
          >
            {t(lang, d === 'easy' ? 'bar.easy' : d === 'brave' ? 'bar.brave' : 'bar.super')}
          </button>
        ))}
      </div>

      <button className="btn-invite">{t(lang, 'bar.invite')}</button>

      <div className="progress-bar-container">
        <div className="progress-bar">
          {Array.from({ length: 100 }).map((_, i) => (
            <div
              key={i}
              className={`progress-dot ${i < progress ? 'done' : ''}`}
              title={t(lang, 'bar.level', { n: i + 1 })}
            />
          ))}
        </div>
        <span className="progress-text">{progress}/100</span>
      </div>
    </div>
  );
}
