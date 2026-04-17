import { motion, LayoutGroup } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { MiniSpinner } from '../../components/MiniSpinner';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import { StatusPanel } from '../../components/ui/StatusPanel';
import { FilterBar } from './components/FilterBar';
import { FilmRow } from './components/FilmRow';
import { EmptyState } from './components/EmptyState';
import { usePairResultsState } from './hooks/usePairResultsState';

export function PairResultsPage() {
  const {
    pairResult, streamingItems, isEnriching, pairCounts,
    userA, userB, setStep, reset,
  } = useSession();

  const items = pairResult ? pairResult.items : streamingItems;
  const counts = pairResult ? pairResult.counts : pairCounts;
  const {
    filters,
    filteredItems,
    country,
    hasCountryOverride,
    setMood,
    setSourceFilter,
    setUnderOneHundred,
    setHighRatedOnly,
    setSort,
    clearFilters,
    updateCountry,
  } = usePairResultsState(items);
  const enrichedCount = items.filter((item) => item.enriched).length;

  if (!counts && items.length === 0) {
    return (
      <StepShell>
        <Header onRestart={reset} />
        <main id="main" className="flex flex-1 items-center justify-center px-4">
          <StatusPanel
            align="center"
            title="No results loaded."
            description="Start a fresh pairing run to build a shortlist."
            actions={<Button onClick={() => setStep('landing')}>Back to start</Button>}
          />
        </main>
      </StepShell>
    );
  }

  const totalShown = filteredItems.length;

  return (
    <StepShell padded={false}>
      <Header onRestart={reset} />
      <main id="main" className="flex-1 px-4 pb-12 sm:px-6">
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
                      Loading details ({enrichedCount}/{items.length})…
                    </span>
                  )}
                </>
              ) : null}
            </p>
          </div>

          {items.length > 0 && (
            <FilterBar
              mood={filters.mood}
              onMoodChange={setMood}
              sourceFilter={filters.sourceFilter}
              onSourceFilterChange={setSourceFilter}
              underOneHundred={filters.underOneHundred}
              onUnderOneHundredChange={setUnderOneHundred}
              highRatedOnly={filters.highRatedOnly}
              onHighRatedOnlyChange={setHighRatedOnly}
              sort={filters.sort}
              onSortChange={setSort}
              count={totalShown}
              userA={userA}
              userB={userB}
              country={country}
              hasCountryOverride={hasCountryOverride}
              onCountryChange={updateCountry}
            />
          )}

          {filteredItems.length === 0 ? (
            <EmptyState
              hasAny={items.length > 0}
              onClear={clearFilters}
            />
          ) : (
            <>
              <LayoutGroup>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:gap-5 mt-6">
                  {filteredItems.map((item) => (
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
                      <FilmRow
                        item={item}
                        userA={userA}
                        userB={userB}
                        country={country}
                      />
                    </motion.li>
                  ))}
                </ul>
              </LayoutGroup>
              {isEnriching && (
                <div className="flex items-center justify-center gap-2 py-6 text-ink-400 text-sm">
                  <MiniSpinner />
                  Loading details… {enrichedCount} of {items.length}
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
