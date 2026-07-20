import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useUIStore } from '@/store/useUIStore';

const PHONE_MS = 60_000; // ~1 minute of play
const EMAIL_LEVELS = 8;

/**
 * Soft progressive profile gates:
 * 1) after ~1 min play → phone (skippable)
 * 2) after 5 levels if still no phone → phone again (skippable)
 * 3) after phone + more progress → email (skippable)
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

  // Tick session play time while game is open
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

    // Gate 1: ~1 minute
    if (!hasPhone && !player.phoneAskedAt && sessionPlayMs >= PHONE_MS && !phone1minShown.current) {
      phone1minShown.current = true;
      openSoftGate('phone_1min');
      return;
    }

    // Gate 2: after 5 levels, if still no phone (even if skipped before)
    if (!hasPhone && levels >= 5 && !phone5Shown.current) {
      // Don't spam if we just asked in last 30s of session — still show once per session after 5
      phone5Shown.current = true;
      openSoftGate('phone_5levels');
      return;
    }

    // Gate 3: email later
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
