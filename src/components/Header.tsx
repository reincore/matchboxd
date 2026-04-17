import { cn } from '../utils/cn';

interface HeaderProps {
  onRestart?: () => void;
  className?: string;
}

export function Header({ onRestart, className }: HeaderProps) {
  const brand = (
    <>
      <Logo />
      <div className="text-ink-50">
        <div className="font-display text-xl leading-none tracking-tight sm:text-[1.6rem] lg:text-[2rem]">
          Matchboxd
        </div>
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-md"
      >
        Skip to main content
      </a>
      {onRestart ? (
        <button
          type="button"
          onClick={onRestart}
          aria-label="Start over"
          className="flex items-center gap-2.5 rounded-lg focus-ring sm:gap-3"
        >
          {brand}
        </button>
      ) : (
        <div className="flex items-center gap-2.5 sm:gap-3">
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
    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/35 bg-ink-800/95 shadow-matchbox-glow sm:h-10 sm:w-10 lg:h-12 lg:w-12">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="h-5 w-5 sm:h-[22px] sm:w-[22px] lg:h-7 lg:w-7"
      >
        {/* Film frame */}
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="#ec4899" strokeWidth="1.5" strokeOpacity="0.75" />
        {/* Equal participants; the overlap is the brightest point in the mark. */}
        <circle cx="9.5" cy="12" r="3.5" fill="#ec4899" fillOpacity="0.45" />
        <circle cx="14.5" cy="12" r="3.5" fill="#ec4899" fillOpacity="0.45" />
        {/* Intersection lens: y=±√(3.5²−2.5²)=±√6≈±2.449 → 9.55 and 14.45 */}
        <path d="M 12 9.55 A 3.5 3.5 0 0 1 12 14.45 A 3.5 3.5 0 0 1 12 9.55 Z" fill="#ec4899" fillOpacity="0.78" />
      </svg>
    </div>
  );
}
