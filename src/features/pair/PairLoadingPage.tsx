import { motion } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { StatusPanel } from '../../components/ui/StatusPanel';
import type { PairWatchlistProgress } from '../../services/pairWatchlists';
import { usePairingRun } from './hooks/usePairingRun';

export function PairLoadingPage() {
  const { userA, userB, setStep } = useSession();
  const { progress, error, retry } = usePairingRun();

  const pct = computeProgress(progress);

  return (
    <StepShell>
      <Header onRestart={() => setStep('landing')} />
      <main id="main" className="flex flex-1 items-center px-4 sm:px-6">
        <div className="max-w-lg xl:max-w-xl mx-auto w-full py-8">
          <div className="mb-8">
            <div className="text-xs xl:text-[13px] uppercase tracking-wider text-ink-400 mb-2">
              pairing
            </div>
            <h1 className="font-display text-3xl sm:text-4xl xl:text-5xl leading-tight">
              @{userA} <span className="text-ink-500">×</span> @{userB}
            </h1>
          </div>

          {error ? (
            <ErrorView
              message={error}
              onRetry={retry}
              onBack={() => setStep('landing')}
            />
          ) : (
            <>
              <MatchboxdLoader />
              <SurfaceCard>
                <div className="mb-4 flex items-center gap-3">
                  <Spinner />
                  <div className="flex-1">
                    <div className="text-sm text-ink-100 xl:text-base">{progress.message}</div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink-500 xl:text-[12px]">
                      {stageLabel(progress.stage)}
                    </div>
                  </div>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <motion.div
                    className="h-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                </div>

                <div className="mt-3 text-[11px] leading-relaxed text-ink-500 xl:text-[12px]">
                  Scraping Letterboxd through a controlled proxy path. Large public
                  watchlists can still take a minute on the first run.
                </div>
              </SurfaceCard>
            </>
          )}
        </div>
      </main>
      <Footer />
    </StepShell>
  );
}

function stageLabel(stage: PairWatchlistProgress['stage']): string {
  switch (stage) {
    case 'watchlists':
      return 'reading watchlists';
    case 'intersection':
      return 'finding overlap';
    case 'details':
      return 'loading posters';
    case 'done':
      return 'done';
  }
}

function computeProgress(p: PairWatchlistProgress): number {
  // The loading page unmounts as soon as stubs are ready (before the
  // "details" enrichment phase), so the watchlist stage is the only
  // network-bound phase the user actually sees here.
  switch (p.stage) {
    case 'watchlists': {
      if (!p.pageTotal || !p.pageLoaded) return 0;
      return Math.round(95 * (p.pageLoaded / p.pageTotal));
    }
    case 'intersection':
      return 97;
    case 'details':
    case 'done':
      return 100;
  }
}

function MatchboxdLoader() {
  return (
    <div className="flex justify-center mb-5" aria-hidden>
      <div className="flex items-center justify-center w-24 h-14 rounded-xl border border-accent/30 shadow-matchbox-glow">
        <div className="relative flex items-center justify-center w-full h-full overflow-hidden rounded-xl">
          <div className="absolute w-8 h-8 rounded-full bg-accent mix-blend-screen animate-match-left" />
          <div className="absolute w-8 h-8 rounded-full bg-accent mix-blend-screen animate-match-right" />
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="animate-spin shrink-0"
    >
      <circle cx="12" cy="12" r="9" stroke="#262b3c" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="#ec4899"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ErrorView({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <StatusPanel
      title="We couldn&apos;t finish matching."
      description={message}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onBack}>
            Change usernames
          </Button>
          <Button size="md" onClick={onRetry}>
            Try again
          </Button>
        </>
      }
    />
  );
}
