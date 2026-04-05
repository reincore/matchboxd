import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '../../app/SessionContext';
import { Header } from '../../components/Header';
import { StepShell } from '../../components/StepShell';
import { ProgressBar } from '../../components/ProgressBar';
import { Button } from '../../components/Button';
import type { MovieCandidate, SwipeState } from '../../types';
import { MovieCard } from './MovieCard';

export function SwipePage() {
  const { candidates, swipe, setStep, userA, userB } = useSession();

  // Two-phase: userA swipes the whole deck, then userB swipes the whole deck.
  const [turn, setTurn] = useState<'userA' | 'userB'>(() =>
    candidates.some((c) => c.userAState !== 'pending') &&
    candidates.every((c) => c.userAState !== 'pending')
      ? 'userB'
      : 'userA',
  );

  const remaining = useMemo(
    () =>
      candidates.filter((c) =>
        turn === 'userA' ? c.userAState === 'pending' : c.userBState === 'pending',
      ),
    [candidates, turn],
  );

  const total = candidates.length;
  const done = total - remaining.length;
  const topCandidate = remaining[0];

  // When userA finishes their pass, hand off to userB.
  useEffect(() => {
    if (turn === 'userA' && remaining.length === 0 && total > 0) {
      setTurn('userB');
    } else if (turn === 'userB' && remaining.length === 0 && total > 0) {
      setStep('results');
    }
  }, [turn, remaining.length, total, setStep]);

  const decide = (state: SwipeState) => {
    if (!topCandidate) return;
    swipe(topCandidate.id, turn, state);
  };

  if (!total) {
    return (
      <StepShell>
        <Header onRestart={() => setStep('landing')} step="swipe" />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-ink-400">No candidates to swipe on.</div>
            <Button className="mt-4" onClick={() => setStep('filters')}>
              Change filters
            </Button>
          </div>
        </main>
      </StepShell>
    );
  }

  const whoLabel = turn === 'userA' ? userA : userB;
  const otherLabel = turn === 'userA' ? userB : userA;

  return (
    <StepShell padded={false}>
      <Header onRestart={() => setStep('landing')} step={`${whoLabel}'s turn`} />
      <main className="flex-1 flex flex-col px-4 sm:px-6 pb-6 max-w-md w-full mx-auto">
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-sm">
              <span className="text-ink-400">Swiping:</span>{' '}
              <span className="font-semibold">@{whoLabel}</span>
              <span className="text-ink-500"> · next up @{otherLabel}</span>
            </div>
            <div className="text-xs text-ink-400">
              {done} / {total}
            </div>
          </div>
          <ProgressBar value={total ? done / total : 0} />
        </div>

        <div className="relative flex-1 min-h-[480px]">
          <AnimatePresence>
            {remaining
              .slice(0, 3)
              .reverse()
              .map((c, idx, arr) => {
                const isTop = idx === arr.length - 1;
                const behind = arr.length - 1 - idx;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ scale: 0.95, opacity: 0, y: 12 }}
                    animate={{
                      scale: 1 - behind * 0.04,
                      opacity: 1,
                      y: behind * -8,
                    }}
                    exit={{
                      x: decideExitDirection(c),
                      opacity: 0,
                      transition: { duration: 0.3 },
                    }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0"
                    style={{ zIndex: idx }}
                  >
                    <MovieCard
                      candidate={c}
                      onDecide={decide}
                      topOfStack={isTop}
                    />
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4">
          <ActionButton label="Nope" tone="no" onClick={() => decide('no')} />
          <ActionButton label="Super" tone="super" onClick={() => decide('super')} />
          <ActionButton label="Yes" tone="yes" onClick={() => decide('yes')} />
        </div>

        <div className="text-center text-[11px] text-ink-500 mt-3">
          swipe ← nope · swipe → yes · tap super for a strong yes
        </div>
      </main>
    </StepShell>
  );
}

function ActionButton({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: 'yes' | 'no' | 'super';
}) {
  const toneClass =
    tone === 'yes'
      ? 'border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10'
      : tone === 'no'
        ? 'border-red-400/40 text-red-300 hover:bg-red-400/10'
        : 'border-accent/50 text-accent-soft hover:bg-accent/10';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl border-2 font-semibold transition-colors focus-ring ${toneClass}`}
    >
      {label}
    </button>
  );
}

function decideExitDirection(c: MovieCandidate): number {
  // Use current state to direct the exit animation — fallback to random-ish.
  const anyYes = c.userAState === 'yes' || c.userBState === 'yes' || c.userAState === 'super' || c.userBState === 'super';
  const anyNo = c.userAState === 'no' || c.userBState === 'no';
  if (anyYes) return 520;
  if (anyNo) return -520;
  return 0;
}
