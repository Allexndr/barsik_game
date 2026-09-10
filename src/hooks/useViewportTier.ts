import { useEffect, useState } from 'react';

export type ViewportTier = 'phone' | 'tablet' | 'desktop';

function readTier(): ViewportTier {
  if (typeof window === 'undefined') return 'phone';
  const w = window.innerWidth;
  if (w >= 1100) return 'desktop';
  if (w >= 768) return 'tablet';
  return 'phone';
}

/** телефон &lt;768 · планшет 768–1099 · десктоп ≥1100 — для кадрирования графики, а не только для CSS. */
export function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(readTier);

  useEffect(() => {
    const sync = () => setTier(readTier());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return tier;
}
