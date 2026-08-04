import { useEffect, useState } from 'react';
import './LoadingOverlay.css';

export function LoadingOverlay({ label }: { label?: string }) {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="loading-overlay">
      <div className="loading-overlay__card">
        <div className="loading-overlay__paw">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
            <path d="M12 2C8.5 2 6 4.5 6 8c0 1.2.3 2.3.8 3.3C5.3 12.3 4 14 4 16c0 3.3 3.6 6 8 6s8-2.7 8-6c0-2-1.3-3.7-2.8-4.7.5-1 .8-2.1.8-3.3 0-3.5-2.5-6-6-6zm-3 6c0-1.7 1.3-3 3-3s3 1.3 3 3-1.3 3-3 3-3-1.3-3-3z" />
          </svg>
        </div>
        <div className="loading-overlay__bar">
          <div className="loading-overlay__bar-fill" />
        </div>
        <span className="loading-overlay__text">
          {label || 'Загрузка'}{'.'.repeat(dots)}
        </span>
      </div>
    </div>
  );
}
