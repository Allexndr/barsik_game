import { useEffect, useMemo, useState } from 'react';
import './motion.css';

const COLORS = ['#2ECC71', '#FDCB6E', '#F1C40F', '#FF7675', '#55EFC4', '#6C5CE7', '#74b9ff'];

type Piece = {
  id: number;
  left: string;
  delay: string;
  duration: string;
  color: string;
  size: number;
  drift: string;
  spin: string;
};

/**
 * Lightweight DOM confetti — no canvas lib. Brand palette, auto-dismiss.
 * Mount when a reward card appears; unmount when parent hides it.
 */
export function ConfettiBurst({ count = 28, active = true }: { count?: number; active?: boolean }) {
  const [alive, setAlive] = useState(active);

  const pieces = useMemo<Piece[]>(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${6 + Math.random() * 88}%`,
      delay: `${Math.random() * 0.35}s`,
      duration: `${1.4 + Math.random() * 0.9}s`,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.floor(Math.random() * 8),
      drift: `${(Math.random() - 0.5) * 120}px`,
      spin: `${(Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360)}deg`,
    }));
  }, [active, count]);

  useEffect(() => {
    if (!active) {
      setAlive(false);
      return;
    }
    setAlive(true);
    const t = window.setTimeout(() => setAlive(false), 2400);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!alive || pieces.length === 0) return null;

  return (
    <div className="confetti-burst" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            // CSS vars for keyframes
            ['--drift' as string]: p.drift,
            ['--spin' as string]: p.spin,
          }}
        />
      ))}
    </div>
  );
}
