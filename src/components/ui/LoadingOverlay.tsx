import { useCallback, useEffect, useRef, useState } from 'react';
import { onLoadProgress, setLoadProgressLang, type LoadProgress } from '@/three/loadProgress';
import './LoadingOverlay.css';

interface Heart {
  id: number;
  x: number;
  y: number;
}

/**
 * Loading screen with something to do.
 *
 * The old overlay animated a bar that measured nothing and said only
 * "Загрузка…", so a child could not tell a ten-second wait from a hang.
 * It now shows real progress from the shared LoadingManager, names what is
 * arriving in world terms rather than filenames, and gives the player a
 * Barsik to pet while the models come down — a wait with a toy in it is a
 * far shorter wait.
 */
export function LoadingOverlay({ label, lang = 'ru' }: { label?: string; lang?: 'ru' | 'kk' }) {
  const [progress, setProgress] = useState<LoadProgress>({
    loaded: 0, total: 0, ratio: 0, label: '', done: false,
  });
  const [pets, setPets] = useState(0);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [happy, setHappy] = useState(false);
  const heartId = useRef(0);
  const happyTimer = useRef<number | null>(null);

  useEffect(() => {
    setLoadProgressLang(lang);
    return onLoadProgress(setProgress);
  }, [lang]);

  useEffect(() => () => {
    if (happyTimer.current) window.clearTimeout(happyTimer.current);
  }, []);

  const pet = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const id = heartId.current++;
    setHearts((h) => [...h.slice(-8), { id, x, y }]);
    window.setTimeout(() => setHearts((h) => h.filter((it) => it.id !== id)), 900);
    setPets((p) => p + 1);
    setHappy(true);
    if (happyTimer.current) window.clearTimeout(happyTimer.current);
    happyTimer.current = window.setTimeout(() => setHappy(false), 600);
  }, []);

  const pct = Math.round(progress.ratio * 100);
  const caption = progress.label || label || (lang === 'kk' ? 'Жүктелуде' : 'Загрузка');

  return (
    <div className="loading-overlay">
      <div className="loading-overlay__card">
        <p className="loading-overlay__invite">
          {lang === 'kk' ? 'Барсикті сипа!' : 'Погладь Барсика!'}
        </p>

        <button
          type="button"
          className={`loading-pet${happy ? ' is-happy' : ''}`}
          onPointerDown={pet}
          aria-label={lang === 'kk' ? 'Барсикті сипау' : 'Погладить Барсика'}
        >
          <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden>
            <ellipse cx="60" cy="108" rx="30" ry="6" fill="rgba(0,0,0,0.18)" />
            <circle cx="32" cy="34" r="13" fill="#dfe7ef" />
            <circle cx="88" cy="34" r="13" fill="#dfe7ef" />
            <circle cx="32" cy="34" r="6" fill="#f7b7c0" />
            <circle cx="88" cy="34" r="6" fill="#f7b7c0" />
            <circle cx="60" cy="62" r="38" fill="#eef4f9" />
            <circle cx="40" cy="44" r="4" fill="#b9c6d2" />
            <circle cx="80" cy="46" r="3.4" fill="#b9c6d2" />
            <circle cx="70" cy="34" r="3" fill="#b9c6d2" />
            <circle cx="46" cy="82" r="3.4" fill="#b9c6d2" />
            {/* Eyes squeeze shut when petted — the whole point of the toy. */}
            {happy ? (
              <>
                <path d="M40 58q7 -7 14 0" stroke="#2d3436" strokeWidth="3.4" fill="none" strokeLinecap="round" />
                <path d="M66 58q7 -7 14 0" stroke="#2d3436" strokeWidth="3.4" fill="none" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="47" cy="59" r="6" fill="#2d3436" />
                <circle cx="73" cy="59" r="6" fill="#2d3436" />
                <circle cx="49" cy="57" r="2.2" fill="#fff" />
                <circle cx="75" cy="57" r="2.2" fill="#fff" />
              </>
            )}
            <ellipse cx="60" cy="72" rx="6" ry="4.6" fill="#f7929f" />
            <path d="M60 76v4" stroke="#2d3436" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M60 80q-7 6 -13 1" stroke="#2d3436" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M60 80q7 6 13 1" stroke="#2d3436" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          </svg>

          {hearts.map((h) => (
            <span key={h.id} className="loading-pet__heart" style={{ left: h.x, top: h.y }}>
              ♥
            </span>
          ))}
        </button>

        {pets > 0 ? (
          <p className="loading-overlay__pets">
            {lang === 'kk' ? `Сипалды: ${pets}` : `Поглажено: ${pets}`}
          </p>
        ) : null}

        <div
          className="loading-overlay__bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="loading-overlay__bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <span className="loading-overlay__text">
          {caption}
          {progress.total > 0 ? <em className="loading-overlay__pct"> {pct}%</em> : null}
        </span>
      </div>
    </div>
  );
}
