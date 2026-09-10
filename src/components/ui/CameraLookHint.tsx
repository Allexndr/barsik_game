import { useEffect, useState } from 'react';

const SEEN_KEY = 'barsik_camera_look_hint_seen';

/** Одноразовая подсказка об управлении свободной камерой; исчезает при реальном использовании. */
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
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* приватный режим */ }
      }
    }, 7200);
    const onLook = () => {
      setVisible(false);
      // Отправляется только из BaseLevelScene после движения указателя, которым
      // управляют камерой; перетаскивание джойстика или кнопки действия освоенным
      // это управление не считает.
      try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* приватный режим */ }
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
