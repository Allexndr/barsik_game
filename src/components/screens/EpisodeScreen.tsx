import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/useUIStore';
import { useGameStore } from '@/store/useGameStore';
import { getLevelConfig } from '@/utils/levels';
import { PlushButton } from '@/components/ui/PlushButton';
import { Chip } from '@/components/ui/Chip';
import { ConfettiBurst } from '@/components/ui/ConfettiBurst';
import { IconChevronLeft, IconFriends, IconPaw, IconStar } from '@/components/ui/icons';
import './EpisodeScreen.css';

/**
 * Экран эпизода — хаб, куда ребёнок возвращается после каждого уровня, — был
 * двуязычным ровно в одной строке: `narrative`. Всё остальное, включая тип
 * задания и кнопки, показывалось по-русски и казахоязычному игроку тоже.
 */
const INTERACTIVITY_LABEL: Record<string, { ru: string; kk: string }> = {
  explore: { ru: 'Исследуй мир', kk: 'Әлемді зертте' },
  find: { ru: 'Найди предметы', kk: 'Заттарды тап' },
  help: { ru: 'Помоги персонажу', kk: 'Кейіпкерге көмектес' },
  choice: { ru: 'Выбери решение', kk: 'Шешім таңда' },
  timing: { ru: 'Рассчитай время', kk: 'Уақытты дәл есепте' },
  decor: { ru: 'Играй', kk: 'Ойна' },
};

export function EpisodeScreen() {
  const episodeId = useUIStore((s) => s.episodeId);
  const endEpisode = useUIStore((s) => s.endEpisode);
  const completeLevel = useGameStore((s) => s.completeLevel);
  const player = useGameStore((s) => s.player);
  const pick = (ru: string, kk: string) => (player?.lang === 'kk' ? kk : ru);

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
        <p>{pick('Ошибка загрузки эпизода', 'Эпизодты жүктеу қатесі')}</p>
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
          {pick('Вернуться на карту', 'Картаға оралу')}
        </button>
        <div className="episode-title">
          <h2>{pick(`Эпизод #${episodeId + 1}`, `${episodeId + 1}-эпизод`)}: {pick(levelConfig.title, levelConfig.titleKk)}</h2>
          <p className="episode-subtitle">{pick(levelConfig.description, levelConfig.descriptionKk)}</p>
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
                {pick(
                  INTERACTIVITY_LABEL[levelConfig.interactivity]?.ru ?? 'Играй',
                  INTERACTIVITY_LABEL[levelConfig.interactivity]?.kk ?? 'Ойна',
                )}
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
              <h3>{pick('Уровень завершён!', 'Деңгей аяқталды!')}</h3>
              <div className="reward-items">
                <Chip icon={<IconStar size={16} />} tone="star" className="reward-item">
                  {levelConfig.reward.stars} {pick('звёзд', 'жұлдыз')}
                </Chip>
                {levelConfig.reward.friend && (
                  <Chip icon={<IconFriends size={16} />} tone="success" className="reward-item">
                    {pick('Новый друг!', 'Жаңа дос!')}
                  </Chip>
                )}
              </div>
            </div>

            <PlushButton variant="primary" size="lg" className="btn-continue" onClick={handleCompleteLevel}>
              {pick('Продолжить', 'Жалғастыру')}
            </PlushButton>
          </>
        ) : (
          <div className="episode-controls">
            <PlushButton variant="primary" size="lg" className="btn-continue" onClick={handleFinishNow}>
              {pick('Готово!', 'Дайын!')}
            </PlushButton>
            <PlushButton variant="ghost" onClick={endEpisode}>
              <IconChevronLeft size={16} /> {pick('На карту', 'Картаға')}
            </PlushButton>
          </div>
        )}
      </div>
    </div>
  );
}
