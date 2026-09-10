import type { ReactNode } from 'react';
import './motion.css';

/** Появление и сдвиг экранов верхнего уровня при смене ключа, без framer-motion. */
export function ScreenFade({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  return (
    <div key={screenKey} className="screen-fade">
      {children}
    </div>
  );
}
