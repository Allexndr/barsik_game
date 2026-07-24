import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { getLevelConfig } from '@/utils/levels';
import { PlushButton } from '@/components/ui/PlushButton';
import { Chip } from '@/components/ui/Chip';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { IconChevronLeft, IconFriends, IconPaw, IconStar } from '@/components/ui/icons';
import './EpisodeScreen.css';

const INTERACTIVITY_LABEL: Record<string, { ru: string }> = {
  explore: { ru: 'Исследуй мир' },
  find: { ru: 'Найди предметы' },
  help: { ru: 'Помоги персонажу' },
  choice: { ru: 'Выбери решение' },
  timing: { ru: 'Рассчитай время' },
  decor: { ru: 'Играй' },
};

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
          <IconChevronLeft size={16} />
          Вернуться на карту
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
              <div className="dialogue-character">
                <IconPaw size={16} /> Барсик
              </div>
              <p className="dialogue-text">
                {player?.lang === 'kk' ? levelConfig.narrative.kk : levelConfig.narrative.ru}
              </p>
            </div>

            <div className="episode-interactivity">
              <div className={`interactivity-type interactivity-${levelConfig.interactivity}`}>
                {INTERACTIVITY_LABEL[levelConfig.interactivity]?.ru ?? 'Играй'}
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
            <div className="reward-announcement reward-pop">
              <ConfettiBurst active />
              <h3>Уровень завершён!</h3>
              <div className="reward-items">
                <Chip icon={<IconStar size={16} />} tone="star" className="reward-item">
                  {levelConfig.reward.stars} звёзд
                </Chip>
                {levelConfig.reward.friend && (
                  <Chip icon={<IconFriends size={16} />} tone="success" className="reward-item">
                    Новый друг!
                  </Chip>
                )}
              </div>
            </div>

            <PlushButton variant="primary" size="lg" className="btn-continue" onClick={handleCompleteLevel}>
              Продолжить
            </PlushButton>
          </>
        ) : (
          <div className="episode-controls">
            <PlushButton variant="primary" size="lg" className="btn-continue" onClick={handleFinishNow}>
              Готово!
            </PlushButton>
            <PlushButton variant="ghost" onClick={endEpisode}>
              <IconChevronLeft size={16} /> На карту
            </PlushButton>
          </div>
        )}
      </div>
    </div>
  );
}
