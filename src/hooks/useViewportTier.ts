import { useEffect, useState } from 'react';

export type ViewportTier = 'phone' | 'tablet' | 'desktop';

function readTier(): ViewportTier {
  if (typeof window === 'undefined') return 'phone';
  const w = window.innerWidth;
  if (w >= 1100) return 'desktop';
  if (w >= 768) return 'tablet';
  return 'phone';
}

/** phone &lt;768 · tablet 768–1099 · desktop ≥1100 — for art framing, not just CSS. */
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
