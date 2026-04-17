import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export function SelectField({
  options,
  className,
  ...rest
}: SelectFieldProps) {
  return (
    <select
      {...rest}
      className={cn(
        'surface-field rounded-xl px-3 py-2 text-[12px] text-ink-200 transition-colors hover:border-ink-500 xl:text-[13px]',
        'focus-ring',
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value || '__empty'} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
