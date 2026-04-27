'use client';
import clsx from 'clsx';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
>;

interface Props extends NativeButtonProps {
  loading?: boolean;
  fullWidth?: boolean;
}

export const PrimaryButton = forwardRef<HTMLButtonElement, Props>(
  ({ loading, fullWidth, children, disabled, className, ...rest }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <motion.button
        ref={ref}
        whileTap={isDisabled ? undefined : { scale: 0.985 }}
        disabled={isDisabled}
        className={clsx(
          'relative h-12 px-6 rounded-xl font-medium tracking-wide',
          'text-black',
          'bg-gradient-to-b from-brand-300 via-brand-500 to-brand-700',
          'shadow-gold-glow',
          'transition-opacity duration-200',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-brand-400/60 focus:ring-offset-2 focus:ring-offset-black',
          fullWidth && 'w-full',
          className,
        )}
        {...rest}
      >
        <span
          className={clsx(
            'flex items-center justify-center gap-2',
            loading && 'opacity-0',
          )}
        >
          {children}
        </span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        )}
      </motion.button>
    );
  },
);
PrimaryButton.displayName = 'PrimaryButton';

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-black/80"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
