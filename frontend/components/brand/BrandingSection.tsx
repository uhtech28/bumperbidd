'use client';

/**
 * BrandingSection — the hero lockup for BumperBid.
 *
 * Renders, in sequence:
 *   1. Gold "BB" monogram (scale + fade-in).
 *   2. BUMPERBID wordmark (thin, widely-tracked, gold gradient).
 *   3. Side-ruled "AUCTIONS" subhead (gold micro-caps).
 *   4. Italic tagline "A unit of Zidan Auto Pvt Ltd." — fades in,
 *      holds for ~1.2s, then slides upward while fading out.
 *   5. Fires `onTaglineComplete` the moment the tagline finishes, so the
 *      page that owns us can reveal the sign-in form beneath.
 *
 * The timing curve `[0.22, 1, 0.36, 1]` is the iOS "emphasised" easing —
 * the same curve used in CRED / Zerodha-style fintech onboarding.
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { LogoMark } from './LogoMark';

type Variant = 'hero' | 'compact';

interface Props {
  variant?: Variant;
  /** Show the tagline and animate its reveal/exit. */
  showTagline?: boolean;
  /** Whether the tagline should perform its exit (slide-up + fade) or stay put. */
  exitTagline?: boolean;
  /** Fired once the tagline has fully exited. */
  onTaglineComplete?: () => void;
  className?: string;
  /**
   * Optional raster override for the full BUMPERBID + AUCTIONS lockup.
   * When the file at this URL loads successfully it replaces the text
   * wordmark + gold-rule + AUCTIONS block with a single <img>, so the
   * lockup renders byte-identical to the brand artwork with no webfont
   * approximation. When it 404s we silently fall back to the live text
   * rendering below. Default: /brand/bb-wordmark.png
   */
  wordmarkSrc?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function BrandingSection({
  variant = 'hero',
  showTagline = true,
  exitTagline = true,
  onTaglineComplete,
  className,
  wordmarkSrc = '/brand/bb-wordmark.png',
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [taglineVisible, setTaglineVisible] = useState(true);
  const [wordmarkImgFailed, setWordmarkImgFailed] = useState(false);
  const useWordmarkImage = Boolean(wordmarkSrc) && !wordmarkImgFailed;

  // Fade-in → hold ~1.2s → slide-up + fade-out sequence.
  useEffect(() => {
    if (!showTagline || !exitTagline) return;
    if (prefersReducedMotion) {
      setTaglineVisible(false);
      onTaglineComplete?.();
      return;
    }
    // 0.8s fade-in + 1.2s hold = 2.0s before exit begins.
    const t = setTimeout(() => setTaglineVisible(false), 2000);
    return () => clearTimeout(t);
  }, [showTagline, exitTagline, prefersReducedMotion, onTaglineComplete]);

  const compact = variant === 'compact';
  const logoSize = compact ? 56 : 132;

  return (
    <div
      className={[
        'flex flex-col items-center text-center',
        compact ? 'gap-2' : 'gap-4',
        className ?? '',
      ].join(' ')}
    >
      {/* 1 · Monogram */}
      <LogoMark size={logoSize} />

      {/* 2 + 3 · BUMPERBID wordmark + AUCTIONS rule row.
           When a raster override is available we render it as a single
           <img> for a pixel-identical match to the brand artwork. When
           it 404s we fall back to the text + gold-rule lockup below. */}
      {useWordmarkImage ? (
        <motion.img
          src={wordmarkSrc}
          alt="BUMPERBID Auctions"
          draggable={false}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          onError={() => setWordmarkImgFailed(true)}
          className={[
            'h-auto',
            compact ? 'w-[min(78%,12rem)]' : 'w-[min(86%,22rem)]',
          ].join(' ')}
        />
      ) : (
        <>
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
            className={[
              'font-wordmark font-normal text-white',
              compact
                ? 'text-[1.3rem] tracking-[0.1em]'
                : 'text-[clamp(2.2rem,6.8vw,3.4rem)] tracking-[0.06em]',
            ].join(' ')}
          >
            BUMPERBID
          </motion.h1>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
            className={[
              'flex items-center gap-3 w-full',
              compact ? 'max-w-[11rem]' : 'max-w-[min(86%,20rem)]',
            ].join(' ')}
          >
            <span aria-hidden className="flex-1 h-px bg-brand-500/85" />
            <span
              className={[
                'uppercase text-brand-400 font-semibold',
                compact
                  ? 'text-[0.62rem] tracking-[0.22em]'
                  : 'text-[0.78rem] tracking-[0.28em]',
              ].join(' ')}
            >
              Auctions
            </span>
            <span aria-hidden className="flex-1 h-px bg-brand-500/85" />
          </motion.div>
        </>
      )}

      {/* 4 · Tagline — fades in, holds, slides up + fades out */}
      {showTagline && !compact && (
        <AnimatePresence
          onExitComplete={() => onTaglineComplete?.()}
          mode="wait"
        >
          {taglineVisible && (
            <motion.p
              key="tagline"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{
                opacity: { duration: 0.7, ease: EASE },
                y: { duration: 0.7, ease: EASE },
              }}
              className="mt-1 text-sm italic text-bone/70"
            >
              A unit of Zidan Auto Pvt Ltd.
            </motion.p>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
