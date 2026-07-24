import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Single tappable primitive for every screen outside Welcome.
 * Chunky 3D-plush look (gradient + bottom shadow) reused from the
 * approved Welcome CTA, but scoped to one shared component so every
 * surface stays visually identical instead of re-inventing borders.
 */
export function PlushButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`plush-btn plush-btn-${variant} plush-btn-${size} ${className}`}
      {...rest}
    >
      {icon ? <span className="plush-btn-icon">{icon}</span> : null}
      {children ? <span className="plush-btn-label">{children}</span> : null}
    </button>
  );
}
