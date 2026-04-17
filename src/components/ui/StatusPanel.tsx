import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { SurfaceCard } from './SurfaceCard';

interface StatusPanelProps {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function StatusPanel({
  title,
  description,
  actions,
  align = 'left',
  className,
}: StatusPanelProps) {
  return (
    <SurfaceCard
      className={cn(
        align === 'center' && 'text-center',
        className,
      )}
    >
      <div className="text-lg font-display xl:text-2xl">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-ink-300 xl:text-base">
        {description}
      </div>
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </SurfaceCard>
  );
}
