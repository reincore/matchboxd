import { cn } from '../utils/cn';

interface HeaderProps {
  onRestart?: () => void;
  step?: string;
  className?: string;
}

export function Header({ onRestart, step, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 sm:px-6 py-4',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Logo />
        <div>
          <div className="font-display text-lg leading-none">Matchboxd</div>
          {step && (
            <div className="text-[10px] uppercase tracking-widest text-ink-400 mt-0.5">
              {step}
            </div>
          )}
        </div>
      </div>
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
    <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/40 flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          stroke="#ec4899"
          strokeWidth="1.5"
        />
        <circle cx="9" cy="12" r="2" fill="#ec4899" />
        <circle cx="15" cy="12" r="2" fill="#ec4899" fillOpacity="0.4" />
      </svg>
    </div>
  );
}
