import type { MoodFilter, SourceFilter, SortOption } from '../filters';
import { MOODS, SORT_OPTIONS, SHORT_RUNTIME_CEILING, HIGH_RATING_THRESHOLD } from '../filters';
import { cn } from '../../../utils/cn';

export interface FilterBarProps {
  mood: MoodFilter;
  onMoodChange: (m: MoodFilter) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (s: SourceFilter) => void;
  underOneHundred: boolean;
  onUnderOneHundredChange: (v: boolean) => void;
  highRatedOnly: boolean;
  onHighRatedOnlyChange: (v: boolean) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  count: number;
  userA: string;
  userB: string;
}

export function FilterBar({
  mood,
  onMoodChange,
  sourceFilter,
  onSourceFilterChange,
  underOneHundred,
  onUnderOneHundredChange,
  highRatedOnly,
  onHighRatedOnlyChange,
  sort,
  onSortChange,
  count,
  userA,
  userB,
}: FilterBarProps) {
  const sourceOptions: { id: SourceFilter; label: string }[] = [
    { id: 'all', label: 'All films' },
    { id: 'both', label: 'Both' },
    { id: 'userA', label: `@${userA}` },
    { id: 'userB', label: `@${userB}` },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 xl:py-4 bg-ink-950/85 backdrop-blur-md border-b border-ink-800">
      <div className="flex flex-wrap items-center gap-3 xl:gap-4">
        <div className="flex flex-wrap items-center gap-2 xl:gap-2.5">
          <span className="text-[11px] xl:text-[12px] uppercase tracking-[0.18em] text-ink-500">
            Mood
          </span>
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onMoodChange(m.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-full text-[12px] xl:text-[13px] font-medium border transition-colors focus-ring',
                mood === m.id
                  ? 'bg-accent/15 border-accent/60 text-accent-soft'
                  : 'bg-ink-900/60 border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500',
              )}
            >
              <span aria-hidden>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:gap-2.5 pl-0 sm:pl-1 xl:pl-3 sm:border-l sm:border-ink-800">
          <span className="text-[11px] xl:text-[12px] uppercase tracking-[0.18em] text-ink-500">
            Quick filter
          </span>
          <button
            type="button"
            onClick={() => onUnderOneHundredChange(!underOneHundred)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-full text-[12px] xl:text-[13px] font-medium border transition-colors focus-ring',
              underOneHundred
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                : 'bg-ink-900/60 border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500',
            )}
            aria-pressed={underOneHundred}
          >
            <span aria-hidden>⏱</span>
            Under {SHORT_RUNTIME_CEILING} min
          </button>
          <button
            type="button"
            onClick={() => onHighRatedOnlyChange(!highRatedOnly)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-full text-[12px] xl:text-[13px] font-medium border transition-colors focus-ring',
              highRatedOnly
                ? 'bg-amber-500/10 border-amber-400/50 text-amber-200'
                : 'bg-ink-900/60 border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500',
            )}
            aria-pressed={highRatedOnly}
          >
            <span aria-hidden>★</span>
            {HIGH_RATING_THRESHOLD}+ LB
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 xl:gap-2.5">
          <span className="text-[11px] xl:text-[12px] uppercase tracking-wider text-ink-500">
            {count} shown
          </span>
          <select
            aria-label="Filter by source"
            value={sourceFilter}
            onChange={(e) => onSourceFilterChange(e.target.value as SourceFilter)}
            className="bg-ink-900/60 border border-ink-700 rounded-lg text-[12px] xl:text-[13px] px-2 xl:px-2.5 py-1.5 xl:py-2 text-ink-200 focus-ring hover:border-ink-500 transition-colors"
          >
            {sourceOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort order"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="bg-ink-900/60 border border-ink-700 rounded-lg text-[12px] xl:text-[13px] px-2 xl:px-2.5 py-1.5 xl:py-2 text-ink-200 focus-ring hover:border-ink-500 transition-colors"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
