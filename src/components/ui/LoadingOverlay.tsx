import { useEffect, useState } from 'react';
import { onLoadProgress, setLoadProgressLang, type LoadProgress } from '@/three/loadProgress';
import { PlushButton } from './PlushButton';
import './LoadingOverlay.css';

const LANTERN_COUNT = 3;

/**
 * A real-progress arrival screen, shared by lazy routes and level loading.
 *
 * Loading used to present a pixel runner with a collision/game-over state.
 * That made the first impression look like a different game and contradicted
 * BARSIK's no-fail story-adventure promise. The screen now previews the
 * level's gentle "make the path glow" idea instead: actual asset progress
 * lights the three lanterns and the child starts only when the scene is ready.
 */
export function LoadingOverlay({
  label,
  title,
  lang = 'ru',
  assetsReady = false,
  onPlay,
}: {
  /** Optional route-specific heading; generic loaders keep the default. */
  label?: string;
  title?: string;
  lang?: 'ru' | 'kk';
  assetsReady?: boolean;
  onPlay?: () => void;
}) {
  const [progress, setProgress] = useState<LoadProgress>({
    loaded: 0, total: 0, ratio: 0, label: '', done: false,
  });

  useEffect(() => {
    setLoadProgressLang(lang);
    return onLoadProgress(setProgress);
  }, [lang]);

  const copy = lang === 'kk'
    ? {
        eyebrow: 'БАРСИК LAND',
        defaultTitle: 'Саяхатқа дайындаламыз',
        loading: 'Сиқырлы жолды жинаймыз',
        ready: 'Жол дайын. Кеттік!',
        defaultProgress: 'Әлемді дайындаймыз',
        readyProgress: 'Әлем дайын',
        play: '▶ Ойнау',
      }
    : {
        eyebrow: 'BARSIK LAND',
        defaultTitle: 'Готовим путешествие',
        loading: 'Собираем волшебную тропу',
        ready: 'Тропа готова. В путь!',
        defaultProgress: 'Готовим мир',
        readyProgress: 'Мир готов',
        play: '▶ Играть',
      };
  const pct = Math.round(progress.ratio * 100);
  const caption = assetsReady ? copy.readyProgress : (progress.label || label || copy.defaultProgress);
  const litLanterns = assetsReady
    ? LANTERN_COUNT
    : Math.min(LANTERN_COUNT, Math.ceil(progress.ratio * LANTERN_COUNT));

  return (
    <div
      className="loading-overlay"
      role={onPlay ? 'dialog' : 'status'}
      aria-modal={onPlay ? true : undefined}
      aria-busy={!assetsReady}
      aria-label={title || copy.defaultTitle}
    >
      <div className="loading-overlay__card">
        <p className="loading-overlay__eyebrow">{copy.eyebrow}</p>
        <h1 className="loading-overlay__title">{title || copy.defaultTitle}</h1>
        <p className="loading-overlay__message">{assetsReady ? copy.ready : copy.loading}</p>

        <div className="loading-overlay__lantern-path" aria-hidden>
          {Array.from({ length: LANTERN_COUNT }, (_, index) => (
            <span
              key={index}
              className={`loading-overlay__lantern ${index < litLanterns ? 'is-lit' : ''}`}
            >
              <span className="loading-overlay__lantern-flame" />
            </span>
          ))}
        </div>

        <div
          className="loading-overlay__bar"
          role="progressbar"
          aria-label={caption}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="loading-overlay__bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <span className="loading-overlay__text" aria-live="polite">
          {caption}
          {progress.total > 0 && !assetsReady ? <em className="loading-overlay__pct"> {pct}%</em> : null}
        </span>

        {assetsReady && onPlay ? (
          <PlushButton
            variant="primary"
            size="lg"
            className="loading-overlay__play"
            onClick={onPlay}
          >
            {copy.play}
          </PlushButton>
        ) : null}
      </div>
    </div>
  );
}
