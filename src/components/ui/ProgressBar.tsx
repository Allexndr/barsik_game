import './ui.css';

interface Props {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max, label, className = '' }: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`ui-progress ${className}`}>
      {label ? <div className="ui-progress-label">{label}</div> : null}
      <div className="ui-progress-track" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
        <div className="ui-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface DotsProps {
  total: number;
  filled: number;
  className?: string;
}

/** Visual step progress (journey dots) — used instead of fake precise fractions on Level 1 outro. */
export function StepDots({ total, filled, className = '' }: DotsProps) {
  return (
    <div className={`ui-dots ${className}`} role="img" aria-label={`${filled}/${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`ui-dot ${i < filled ? 'is-filled' : ''}`} />
      ))}
    </div>
  );
}
