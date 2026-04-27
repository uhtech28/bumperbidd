'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LogoMark } from './LogoMark';

/**
 * Full lockup: logo + BUMPERBID wordmark + AUCTIONS subhead + tagline.
 *
 * Animation sequence (first paint):
 *   0.0s  logo fades in + gentle scale
 *   0.3s  wordmark fades in
 *   0.5s  AUCTIONS + divider slide up
 *   0.8s  tagline ("A unit of Zidan Auto Pvt Ltd.") fades in
 *   2.3s  tagline slides up and fades out (only on splash — controlled by prop)
 */
interface Props {
  /** When true, the tagline exits after a short hold. Default true. */
  taglineExits?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { logo: 72, word: 'text-2xl', sub: 'text-[10px]' },
  md: { logo: 112, word: 'text-3xl sm:text-4xl', sub: 'text-xs' },
  lg: { logo: 160, word: 'text-4xl sm:text-5xl', sub: 'text-sm' },
};

export function Brandmark({
  taglineExits = true,
  size = 'lg',
  className,
}: Props) {
  const s = SIZES[size];
  const [showTagline, setShowTagline] = useState(true);

  useEffect(() => {
    if (!taglineExits) return;
    const t = setTimeout(() => setShowTagline(false), 2200);
    return () => clearTimeout(t);
  }, [taglineExits]);

  return (
    <div className={`flex flex-col items-center text-center ${className ?? ''}`}>
      <LogoMark size={s.logo} />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`font-display ${s.word} mt-6 tracking-[0.18em] text-bone font-light`}
      >
        BUMPERBID
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="mt-2 flex items-center gap-3"
      >
        <span className="h-px w-10 bg-brand-500/80" />
        <span
          className={`font-display ${s.sub} tracking-widest-2 text-brand-500 uppercase`}
        >
          Auctions
        </span>
        <span className="h-px w-10 bg-brand-500/80" />
      </motion.div>

      <AnimatePresence>
        {showTagline && (
          <motion.p
            key="tagline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{
              duration: 0.8,
              delay: showTagline ? 0.8 : 0,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-5 text-[13px] sm:text-sm text-bone/75 italic"
          >
            A unit of Zidan Auto Pvt Ltd.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
