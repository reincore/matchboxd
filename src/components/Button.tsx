import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-ink-950 hover:bg-accent-soft active:bg-accent-deep shadow-accent-glow',
  secondary:
    'bg-ink-800 text-ink-100 border border-ink-600 hover:bg-ink-700 active:bg-ink-700/80',
  ghost:
    'bg-transparent text-ink-200 hover:bg-ink-800/60 active:bg-ink-800',
  danger:
    'bg-red-500/90 text-white hover:bg-red-500 active:bg-red-600',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm h-9 px-3 rounded-lg',
  md: 'text-sm h-11 px-4 rounded-xl',
  lg: 'text-base h-13 px-6 rounded-xl min-h-[52px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
