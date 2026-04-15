import { useEffect, useRef, useState } from 'react';
import {
  getCountryOverride,
  JUSTWATCH_COUNTRY_LIST,
} from '../../../services/countryDetection';
import { cn } from '../../../utils/cn';

export function CountryPicker({ country, onChange }: { country: string; onChange: (code: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasOverride = getCountryOverride() !== null;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Scroll the active country into view when the dropdown opens.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('[data-active]');
    if (active) active.scrollIntoView({ block: 'center' });
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="text-[11px] xl:text-[12px] text-ink-400 hover:text-ink-200 transition-colors cursor-pointer uppercase tracking-wider focus-ring rounded px-1"
        title="Change JustWatch country"
      >
        {country.toUpperCase()}
      </button>
      {open && (
        <div ref={listRef} role="listbox" className="absolute bottom-full mb-1 right-0 z-50 surface-card border border-ink-700 rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto w-44">
          {hasOverride && (
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-[12px] text-accent-soft hover:bg-ink-800 transition-colors border-b border-ink-700"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Auto-detect
            </button>
          )}
          {JUSTWATCH_COUNTRY_LIST.map((opt) => (
            <button
              key={opt.code}
              type="button"
              role="option"
              aria-selected={opt.code === country}
              {...(opt.code === country ? { 'data-active': '' } : {})}
              className={cn(
                'w-full text-left px-3 py-1.5 text-[12px] hover:bg-ink-800 transition-colors',
                opt.code === country ? 'text-accent-soft font-medium' : 'text-ink-200',
              )}
              onClick={() => { onChange(opt.code); setOpen(false); }}
            >
              <span className="uppercase text-ink-400 mr-1.5">{opt.code}</span>
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
