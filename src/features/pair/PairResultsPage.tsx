import { useMemo, useState } from 'react';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { Poster } from '../../components/Poster';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import type { PairWatchlistItem, ItemSource } from '../../services/pairWatchlists';
import { cn } from '../../utils/cn';

type MoodFilter =
  | 'all'
  | 'horror'
  | 'romcom'
  | 'drama'
  | 'comedy'
  | 'thriller'
  | 'scifi'
  | 'animation'
  | 'recent';
type SourceFilter = 'all' | 'both' | 'userA' | 'userB';
type SortOption = 'rating' | 'year-desc' | 'runtime-asc' | 'title';

const MOODS: { id: MoodFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'Everything', emoji: '✨' },
  { id: 'horror', label: 'Horror', emoji: '🩸' },
  { id: 'romcom', label: 'Rom-Com', emoji: '💌' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'comedy', label: 'Comedy', emoji: '😄' },
  { id: 'thriller', label: 'Thriller', emoji: '🔪' },
  { id: 'scifi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'animation', label: 'Animation', emoji: '🎨' },
  { id: 'recent', label: 'Recent', emoji: '🗓️' },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'rating', label: 'Top rated' },
  { id: 'year-desc', label: 'Newest' },
  { id: 'runtime-asc', label: 'Shortest' },
  { id: 'title', label: 'A–Z' },
];

const CURRENT_YEAR = new Date().getFullYear();
const RECENT_THRESHOLD = CURRENT_YEAR - 5;

function hasGenre(item: PairWatchlistItem, pattern: RegExp) {
  return item.genres.some((g) => pattern.test(g));
}

export function PairResultsPage() {
  const {
    pairResult, streamingItems, isEnriching, pairCounts,
    userA, userB, setStep, reset,
  } = useSession();
  const [mood, setMood] = useState<MoodFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [underOneHundred, setUnderOneHundred] = useState(false);
  const [highRatedOnly, setHighRatedOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>('rating');

  // Use streaming items while enriching; final pairResult items when done.
  const items = pairResult ? pairResult.items : streamingItems;
  const counts = pairResult ? pairResult.counts : pairCounts;

  const filtered = useMemo(() => {
    const pool = items.filter((item) => {
      if (underOneHundred && (item.runtime ?? Infinity) > 100) return false;
      if (highRatedOnly && (item.lbRating ?? 0) < 4) return false;
      if (sourceFilter === 'both' && item.source !== 'both') return false;
      if (sourceFilter === 'userA' && item.source !== 'userA') return false;
      if (sourceFilter === 'userB' && item.source !== 'userB') return false;
      switch (mood) {
        case 'horror':
          return hasGenre(item, /horror/i);
        case 'romcom':
          return hasGenre(item, /romance/i) || hasGenre(item, /comedy/i);
        case 'drama':
          return hasGenre(item, /drama/i);
        case 'comedy':
          return hasGenre(item, /comedy/i);
        case 'thriller':
          return hasGenre(item, /thriller/i);
        case 'scifi':
          return hasGenre(item, /science fiction|sci-?fi/i);
        case 'animation':
          return hasGenre(item, /animation/i);
        case 'recent':
          return (item.year ?? 0) >= RECENT_THRESHOLD;
        default:
          return true;
      }
    });
    return sortItems(pool, sort);
  }, [items, mood, sourceFilter, underOneHundred, highRatedOnly, sort]);

  if (!counts && items.length === 0) {
    return (
      <StepShell>
        <Header onRestart={reset} />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-ink-300 mb-4">No results loaded.</div>
            <Button onClick={() => setStep('landing')}>Back to start</Button>
          </div>
        </main>
      </StepShell>
    );
  }

  const totalShown = filtered.length;

  return (
    <StepShell padded={false}>
      <Header onRestart={reset} />
      <main className="flex-1 px-4 sm:px-6 pb-12">
        <div className="max-w-5xl xl:max-w-6xl mx-auto w-full">
          <div className="mb-6 pt-2">
            <div className="text-xs xl:text-[13px] uppercase tracking-[0.22em] text-ink-400 mb-2">
              shortlist
            </div>
            <h1 className="font-display text-3xl sm:text-4xl xl:text-5xl leading-tight mb-2">
              @{userA} <span className="text-ink-500">×</span> @{userB}
            </h1>
            <p className="text-ink-300 text-sm xl:text-base leading-relaxed">
              {counts ? (
                <>
                  <span className="text-ink-100 font-medium">
                    {counts.overlap}
                  </span>{' '}
                  shared film{counts.overlap === 1 ? '' : 's'}
                  {' '}from{' '}
                  <span className="text-ink-200">
                    {counts.watchlistA}
                  </span>{' '}
                  &{' '}
                  <span className="text-ink-200">
                    {counts.watchlistB}
                  </span>{' '}
                  watchlist entries.
                  {isEnriching && (
                    <span className="text-accent-soft ml-1">
                      Loading details…
                    </span>
                  )}
                </>
              ) : null}
            </p>
          </div>

          {items.length > 0 && (
            <FilterBar
              mood={mood}
              onMoodChange={setMood}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              underOneHundred={underOneHundred}
              onUnderOneHundredChange={setUnderOneHundred}
              highRatedOnly={highRatedOnly}
              onHighRatedOnlyChange={setHighRatedOnly}
              sort={sort}
              onSortChange={setSort}
              count={totalShown}
              userA={userA}
              userB={userB}
            />
          )}

          {filtered.length === 0 ? (
            <EmptyState
              hasAny={items.length > 0}
              onClear={() => {
                setMood('all');
                setSourceFilter('all');
                setUnderOneHundred(false);
                setHighRatedOnly(false);
              }}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-5 mt-6">
                {filtered.map((item) => (
                  <FilmRow key={item.slug} item={item} userA={userA} userB={userB} />
                ))}
              </ul>
              {isEnriching && (
                <div className="flex items-center justify-center gap-2 py-6 text-ink-400 text-sm">
                  <MiniSpinner />
                  Loading more details…
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </StepShell>
  );
}

function sortItems(items: PairWatchlistItem[], sort: SortOption): PairWatchlistItem[] {
  const copy = [...items];
  switch (sort) {
    case 'rating':
      copy.sort(
        (a, b) => (b.lbRating ?? -1) - (a.lbRating ?? -1) ||
          (b.lbRatingCount ?? 0) - (a.lbRatingCount ?? 0),
      );
      break;
    case 'year-desc':
      copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case 'runtime-asc':
      copy.sort((a, b) => (a.runtime ?? 9999) - (b.runtime ?? 9999));
      break;
    case 'title':
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return copy;
}

interface FilterBarProps {
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

function FilterBar({
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
            Under 100 min
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
            4.0+ LB
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 xl:gap-2.5">
          <span className="text-[11px] xl:text-[12px] uppercase tracking-wider text-ink-500">
            {count} shown
          </span>
          <select
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

function SourceBadge({ source, userA, userB }: { source: ItemSource; userA: string; userB: string }) {
  if (source === 'both') return null;
  const label = source === 'userA' ? `@${userA}` : `@${userB}`;
  const tone =
    source === 'userA'
      ? 'border-accent/30 bg-accent/10 text-accent-soft'
      : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 xl:px-2.5 xl:py-1 text-[10px] xl:text-[11px] font-medium',
      tone,
    )}>
      {label} only
    </span>
  );
}

function FilmRow({ item, userA, userB }: { item: PairWatchlistItem; userA: string; userB: string }) {
  return (
    <li className={cn(
      'surface-card overflow-hidden flex gap-3 xl:gap-4 p-3 xl:p-4 transition-opacity',
      !item.enriched && 'opacity-80',
    )}>
      <a
        href={item.letterboxdUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-24 sm:w-28 xl:w-32 shrink-0 focus-ring rounded-xl"
      >
        <Poster src={item.posterUrl} title={item.title} rounded="lg" />
      </a>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="min-w-0">
          <a
            href={item.letterboxdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-lg xl:text-xl leading-tight hover:text-accent transition-colors line-clamp-2"
          >
            {item.title}
            {item.year && (
              <span className="text-ink-400 font-sans font-normal text-sm xl:text-base ml-1.5">
                {item.year}
              </span>
            )}
          </a>
          {item.directors.length > 0 && (
            <div className="text-[12px] xl:text-[13px] text-ink-400 mt-0.5 line-clamp-1">
              dir. {item.directors.slice(0, 2).join(', ')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {typeof item.lbRating === 'number' && (
            <RatingPill
              rating={item.lbRating}
              count={item.lbRatingCount}
            />
          )}
          {typeof item.runtime === 'number' && (
            <MetaPill>{item.runtime} min</MetaPill>
          )}
          {item.genres.slice(0, 2).map((g) => (
            <MetaPill key={g} muted>
              {g}
            </MetaPill>
          ))}
          <SourceBadge source={item.source} userA={userA} userB={userB} />
        </div>

        <div className="mt-auto pt-2 flex flex-wrap gap-2 items-center">
          <a
            href={item.justwatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] xl:text-[13px] font-medium text-accent-soft hover:text-accent transition-colors inline-flex items-center gap-1 focus-ring rounded"
          >
            Search JustWatch (TR)
            <ArrowIcon />
          </a>
        </div>
      </div>
    </li>
  );
}

function RatingPill({ rating, count }: { rating: number; count?: number }) {
  const stars = rating.toFixed(2);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-md bg-accent/10 border border-accent/30 text-[11px] xl:text-[12px] font-medium text-accent-soft">
      <span aria-hidden>★</span>
      {stars}
      {count && count > 0 && (
        <span className="text-ink-400 font-normal ml-0.5">
          · {formatCount(count)}
        </span>
      )}
    </span>
  );
}

function MetaPill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-md border text-[11px] xl:text-[12px]',
        muted
          ? 'border-ink-700 bg-ink-900/40 text-ink-400'
          : 'border-ink-700 bg-ink-900/60 text-ink-200',
      )}
    >
      {children}
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17L17 7M10 7h7v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="animate-spin shrink-0"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function EmptyState({
  hasAny,
  onClear,
}: {
  hasAny: boolean;
  onClear: () => void;
}) {
  return (
    <div className="surface-card p-8 xl:p-10 text-center mt-8">
      <div className="font-display text-xl xl:text-2xl mb-2">
        {hasAny ? 'Nothing matches those filters.' : 'No overlap yet.'}
      </div>
      <div className="text-ink-400 text-sm xl:text-base max-w-md xl:max-w-lg mx-auto">
        {hasAny
          ? 'Loosen the filters to see more of your shared watchlist.'
          : "You don't currently have any films on both watchlists that you haven't already watched."}
      </div>
      {hasAny && (
        <Button
          variant="secondary"
          size="md"
          className="mt-5"
          onClick={onClear}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
