import { useCallback, useMemo, useState } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { MiniSpinner } from '../../components/MiniSpinner';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import {
  getDetectedCountry,
  setCountryOverride,
} from '../../services/countryDetection';
import type { MoodFilter, SourceFilter, SortOption } from './filters';
import {
  hasGenre,
  sortItems,
  RECENT_THRESHOLD,
  SHORT_RUNTIME_CEILING,
  HIGH_RATING_THRESHOLD,
} from './filters';
import { FilterBar } from './components/FilterBar';
import { FilmRow } from './components/FilmRow';
import { EmptyState } from './components/EmptyState';

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
  const [jwCountry, setJwCountry] = useState(getDetectedCountry);
  const handleCountryChange = useCallback((code: string | null) => {
    setCountryOverride(code);
    setJwCountry(getDetectedCountry());
  }, []);

  // Use streaming items while enriching; final pairResult items when done.
  const items = pairResult ? pairResult.items : streamingItems;
  const counts = pairResult ? pairResult.counts : pairCounts;

  const filtered = useMemo(() => {
    const pool = items.filter((item) => {
      if (underOneHundred && (item.runtime ?? Infinity) > SHORT_RUNTIME_CEILING) return false;
      if (highRatedOnly && (item.lbRating ?? 0) < HIGH_RATING_THRESHOLD) return false;
      if (sourceFilter === 'both' && item.source !== 'both') return false;
      if (sourceFilter === 'userA' && item.source === 'userB') return false;
      if (sourceFilter === 'userB' && item.source === 'userA') return false;
      if (mood !== 'all' && mood !== 'recent' && !item.enriched && item.genres.length === 0) {
        // Stubs haven't loaded genres yet — keep them visible during enrichment
        // so the grid doesn't flash empty while details stream in.
        return true;
      }
      switch (mood) {
        case 'horror':
          return hasGenre(item, /horror/i);
        case 'romcom':
          return hasGenre(item, /romance/i) && hasGenre(item, /comedy/i);
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
              <LayoutGroup>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-5 mt-6">
                  {filtered.map((item) => (
                    <motion.li
                      key={item.slug}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        layout: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] },
                        opacity: { duration: 0.25 },
                        y: { duration: 0.25 },
                      }}
                    >
                      <FilmRow item={item} userA={userA} userB={userB} jwCountry={jwCountry} onCountryChange={handleCountryChange} />
                    </motion.li>
                  ))}
                </ul>
              </LayoutGroup>
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
