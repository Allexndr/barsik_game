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
 * Единственный нажимаемый примитив для всех экранов, кроме приветственного.
 * Плотный плюшевый вид — градиент и нижняя тень — взят из утверждённой кнопки
 * приветствия, но собран в один общий компонент, чтобы все поверхности выглядели
 * одинаково, а не изобретали рамки заново.
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
