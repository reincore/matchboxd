import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import {
  pairWatchlists,
  PairWatchlistError,
  type PairWatchlistProgress,
} from '../../services/pairWatchlists';

export function PairLoadingPage() {
  const { userA, userB, setStep, setPairResult } = useSession();
  const [progress, setProgress] = useState<PairWatchlistProgress>({
    stage: 'watchlists',
    message: 'Getting started…',
  });
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await pairWatchlists(userA, userB, {
          onProgress: (p) => {
            if (!cancelled) setProgress(p);
          },
        });
        if (cancelled) return;
        setPairResult(result);
        setStep('pair-results');
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof PairWatchlistError
            ? err.message
            : 'Something went wrong while reading your watchlists.';
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const pct =
    progress.stage === 'details' && progress.detailsTotal
      ? Math.round((100 * (progress.detailsLoaded ?? 0)) / progress.detailsTotal)
      : stageToPercent(progress.stage);

  return (
    <StepShell>
      <Header onRestart={() => setStep('landing')} step="matching" />
      <main className="flex-1 flex items-center px-4 sm:px-6">
        <div className="max-w-lg mx-auto w-full py-8">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">
              pairing
            </div>
            <h1 className="font-display text-3xl sm:text-4xl leading-tight">
              @{userA} <span className="text-ink-500">×</span> @{userB}
            </h1>
          </div>

          {error ? (
            <ErrorView
              message={error}
              onRetry={() => {
                setError(null);
                setProgress({ stage: 'watchlists', message: 'Retrying…' });
                setAttempt((n) => n + 1);
              }}
              onBack={() => setStep('landing')}
            />
          ) : (
            <div className="surface-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <Spinner />
                <div className="flex-1">
                  <div className="text-ink-100 text-sm">{progress.message}</div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-500 mt-0.5">
                    {stageLabel(progress.stage)}
                  </div>
                </div>
              </div>

              <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>

              <div className="text-[11px] text-ink-500 mt-3 leading-relaxed">
                Scraping Letterboxd through a public CORS proxy. This takes a
                minute the first time — watchlists can run 20+ pages each.
              </div>
            </div>
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
    case 'watched':
      return 'filtering watched';
    case 'intersection':
      return 'finding overlap';
    case 'details':
      return 'loading posters';
    case 'done':
      return 'done';
  }
}

function stageToPercent(stage: PairWatchlistProgress['stage']): number {
  switch (stage) {
    case 'watchlists':
      return 25;
    case 'intersection':
      return 45;
    case 'watched':
      return 55;
    case 'details':
      return 75;
    case 'done':
      return 100;
  }
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
        stroke="#ff7a59"
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
    <div className="surface-card p-5">
      <div className="text-sm text-red-400 mb-1 font-medium">
        We couldn't finish matching.
      </div>
      <div className="text-sm text-ink-300 mb-4">{message}</div>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" onClick={onBack}>
          Change usernames
        </Button>
        <Button size="md" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
