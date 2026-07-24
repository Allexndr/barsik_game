import type { ReactNode } from 'react';
import './ui.css';

interface Props {
  icon: ReactNode;
  tone?: 'star' | 'fruit' | 'neutral' | 'success';
  children: ReactNode;
  className?: string;
}

/** Small icon+value pill — replaces every emoji stat ("⭐ 3", "🍎 2/3") in the app. */
export function Chip({ icon, tone = 'neutral', children, className = '' }: Props) {
  return (
    <span className={`ui-chip ui-chip-${tone} ${className}`}>
      <span className="ui-chip-icon">{icon}</span>
      <span className="ui-chip-value">{children}</span>
    </span>
  );
}
