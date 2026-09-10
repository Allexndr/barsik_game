import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';

const PHONE_MS = 60_000; // примерно минута игры
const EMAIL_LEVELS = 8;

/**
 * Мягкие постепенные запросы данных профиля:
 * 1) примерно через минуту игры — телефон, можно пропустить;
 * 2) после пяти уровней, если телефона всё ещё нет, — снова телефон, можно
 *    пропустить;
 * 3) после телефона и дальнейшего прогресса — почта, можно пропустить.
 */
export function SoftGateController() {
  const player = useGameStore((s) => s.player);
  const unlockedLevels = useGameStore((s) => s.unlockedLevels);
  const softGate = useUIStore((s) => s.softGate);
  const sessionPlayMs = useUIStore((s) => s.sessionPlayMs);
  const openSoftGate = useUIStore((s) => s.openSoftGate);
  const addSessionPlayMs = useUIStore((s) => s.addSessionPlayMs);
  const phone1minShown = useRef(false);
  const phone5Shown = useRef(false);
  const emailShown = useRef(false);

  // Считаем время игры в сессии, пока игра открыта.
  useEffect(() => {
    if (!player) return;
    const id = window.setInterval(() => addSessionPlayMs(1000), 1000);
    return () => clearInterval(id);
  }, [player, addSessionPlayMs]);

  useEffect(() => {
    if (!player || softGate) return;

    const hasPhone = Boolean(player.phone?.trim());
    const hasEmail = Boolean(player.email?.trim());
    const levels = unlockedLevels.length;

    // Первый запрос: примерно через минуту.
    if (!hasPhone && !player.phoneAskedAt && sessionPlayMs >= PHONE_MS && !phone1minShown.current) {
      phone1minShown.current = true;
      openSoftGate('phone_1min');
      return;
    }

    // Второй запрос: после пяти уровней, если телефона всё ещё нет, даже если его
    // уже пропускали. Тот же нижний порог времени сессии PHONE_MS, что и у первого:
    // без него вернувшийся игрок, у которого с прошлой сессии открыто пять и более
    // уровней, увидит это в момент загрузки, на нулевой секунде текущей.
    if (!hasPhone && levels >= 5 && sessionPlayMs >= PHONE_MS && !phone5Shown.current) {
      phone5Shown.current = true;
      openSoftGate('phone_5levels');
      return;
    }

    // Третий запрос: почта, позже.
    if (
      hasPhone &&
      !hasEmail &&
      !player.emailAskedAt &&
      levels >= EMAIL_LEVELS &&
      !emailShown.current
    ) {
      emailShown.current = true;
      openSoftGate('email');
    }
  }, [player, softGate, sessionPlayMs, unlockedLevels.length, openSoftGate]);

  return null;
}
