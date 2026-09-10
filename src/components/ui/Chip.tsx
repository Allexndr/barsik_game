import type { ReactNode } from 'react';
import './ui.css';

interface Props {
  icon: ReactNode;
  tone?: 'star' | 'fruit' | 'neutral' | 'success';
  children: ReactNode;
  className?: string;
}

/** Маленькая плашка «значок и значение» — заменяет в приложении все эмодзи-счётчики вида «⭐ 3» и «🍎 2/3». */
export function Chip({ icon, tone = 'neutral', children, className = '' }: Props) {
  return (
    <span className={`ui-chip ui-chip-${tone} ${className}`}>
      <span className="ui-chip-icon">{icon}</span>
      <span className="ui-chip-value">{children}</span>
    </span>
  );
}
