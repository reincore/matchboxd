import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Footer } from '../../components/Footer';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';
import { Button } from '../../components/Button';
import { fetchUserActivity, fetchUserWatchlist, LetterboxdFetchError } from '../../services/letterboxd';
import { buildTasteProfile, emptyProfile } from '../../services/tasteProfile';
import { combineConfidence } from '../../utils/confidence';
import type { AnalysisResult, LetterboxdEntry } from '../../types';

type Stage = 'fetching' | 'reading' | 'building' | 'done' | 'error';

interface StageInfo {
  id: Stage;
  label: string;
  detail: string;
}

const STAGES: StageInfo[] = [
  { id: 'fetching', label: 'Fetching profiles', detail: 'saying hi to Letterboxd' },
  { id: 'reading', label: 'Reading public activity', detail: 'ratings, rewatches, reviews' },
  { id: 'building', label: 'Building taste profiles', detail: 'genres, decades, directors' },
];

export function AnalysisPage() {
  const { userA, userB, setStep, setAnalysis } = useSession();
  const [stage, setStage] = useState<Stage>('fetching');
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void run();
    async function run() {
      try {
        setStage('fetching');
        await tick(400);

        const [activityA, activityB, watchlistA, watchlistB] = await Promise.all([
          safeFetch(() => fetchUserActivity(userA)),
          safeFetch(() => fetchUserActivity(userB)),
          safeFetchList(() => fetchUserWatchlist(userA)),
          safeFetchList(() => fetchUserWatchlist(userB)),
        ]);

        setStage('reading');
        await tick(500);

        const entriesA: LetterboxdEntry[] = [...activityA.entries, ...watchlistA];
        const entriesB: LetterboxdEntry[] = [...activityB.entries, ...watchlistB];

        setStage('building');
        await tick(300);

        const [profileA, profileB] = await Promise.all([
          entriesA.length > 0 ? buildTasteProfile(userA, entriesA) : Promise.resolve(emptyProfile(userA)),
          entriesB.length > 0 ? buildTasteProfile(userB, entriesB) : Promise.resolve(emptyProfile(userB)),
        ]);

        const sparseData =
          profileA.entryCount < 8 || profileB.entryCount < 8;

        const notes: string[] = [];
        if (activityA.failed)
          notes.push(`Couldn't reach ${userA}'s public feed — using limited signals.`);
        if (activityB.failed)
          notes.push(`Couldn't reach ${userB}'s public feed — using limited signals.`);
        if (sparseData)
          notes.push('Limited public data, leaning on mood filters and broader consensus.');

        const result: AnalysisResult = {
          profileA,
          profileB,
          overallConfidence: combineConfidence(profileA.confidence, profileB.confidence),
          sparseData,
          notes,
        };

        setAnalysis(result);
        setStage('done');
        await tick(300);
        setStep('filters');
      } catch (err) {
        const message = err instanceof LetterboxdFetchError ? err.message : 'Something went wrong while reading public activity.';
        setError(message);
        setStage('error');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StepShell>
      <Header onRestart={() => setStep('landing')} step="analysis" />
      <main className="flex-1 flex items-center px-4 sm:px-6">
        <div className="max-w-lg mx-auto w-full py-8">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-ink-400 mb-2">
              matching
            </div>
            <h1 className="font-display text-3xl sm:text-4xl leading-tight">
              @{userA}{' '}
              <span className="text-ink-500">×</span>{' '}
              @{userB}
            </h1>
          </div>

          {error ? (
            <ErrorView
              message={error}
              onRetry={() => {
                ran.current = false;
                setError(null);
                setStep('analysis');
              }}
              onBack={() => setStep('landing')}
            />
          ) : (
            <ol className="space-y-3">
              {STAGES.map((s, i) => {
                const currentIndex = STAGES.findIndex((x) => x.id === stage);
                const status: 'pending' | 'active' | 'done' =
                  stage === 'done' || i < currentIndex
                    ? 'done'
                    : i === currentIndex
                      ? 'active'
                      : 'pending';
                return <StageRow key={s.id} info={s} status={status} />;
              })}
            </ol>
          )}
        </div>
      </main>
      <Footer />
    </StepShell>
  );
}

function StageRow({ info, status }: { info: StageInfo; status: 'pending' | 'active' | 'done' }) {
  return (
    <li className="flex items-start gap-3 surface-card p-4">
      <div className="mt-0.5">
        {status === 'done' && <CheckIcon />}
        {status === 'active' && <Spinner />}
        {status === 'pending' && <Dot />}
      </div>
      <div className="flex-1">
        <div className={status === 'pending' ? 'text-ink-400' : 'text-ink-100'}>
          {info.label}
        </div>
        <div className="text-xs text-ink-500 mt-0.5">{info.detail}</div>
      </div>
      {status === 'active' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] uppercase tracking-wider text-accent"
        >
          working
        </motion.div>
      )}
    </li>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#4ade80" fillOpacity="0.15" stroke="#4ade80" strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="#262b3c" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#ff7a59" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Dot() {
  return <div className="w-[18px] h-[18px] rounded-full border-2 border-ink-700 bg-ink-900" />;
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
        We couldn't finish the analysis.
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

async function safeFetch(
  fn: () => Promise<LetterboxdEntry[]>,
): Promise<{ entries: LetterboxdEntry[]; failed: boolean }> {
  try {
    const entries = await fn();
    return { entries, failed: false };
  } catch {
    return { entries: [], failed: true };
  }
}

async function safeFetchList(fn: () => Promise<LetterboxdEntry[]>): Promise<LetterboxdEntry[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

function tick(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
