import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs uppercase tracking-wider text-ink-400 xl:text-[13px]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
