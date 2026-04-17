import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

interface StepShellProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function StepShell({ children, className, padded = true }: StepShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'w-full min-h-[100dvh] flex flex-col',
        padded && 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
