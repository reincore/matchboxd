import { cn } from '../utils/cn';

interface HeaderProps {
  onRestart?: () => void;
  step?: string;
  className?: string;
}

export function Header({ onRestart, step, className }: HeaderProps) {
  const brand = (
    <>
      <Logo />
      <div>
        <div className="font-display text-lg leading-none sm:text-xl lg:text-2xl">
          Matchboxd
        </div>
        {step && (
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-ink-400 sm:text-[11px] lg:text-xs">
            {step}
          </div>
        )}
      </div>
    </>
  );

  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 sm:px-6 py-4',
        className,
      )}
    >
      {onRestart ? (
        <button
          type="button"
          onClick={onRestart}
          aria-label="Start over"
          className="flex items-center gap-2 rounded-lg focus-ring"
        >
          {brand}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {brand}
        </div>
      )}
      {onRestart && (
        <button
          type="button"
          onClick={onRestart}
          className="text-xs text-ink-300 hover:text-ink-100 transition-colors px-3 py-1.5 rounded-lg border border-ink-700 hover:border-ink-500 focus-ring"
        >
          Start over
        </button>
      )}
    </header>
  );
}

function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 sm:h-9 sm:w-9 lg:h-11 lg:w-11 lg:rounded-xl">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="h-[18px] w-[18px] sm:h-5 sm:w-5 lg:h-6 lg:w-6"
      >
        {/* Film frame */}
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="#ec4899" strokeWidth="1.5" strokeOpacity="0.75" />
        {/* Left circle — User A */}
        <circle cx="9.5" cy="12" r="3.5" fill="#ec4899" fillOpacity="0.55" />
        {/* Right circle — User B */}
        <circle cx="14.5" cy="12" r="3.5" fill="#ec4899" fillOpacity="0.30" />
        {/* Intersection lens: y=±√(3.5²−2.5²)=±√6≈±2.449 → 9.55 and 14.45 */}
        <path d="M 12 9.55 A 3.5 3.5 0 0 1 12 14.45 A 3.5 3.5 0 0 1 12 9.55 Z" fill="#ec4899" fillOpacity="0.82" />
      </svg>
    </div>
  );
}
