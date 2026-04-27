'use client';

/**
 * <Tagline> — premium onboarding transition.
 *
 *   enter · opacity 0→1, y 10→0            · 0.6s  easeOut
 *   hold  · holdMs (default 1000ms)
 *   exit  · opacity 1→0, y 0→-15, blur→4px · 0.6s  easeInOut
 *   done  · onDone() fires after exit completes
 *
 * Respects prefers-reduced-motion: if set, the tagline renders nothing
 * and fires onDone on the next tick so the parent UI can appear
 * immediately.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export interface TaglineProps {
  children: React.ReactNode;
  /** Time the tagline is fully visible, in ms. Default 1000. */
  holdMs?: number;
  /** Fires once the exit animation has fully completed. */
  onDone?: () => void;
  className?: string;
}

export function Tagline({
  children,
  holdMs = 1000,
  onDone,
  className,
}: TaglineProps) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);

  // Reduced-motion path: skip the animation entirely, fire onDone on mount.
  useEffect(() => {
    if (!reduceMotion) return;
    const t = setTimeout(() => onDone?.(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Normal path: after enter (0.6s) + hold (holdMs), trigger exit.
  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => setVisible(false), 600 + holdMs);
    return () => clearTimeout(t);
  }, [holdMs, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.p
          key="tagline"
          initial={{ opacity: 0, y: 10, filter: 'blur(0px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{
            opacity: 0,
            y: -15,
            filter: 'blur(4px)',
            transition: { duration: 0.6, ease: EASE_IN_OUT },
          }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className={className}
        >
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
