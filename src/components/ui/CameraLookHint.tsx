import { useEffect, useState } from 'react';

const SEEN_KEY = 'barsik_camera_look_hint_seen';

/** One-time control affordance for the free camera, dismissed by real use. */
export function CameraLookHint({ lang }: { lang: 'ru' | 'kk' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }

    let wasVisible = false;
    const show = window.setTimeout(() => {
      wasVisible = true;
      setVisible(true);
    }, 1600);
    const hide = window.setTimeout(() => {
      setVisible(false);
      if (wasVisible) {
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
      }
    }, 7200);
    const onLook = () => {
      setVisible(false);
      // Emitted only by BaseLevelScene after an owned camera pointer moves;
      // joystick/action drags never mark this control as learned.
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
    };
    window.addEventListener('barsik:camera-look', onLook);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      window.removeEventListener('barsik:camera-look', onLook);
    };
  }, []);

  if (!visible) return null;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  return (
    <div className="m0-camera-hint" aria-hidden>
      <span className="m0-camera-hint-icon">↔</span>
      <span>
        {lang === 'kk'
          ? touch ? 'Камераны бұру үшін экранды сырғыт' : 'Камераны бұру үшін тышқанмен сүйре'
          : touch ? 'Проведи по экрану, чтобы повернуть камеру' : 'Зажми и потяни мышью, чтобы повернуть камеру'}
      </span>
    </div>
  );
}
