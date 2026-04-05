import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Poster } from '../../components/Poster';
import { buildResults, pickTiebreaker } from '../../services/resultBuilder';
import type { MovieCandidate, ResultBundle } from '../../types';
import { confidenceLabel } from '../../utils/confidence';
import { cn } from '../../utils/cn';

export function ResultsPage() {
  const {
    candidates,
    userA,
    userB,
    filters,
    setStep,
    reset,
    saveSession,
    resetSwipes,
  } = useSession();

  const bundle: ResultBundle = useMemo(() => buildResults(candidates), [candidates]);
  const [featuredId, setFeaturedId] = useState<string | undefined>(
    bundle.bestMutualFit?.id,
  );
  const [duel, setDuel] = useState<boolean>(false);

  // Save the session once on mount for the history trail.
  useEffect(() => {
    if (!bundle.bestMutualFit) return;
    saveSession({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      userA,
      userB,
      filters,
      pickTitle: bundle.bestMutualFit.title,
      pickYear: bundle.bestMutualFit.year,
      pickCategory: bundle.bestMutualFit.recommendationCategory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMutuals = bundle.allMutuals.length > 0;
  const featured = candidates.find((c) => c.id === featuredId) ?? bundle.bestMutualFit;

  const runDuel = () => {
    if (bundle.allMutuals.length < 2) return;
    const [a, b] = bundle.allMutuals.slice(0, 2);
    const winner = pickTiebreaker(a, b);
    setFeaturedId(winner.id);
    setDuel(true);
    setTimeout(() => setDuel(false), 1400);
  };

  return (
    <StepShell>
      <Header onRestart={reset} step="result" />
      <main className="flex-1 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto w-full py-4 sm:py-6">
          {!hasMutuals ? (
            <EmptyState onBack={() => setStep('swipe')} onReset={() => resetSwipes()} />
          ) : (
            <>
              <div className="mb-5">
                <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">
                  tonight's pick
                </div>
                <h1 className="font-display text-3xl sm:text-4xl leading-tight">
                  You both said yes to {bundle.allMutuals.length} film
                  {bundle.allMutuals.length === 1 ? '' : 's'}.
                </h1>
              </div>

              {featured && (
                <FeaturedCard
                  candidate={featured}
                  userA={userA}
                  userB={userB}
                  duel={duel}
                />
              )}

              <div className="mt-8 space-y-6">
                <CategoryRail
                  title="Best mutual fit"
                  subtitle="highest score among your mutual yeses"
                  items={bundle.bestMutualFit ? [bundle.bestMutualFit] : []}
                  onSelect={setFeaturedId}
                  featuredId={featuredId}
                />
                <CategoryRail
                  title="Safest pick"
                  subtitle="hard to regret, easy to agree on"
                  items={bundle.safestPick ? [bundle.safestPick] : []}
                  onSelect={setFeaturedId}
                  featuredId={featuredId}
                />
                <CategoryRail
                  title="Adventure pick"
                  subtitle="a bit weirder, but still plausible"
                  items={bundle.adventurePick ? [bundle.adventurePick] : []}
                  onSelect={setFeaturedId}
                  featuredId={featuredId}
                />
                <CategoryRail
                  title={`One in @${userA}'s zone`}
                  subtitle="closer to your side of the taste map"
                  items={bundle.inYourZone ? [bundle.inYourZone] : []}
                  onSelect={setFeaturedId}
                  featuredId={featuredId}
                />
                <CategoryRail
                  title={`One in @${userB}'s zone`}
                  subtitle="closer to their side"
                  items={bundle.inTheirZone ? [bundle.inTheirZone] : []}
                  onSelect={setFeaturedId}
                  featuredId={featuredId}
                />
                {bundle.trueOverlap && (
                  <CategoryRail
                    title="True overlap"
                    subtitle="on both your watchlists / both already love it"
                    items={[bundle.trueOverlap]}
                    onSelect={setFeaturedId}
                    featuredId={featuredId}
                  />
                )}
                <CategoryRail
                  title="All mutuals"
                  subtitle="you both said yes"
                  items={bundle.allMutuals}
                  onSelect={setFeaturedId}
                  featuredId={featuredId}
                />
              </div>

              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep('filters')}>
                    Change filters
                  </Button>
                  <Button variant="secondary" onClick={() => { resetSwipes(); setStep('swipe'); }}>
                    Redo swipes
                  </Button>
                </div>
                <div className="flex gap-2">
                  {bundle.allMutuals.length >= 2 && (
                    <Button variant="secondary" onClick={runDuel}>
                      Final duel
                    </Button>
                  )}
                  <Button onClick={reset}>Start fresh</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </StepShell>
  );
}

function FeaturedCard({
  candidate,
  userA,
  userB,
  duel,
}: {
  candidate: MovieCandidate;
  userA: string;
  userB: string;
  duel: boolean;
}) {
  return (
    <motion.div
      layout
      animate={duel ? { scale: [1, 1.02, 1] } : undefined}
      transition={{ duration: 0.5 }}
      className="surface-card overflow-hidden"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
        <div className="p-4 sm:p-5 sm:pr-0">
          <Poster
            src={candidate.posterUrl}
            title={candidate.title}
            rounded="xl"
          />
        </div>
        <div className="p-4 sm:p-5 sm:pl-5">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <Badge tone="accent">tonight's pick</Badge>
            <Badge tone="neutral">{confidenceLabel(candidate.confidence)}</Badge>
            <Badge tone={candidate.recommendationKind === 'deterministic' ? 'success' : 'neutral'}>
              {candidate.recommendationKind === 'deterministic' ? 'deterministic' : 'inferred'}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <h2 className="font-display text-2xl sm:text-3xl leading-tight">
              {candidate.title}
            </h2>
            {candidate.year && (
              <span className="text-ink-300">({candidate.year})</span>
            )}
          </div>
          <div className="text-xs text-ink-400 mb-3 space-x-2">
            {candidate.directors.length > 0 && (
              <span>{candidate.directors.slice(0, 2).join(', ')}</span>
            )}
            {candidate.runtime && (
              <>
                <span className="text-ink-700">·</span>
                <span>{candidate.runtime}m</span>
              </>
            )}
            {candidate.genres.length > 0 && (
              <>
                <span className="text-ink-700">·</span>
                <span>{candidate.genres.slice(0, 3).join(', ')}</span>
              </>
            )}
          </div>
          {candidate.synopsis && (
            <p className="text-sm text-ink-200 leading-relaxed mb-3">
              {candidate.synopsis}
            </p>
          )}
          <div className="text-xs text-ink-400 mb-1 uppercase tracking-wider">
            why this works for @{userA} × @{userB}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {candidate.explanationReasons.map((r, i) => (
              <Badge key={i} tone="accent">{r}</Badge>
            ))}
          </div>
          {candidate.providersTR && candidate.providersTR.length > 0 ? (
            <div>
              <div className="text-xs text-ink-400 mb-1 uppercase tracking-wider">
                watch in Turkey
              </div>
              <div className="text-sm text-ink-200">
                {candidate.providersTR
                  .slice(0, 6)
                  .map((p) => p.providerName)
                  .join(' · ')}
              </div>
            </div>
          ) : (
            <div className="text-xs text-ink-500">
              Streaming availability for Turkey not available.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CategoryRail({
  title,
  subtitle,
  items,
  onSelect,
  featuredId,
}: {
  title: string;
  subtitle: string;
  items: MovieCandidate[];
  onSelect: (id: string) => void;
  featuredId?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-display text-lg">{title}</h3>
        <div className="text-[11px] text-ink-500">{subtitle}</div>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              'flex-shrink-0 w-28 sm:w-32 text-left focus-ring rounded-lg transition-transform',
              featuredId === c.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink-950' : 'hover:-translate-y-0.5',
            )}
          >
            <Poster src={c.posterUrl} title={c.title} rounded="lg" />
            <div className="mt-2 text-xs font-semibold line-clamp-2 text-ink-100">
              {c.title}
            </div>
            <div className="text-[10px] text-ink-400">
              {c.year} · {Math.round(c.finalScore * 100)}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ onBack, onReset }: { onBack: () => void; onReset: () => void }) {
  return (
    <div className="surface-card p-6 text-center">
      <div className="font-display text-xl mb-1">No mutual yeses yet.</div>
      <div className="text-sm text-ink-400 mb-4">
        You didn't overlap on anything. Loosen filters, try a different vibe,
        or redo the swipes.
      </div>
      <div className="flex gap-2 justify-center">
        <Button variant="secondary" onClick={onBack}>
          Back to swipes
        </Button>
        <Button onClick={onReset}>Reset swipes</Button>
      </div>
    </div>
  );
}
