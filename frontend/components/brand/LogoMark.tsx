'use client';

/**
 * LogoMark — BumperBid "BB" monogram.
 *
 * Strategy: two layers of defence.
 *   1. Raster (preferred) — when `/brand/bb-logo.png` loads we render it
 *      as an <img>, pixel-identical to the brand artwork.
 *   2. SVG fallback — while the raster is missing / 404s we draw a
 *      double-B ribbon monogram in gold.
 *
 * Ambient micro-motion: once mounted, the mark gently breathes
 * (scale 1 → 1.02, brightness 1 → 1.04) on a 6s ease-in-out loop.
 * Intentionally just above the threshold of perception — it should read
 * as depth/presence, not as "the logo is animating". Skipped entirely
 * when prefers-reduced-motion is set.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';

interface Props {
  size?: number;
  className?: string;
  animate?: boolean;
  /** Raster override. Defaults to /brand/bb-logo.png. */
  src?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function LogoMark({
  size = 132,
  className,
  animate = true,
  src = '/brand/bb-logo.png',
}: Props) {
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  const useRaster = Boolean(src) && !failed;

  const wrapStyle: React.CSSProperties = {
    width: size,
    height: size,
    position: 'relative',
  };

  // Intro (mount) animation.
  const intro = animate
    ? { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } }
    : { initial: false as const, animate: { opacity: 1, scale: 1 } };

  // Persistent ambient breath — runs after mount, unless reduced motion.
  const breath = reduceMotion
    ? undefined
    : {
        scale: [1, 1.02, 1],
        filter: ['brightness(1)', 'brightness(1.04)', 'brightness(1)'],
      };

  if (useRaster) {
    return (
      <motion.div
        style={{ ...wrapStyle, willChange: 'transform, filter' }}
        className={className}
        initial={intro.initial}
        animate={breath ? { ...intro.animate, ...breath } : intro.animate}
        transition={{
          opacity: { duration: 0.7, ease: EASE },
          scale: breath
            ? { duration: 6, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
            : { duration: 0.7, ease: EASE },
          filter: breath
            ? { duration: 6, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
            : undefined,
        }}
      >
        <img
          src={src}
          alt="BumperBid"
          draggable={false}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </motion.div>
    );
  }

  // Vector fallback — gold double-B ribbon.
  return (
    <motion.svg
      viewBox="0 0 400 280"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="BumperBid"
      style={{ willChange: 'transform, filter' }}
      initial={intro.initial}
      animate={breath ? { ...intro.animate, ...breath } : intro.animate}
      transition={{
        opacity: { duration: 0.7, ease: EASE },
        scale: breath
          ? { duration: 6, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
          : { duration: 0.7, ease: EASE },
        filter: breath
          ? { duration: 6, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
          : undefined,
      }}
    >
      <defs>
        <linearGradient id="bbGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5CC4E" />
          <stop offset="45%" stopColor="#D4A017" />
          <stop offset="100%" stopColor="#8E6908" />
        </linearGradient>
        <linearGradient id="bbBevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE79A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFE79A" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform="translate(8 0)">
        <path
          d="M 18 12 H 120 C 175 12, 205 40, 205 82 C 205 114, 185 136, 152 142 L 152 146 C 188 152, 210 176, 210 220 C 210 258, 180 282, 120 282 H 18 Z M 52 42 V 122 H 118 C 148 122, 166 108, 166 82 C 166 56, 148 42, 118 42 Z M 52 162 V 252 H 118 C 158 252, 178 238, 178 212 C 178 184, 158 162, 118 162 Z"
          fill="url(#bbGold)"
        />
      </g>
      <g transform="translate(192 0) scale(-1 1) translate(-220 0)">
        <path
          d="M 18 12 H 120 C 175 12, 205 40, 205 82 C 205 114, 185 136, 152 142 L 152 146 C 188 152, 210 176, 210 220 C 210 258, 180 282, 120 282 H 18 Z M 52 42 V 122 H 118 C 148 122, 166 108, 166 82 C 166 56, 148 42, 118 42 Z M 52 162 V 252 H 118 C 158 252, 178 238, 178 212 C 178 184, 158 162, 118 162 Z"
          fill="url(#bbGold)"
        />
      </g>
      <rect x="0" y="10" width="400" height="80" fill="url(#bbBevel)" opacity="0.4" />
    </motion.svg>
  );
}
