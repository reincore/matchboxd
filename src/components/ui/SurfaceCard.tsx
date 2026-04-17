import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type SurfaceCardPadding = 'none' | 'sm' | 'md' | 'lg';

const paddingClasses: Record<SurfaceCardPadding, string> = {
  none: '',
  sm: 'p-3 xl:p-4',
  md: 'p-5 xl:p-6',
  lg: 'p-8 xl:p-10',
};

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: SurfaceCardPadding;
}

export function SurfaceCard({
  padding = 'md',
  className,
  children,
  ...rest
}: SurfaceCardProps) {
  return (
    <div
      {...rest}
      className={cn('surface-card', paddingClasses[padding], className)}
    >
      {children}
    </div>
  );
}
