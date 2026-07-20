import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { getLevelConfig } from '@/utils/levels';
import './EpisodeScreen.css';

export function EpisodeScreen() {
  const episodeId = useUIStore((s) => s.episodeId);
  const endEpisode = useUIStore((s) => s.endEpisode);
  const completeLevel = useGameStore((s) => s.completeLevel);
  const player = useGameStore((s) => s.player);

  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const levelConfig = episodeId !== null ? getLevelConfig(episodeId) : null;

  useEffect(() => {
    if (!isPlaying || !levelConfig) return;

    const duration = levelConfig.duration * 1000; // в мс
    const interval = setInterval(() => {
      setProgress((p) => {
        const newProgress = p + 100 / (duration / 100);
        if (newProgress >= 100) {
          // Уровень завершён
          setIsPlaying(false);
          return 100;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, levelConfig]);

  if (!levelConfig || episodeId === null) {
    return (
      <div className="screen screen-episode">
        <p>Ошибка загрузки эпизода</p>
      </div>
    );
  }

  const handleCompleteLevel = () => {
    completeLevel(episodeId, {
      stars: levelConfig.reward.stars,
      friendId: levelConfig.reward.friend ?? undefined,
    });
    endEpisode();
  };

  const handleFinishNow = () => {
    setProgress(100);
    setIsPlaying(false);
  };

  return (
    <div className="screen screen-episode">
      <div className="episode-header">
        <button className="btn-close-episode" onClick={endEpisode}>
          ← Вернуться на карту
        </button>
        <div className="episode-title">
          <h2>Эпизод #{episodeId + 1}: {levelConfig.title}</h2>
          <p className="episode-subtitle">{levelConfig.description}</p>
        </div>
      </div>

      <div className="episode-content">
        <div className="episode-scene">
          <div className="scene-bg" />

          <div className="scene-content">
            <div className="dialogue-box">
              <div className="dialogue-character">🐯 Барсик</div>
              <p className="dialogue-text">
                {player?.lang === 'kk' ? levelConfig.narrative.kk : levelConfig.narrative.ru}
              </p>
            </div>

            <div className="episode-interactivity">
              <div className={`interactivity-type interactivity-${levelConfig.interactivity}`}>
                {(() => {
                  switch (levelConfig.interactivity) {
                    case 'explore':
                      return '🔍 Исследуй мир';
                    case 'find':
                      return '🔎 Найди предметы';
                    case 'help':
                      return '👋 Помоги персонажу';
                    case 'choice':
                      return '🤔 Выбери решение';
                    case 'timing':
                      return '⚡ Рассчитай время';
                    default:
                      return '▶️ Играй';
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Визуализация прогресса */}
          <div className="progress-overlay">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="progress-time">
              {Math.ceil(levelConfig.duration - (progress / 100) * levelConfig.duration)}s
            </span>
          </div>
        </div>
      </div>

      <div className="episode-footer">
        {!isPlaying ? (
          <>
            <div className="reward-announcement">
              <h3>🎉 Уровень завершён!</h3>
              <div className="reward-items">
                <div className="reward-item">
                  <span className="reward-icon">⭐</span>
                  <span className="reward-value">{levelConfig.reward.stars} звёзд</span>
                </div>
                {levelConfig.reward.friend && (
                  <div className="reward-item">
                    <span className="reward-icon">🐾</span>
                    <span className="reward-value">Новый друг!</span>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-continue" onClick={handleCompleteLevel}>
              ✓ Продолжить →
            </button>
          </>
        ) : (
          <div className="episode-controls">
            <button className="btn-continue" onClick={handleFinishNow}>
              ✓ Готово!
            </button>
            <button className="btn-skip" onClick={endEpisode}>
              ← На карту
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
