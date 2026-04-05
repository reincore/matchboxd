import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warn';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  neutral: 'border-ink-600/70 bg-ink-800/70 text-ink-200',
  accent: 'border-accent/50 bg-accent/10 text-accent-soft',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
};

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
