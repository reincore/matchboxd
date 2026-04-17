import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type PillTone = 'neutral' | 'muted' | 'accent' | 'info' | 'success' | 'warning';

const toneClasses: Record<PillTone, string> = {
  neutral: 'border-ink-700 bg-ink-900/60 text-ink-200',
  muted: 'border-ink-700 bg-ink-900/40 text-ink-400',
  accent: 'border-accent/30 bg-accent/10 text-accent-soft',
  info: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-400/50 bg-amber-500/10 text-amber-200',
};

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

export function Pill({ tone = 'neutral', className, children, ...rest }: PillProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] xl:text-[12px]',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
