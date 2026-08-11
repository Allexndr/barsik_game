import { useEffect, useState } from 'react';
import { IconRotatePhone } from './icons';

const SEEN_KEY = 'barsik_rotate_hint_seen';

/**
 * One-time nudge that turning the phone sideways shows more of the world.
 *
 * Landscape genuinely widens the view, but nothing on screen says so, and a
 * child will not go looking for it. Shown once ever, only on a phone held
 * upright, and only after the level has settled so it does not compete with
 * the opening shot.
 */
export function RotateHint({ lang }: { lang: 'ru' | 'kk' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isPhone = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 820;
    const isPortrait = window.innerHeight > window.innerWidth * 1.15;
    if (!isPhone || !isPortrait) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }

    const show = setTimeout(() => setVisible(true), 6000);
    const hide = setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* private mode — showing it again next session is acceptable */
      }
    }, 12000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // Dismiss as soon as they actually rotate — the hint has done its job.
  useEffect(() => {
    if (!visible) return;
    const onRotate = () => {
      setVisible(false);
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('orientationchange', onRotate);
    return () => window.removeEventListener('orientationchange', onRotate);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="m0-rotate-hint" aria-hidden>
      <span className="m0-rotate-icon"><IconRotatePhone size={22} /></span>
      <span>
        {lang === 'kk'
          ? 'Телефонды бұрсаң, көбірек көрінеді'
          : 'Поверни телефон — будет видно больше'}
      </span>
    </div>
  );
}
