import { JUSTWATCH_COUNTRY_LIST } from '../../../services/countryDetection';
import { Pill } from '../../../components/ui/Pill';
import { SelectField, type SelectOption } from '../../../components/ui/SelectField';
import { MOODS, SORT_OPTIONS, SHORT_RUNTIME_CEILING, HIGH_RATING_THRESHOLD } from '../filters';
import { cn } from '../../../utils/cn';
import type { MoodFilter, SourceFilter, SortOption } from '../filters';

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
  country: string;
  hasCountryOverride: boolean;
  onCountryChange: (code: string | null) => void;
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
  country,
  hasCountryOverride,
  onCountryChange,
}: FilterBarProps) {
  const sourceOptions: SelectOption[] = [
    { value: 'all', label: 'All films' },
    { value: 'both', label: 'Both' },
    { value: 'userA', label: `@${userA}` },
    { value: 'userB', label: `@${userB}` },
  ];
  const sortOptions: SelectOption[] = SORT_OPTIONS.map((option) => ({
    value: option.id,
    label: option.label,
  }));
  const countryOptions: SelectOption[] = [
    {
      value: '',
      label: `Auto detect (${country.toUpperCase()})`,
    },
    ...JUSTWATCH_COUNTRY_LIST.map((option) => ({
      value: option.code,
      label: option.name,
    })),
  ];

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-ink-800 bg-ink-950/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 xl:py-4">
      <div className="flex flex-wrap items-center gap-3 xl:gap-4">
        <div className="flex flex-wrap items-center gap-2 xl:gap-2.5">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-500 xl:text-[12px]">
            Mood
          </span>
          {MOODS.map((m) => (
            <FilterChip
              key={m.id}
              isActive={mood === m.id}
              onClick={() => onMoodChange(m.id)}
            >
              <span aria-hidden>{m.emoji}</span>
              {m.label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:gap-2.5 pl-0 sm:pl-1 xl:pl-3 sm:border-l sm:border-ink-800">
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-500 xl:text-[12px]">
            Quick filter
          </span>
          <FilterChip
            isActive={underOneHundred}
            tone="success"
            onClick={() => onUnderOneHundredChange(!underOneHundred)}
            ariaPressed={underOneHundred}
          >
            <span aria-hidden>⏱</span>
            Under {SHORT_RUNTIME_CEILING} min
          </FilterChip>
          <FilterChip
            isActive={highRatedOnly}
            tone="warning"
            onClick={() => onHighRatedOnlyChange(!highRatedOnly)}
            ariaPressed={highRatedOnly}
          >
            <span aria-hidden>★</span>
            {HIGH_RATING_THRESHOLD}+ LB
          </FilterChip>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2 xl:gap-2.5">
          <Pill tone="muted" className="uppercase tracking-wider text-ink-500">
            {count} shown
          </Pill>
          <SelectField
            aria-label="JustWatch country"
            value={hasCountryOverride ? country : ''}
            onChange={(event) => onCountryChange(event.target.value || null)}
            options={countryOptions}
            className="min-w-[10rem]"
          />
          <SelectField
            aria-label="Filter by source"
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
            options={sourceOptions}
          />
          <SelectField
            aria-label="Sort order"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortOption)}
            options={sortOptions}
          />
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  isActive,
  onClick,
  children,
  tone = 'accent',
  ariaPressed,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning';
  ariaPressed?: boolean;
}) {
  const activeClasses =
    tone === 'success'
      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
        : 'border-accent/60 bg-accent/15 text-accent-soft';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      className={cn(
        'focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors xl:px-3.5 xl:py-2 xl:text-[13px]',
        isActive
          ? activeClasses
          : 'border-ink-700 bg-ink-900/60 text-ink-300 hover:border-ink-500 hover:text-ink-100',
      )}
    >
      {children}
    </button>
  );
}
