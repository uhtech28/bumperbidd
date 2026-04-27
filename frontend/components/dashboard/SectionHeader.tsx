import clsx from 'clsx';

interface Props {
  title: string;
  subtitle?: string;
  /**
   * Optional leading icon (emoji or tiny SVG component). Kept as ReactNode
   * so we can swap for brand glyphs later without a prop explosion.
   */
  leading?: React.ReactNode;
  action?: { label: string; onClick?: () => void };
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  leading,
  action,
  className,
}: Props) {
  return (
    <div className={clsx('flex items-end justify-between px-5', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {leading && <span className="text-[15px]">{leading}</span>}
          <h2 className="font-display text-[17px] font-light tracking-wide text-bone">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-bone/50">{subtitle}</p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-[12px] font-medium text-brand-400 transition-colors hover:text-brand-300"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
