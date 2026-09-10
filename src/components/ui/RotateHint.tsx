import { useEffect, useState } from 'react';

const SEEN_KEY = 'barsik_rotate_hint_seen';

/**
 * Одноразовая подсказка о том, что повёрнутый набок телефон показывает больше мира.
 *
 * Ландшафт действительно расширяет обзор, но на экране об этом ничего не сказано, а
 * ребёнок сам искать не станет. Показывается один раз за всё время, только на
 * телефоне, который держат вертикально, и только когда уровень уже устоялся, чтобы
 * не спорить с первым кадром.
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
        /* приватный режим — показать её ещё раз в следующей сессии допустимо */
      }
    }, 12000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  // Убираем сразу после реального поворота: подсказка своё дело сделала.
  useEffect(() => {
    if (!visible) return;
    const onRotate = () => {
      setVisible(false);
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* не важно */
      }
    };
    window.addEventListener('orientationchange', onRotate);
    return () => window.removeEventListener('orientationchange', onRotate);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="m0-rotate-hint" aria-hidden>
      <span className="m0-rotate-icon">📱</span>
      <span>
        {lang === 'kk'
          ? 'Телефонды бұрсаң, көбірек көрінеді'
          : 'Поверни телефон — будет видно больше'}
      </span>
    </div>
  );
}
