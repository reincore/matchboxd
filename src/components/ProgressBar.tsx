import { cn } from '../utils/cn';

interface ProgressBarProps {
  value: number; // 0..1
  className?: string;
  tone?: 'accent' | 'emerald';
}

export function ProgressBar({ value, className, tone = 'accent' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full rounded-full bg-ink-800 overflow-hidden', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'accent' ? 'bg-accent' : 'bg-emerald-400',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
