import type { ReactNode } from 'react';
import './motion.css';

/** Remount-on-key fade/slide for top-level App screens (no framer-motion). */
export function ScreenFade({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  return (
    <div key={screenKey} className="screen-fade">
      {children}
    </div>
  );
}
