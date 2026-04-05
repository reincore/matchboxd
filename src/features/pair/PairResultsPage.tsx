import { useMemo, useState } from 'react';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { Poster } from '../../components/Poster';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import type { PairWatchlistItem } from '../../services/pairWatchlists';
import { cn } from '../../utils/cn';

type MoodFilter = 'all' | 'horror' | 'romcom' | 'recent';
type SortOption = 'rating' | 'year-desc' | 'runtime-asc' | 'title';

const MOODS: { id: MoodFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'Everything', emoji: '✨' },
  { id: 'horror', label: 'Horror', emoji: '🩸' },
  { id: 'romcom', label: 'Rom-Com', emoji: '💌' },
  { id: 'recent', label: 'Recent', emoji: '🆕' },
];

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'rating', label: 'Top rated' },
  { id: 'year-desc', label: 'Newest' },
  { id: 'runtime-asc', label: 'Shortest' },
  { id: 'title', label: 'A–Z' },
];

const CURRENT_YEAR = new Date().getFullYear();
const RECENT_THRESHOLD = CURRENT_YEAR - 5; // films from the last 5 years

export function PairResultsPage() {
  const { pairResult, userA, userB, setStep, reset } = useSession();
  const [mood, setMood] = useState<MoodFilter>('all');
  const [underOneHundred, setUnderOneHundred] = useState(false);
  const [sort, setSort] = useState<SortOption>('rating');

  const filtered = useMemo(() => {
    if (!pairResult) return [];
    const items = pairResult.items.filter((item) => {
      if (underOneHundred && (item.runtime ?? Infinity) > 100) return false;
      if (mood === 'horror') {
        return item.genres.some((g) => /horror/i.test(g));
      }
      if (mood === 'romcom') {
        // Must match at least one of (Romance, Comedy). Ideally both, but
        // pure-genre rom-coms are rare on Letterboxd's genre vocabulary.
        const hasRomance = item.genres.some((g) => /romance/i.test(g));
        const hasComedy = item.genres.some((g) => /comedy/i.test(g));
        return hasRomance || hasComedy;
      }
      if (mood === 'recent') {
        return (item.year ?? 0) >= RECENT_THRESHOLD;
      }
      return true;
    });
    return sortItems(items, sort);
  }, [pairResult, mood, underOneHundred, sort]);

  if (!pairResult) {
    // Fallback for the unlikely case where we landed here without data.
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
      <Header onRestart={reset} step="shortlist" />
      <main className="flex-1 px-4 sm:px-6 pb-12">
        <div className="max-w-5xl mx-auto w-full">
          <div className="mb-6 pt-2">
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">
              both watchlists
            </div>
            <h1 className="font-display text-3xl sm:text-4xl leading-tight mb-2">
              @{userA} <span className="text-ink-500">×</span> @{userB}
            </h1>
            <p className="text-ink-300 text-sm leading-relaxed">
              {pairResult.counts.overlap === 0 ? (
                <>
                  No films in common yet. Try adding more to either watchlist
                  and come back.
                </>
              ) : (
                <>
                  <span className="text-ink-100 font-medium">
                    {pairResult.counts.filtered}
                  </span>{' '}
                  shared film{pairResult.counts.filtered === 1 ? '' : 's'}{' '}
                  neither of you has watched — from{' '}
                  <span className="text-ink-200">
                    {pairResult.counts.watchlistA}
                  </span>{' '}
                  &{' '}
                  <span className="text-ink-200">
                    {pairResult.counts.watchlistB}
                  </span>{' '}
                  watchlist entries.
                </>
              )}
            </p>
          </div>

          {pairResult.items.length > 0 && (
            <FilterBar
              mood={mood}
              onMoodChange={setMood}
              underOneHundred={underOneHundred}
              onUnderOneHundredChange={setUnderOneHundred}
              sort={sort}
              onSortChange={setSort}
              count={totalShown}
            />
          )}

          {filtered.length === 0 ? (
            <EmptyState
              hasAny={pairResult.items.length > 0}
              onClear={() => {
                setMood('all');
                setUnderOneHundred(false);
              }}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {filtered.map((item) => (
                <FilmRow key={item.slug} item={item} />
              ))}
            </ul>
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
  underOneHundred: boolean;
  onUnderOneHundredChange: (v: boolean) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  count: number;
}

function FilterBar({
  mood,
  onMoodChange,
  underOneHundred,
  onUnderOneHundredChange,
  sort,
  onSortChange,
  count,
}: FilterBarProps) {
  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-ink-950/85 backdrop-blur-md border-b border-ink-800">
      <div className="flex flex-wrap items-center gap-2">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMoodChange(m.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors focus-ring',
              mood === m.id
                ? 'bg-accent/15 border-accent/60 text-accent-soft'
                : 'bg-ink-900/60 border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500',
            )}
          >
            <span aria-hidden>{m.emoji}</span>
            {m.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onUnderOneHundredChange(!underOneHundred)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors focus-ring',
            underOneHundred
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
              : 'bg-ink-900/60 border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500',
          )}
          aria-pressed={underOneHundred}
        >
          <span aria-hidden>⏱</span>
          Under 100 min
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-ink-500">
            {count} shown
          </span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="bg-ink-900/60 border border-ink-700 rounded-lg text-[12px] px-2 py-1.5 text-ink-200 focus-ring hover:border-ink-500 transition-colors"
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

function FilmRow({ item }: { item: PairWatchlistItem }) {
  return (
    <li className="surface-card overflow-hidden flex gap-3 p-3">
      <a
        href={item.letterboxdUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-24 sm:w-28 shrink-0 focus-ring rounded-xl"
      >
        <Poster src={item.posterUrl} title={item.title} rounded="lg" />
      </a>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="min-w-0">
          <a
            href={item.letterboxdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-lg leading-tight hover:text-accent transition-colors line-clamp-2"
          >
            {item.title}
            {item.year && (
              <span className="text-ink-400 font-sans font-normal text-sm ml-1.5">
                {item.year}
              </span>
            )}
          </a>
          {item.directors.length > 0 && (
            <div className="text-[12px] text-ink-400 mt-0.5 line-clamp-1">
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
        </div>

        <div className="mt-auto pt-2 flex flex-wrap gap-2 items-center">
          <a
            href={item.justwatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-accent-soft hover:text-accent transition-colors inline-flex items-center gap-1 focus-ring rounded"
          >
            Where to watch (TR)
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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/30 text-[11px] font-medium text-accent-soft">
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
        'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px]',
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
    <div className="surface-card p-8 text-center mt-8">
      <div className="font-display text-xl mb-2">
        {hasAny ? 'Nothing matches those filters.' : 'No overlap yet.'}
      </div>
      <div className="text-ink-400 text-sm max-w-md mx-auto">
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
