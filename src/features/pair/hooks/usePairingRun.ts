import { useEffect, useState } from 'react';
import { useSession } from '../../../app/SessionContext';
import {
  PairWatchlistError,
  pairWatchlists,
  type PairWatchlistProgress,
} from '../../../services/pairWatchlists';

const INITIAL_PROGRESS: PairWatchlistProgress = {
  stage: 'watchlists',
  message: 'Getting started…',
};

export function usePairingRun() {
  const {
    userA,
    userB,
    setStep,
    startPairingRun,
    applyPairingStubs,
    applyPairingItem,
    completePairingRun,
  } = useSession();
  const [progress, setProgress] = useState<PairWatchlistProgress>(INITIAL_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const runId = startPairingRun();
    let isMounted = true;

    setError(null);
    setProgress(INITIAL_PROGRESS);

    void pairWatchlists(userA, userB, {
      onProgress: (nextProgress) => {
        if (isMounted) {
          setProgress(nextProgress);
        }
      },
      onStubs: (stubs, counts) => {
        const applied = applyPairingStubs(runId, stubs, counts);
        if (applied) {
          setStep('pair-results');
        }
      },
      onItem: (item) => {
        applyPairingItem(runId, item);
      },
    })
      .then((result) => {
        completePairingRun(runId, result);
      })
      .catch((reason) => {
        if (!isMounted) return;
        setError(
          reason instanceof PairWatchlistError
            ? reason.message
            : 'Something went wrong while reading your watchlists.',
        );
      });

    return () => {
      isMounted = false;
    };
  }, [
    attempt,
    applyPairingItem,
    applyPairingStubs,
    completePairingRun,
    setStep,
    startPairingRun,
    userA,
    userB,
  ]);

  return {
    progress,
    error,
    retry: () => {
      setError(null);
      setProgress({ stage: 'watchlists', message: 'Retrying…' });
      setAttempt((current) => current + 1);
    },
  };
}
