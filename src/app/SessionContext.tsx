import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SessionStep } from '../types';
import type {
  PairWatchlistCounts,
  PairWatchlistItem,
  PairWatchlistResult,
} from '../services/pairWatchlists';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SessionState {
  step: SessionStep;
  userA: string;
  userB: string;
  pairResult: PairWatchlistResult | null;
  streamingItems: PairWatchlistItem[];
  isEnriching: boolean;
  pairCounts: PairWatchlistCounts | null;
}

interface SessionContextValue extends SessionState {
  setStep: (step: SessionStep) => void;
  setUsernames: (userA: string, userB: string) => void;
  startPairingRun: () => number;
  applyPairingStubs: (
    runId: number,
    stubs: PairWatchlistItem[],
    counts: PairWatchlistCounts,
  ) => boolean;
  applyPairingItem: (runId: number, item: PairWatchlistItem) => void;
  completePairingRun: (runId: number, result: PairWatchlistResult) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'matchboxd:session:v2';

interface PersistedSession {
  userA: string;
  userB: string;
  step: SessionStep;
}

const defaultPersisted: PersistedSession = {
  userA: '',
  userB: '',
  step: 'landing',
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [persisted, setPersisted, clearPersisted] = useLocalStorage<PersistedSession>(
    STORAGE_KEY,
    defaultPersisted,
  );
  const [pairResult, setPairResult] = useState<PairWatchlistResult | null>(null);
  const [streamingItems, setStreamingItems] = useState<PairWatchlistItem[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [pairCounts, setPairCounts] = useState<PairWatchlistCounts | null>(null);
  const pairingRunIdRef = useRef(0);
  const hydratedRef = useRef(false);
  const pendingItemsRef = useRef<PairWatchlistItem[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Pair loading/results depend on in-memory data that is not restored after
    // a hard refresh, so reopen the app on the landing step on initial load.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
    } else {
      return;
    }

    if (persisted.step === 'pair-loading' || persisted.step === 'pair-results') {
      setPersisted((p) => ({ ...p, step: 'landing' }));
    }
  }, [persisted.step, setPersisted]);

  const clearPairingState = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = undefined;
    }
    pendingItemsRef.current = [];
    setPairResult(null);
    setStreamingItems([]);
    setPairCounts(null);
    setIsEnriching(false);
  }, []);

  const setStep = useCallback(
    (s: SessionStep) => setPersisted((p) => ({ ...p, step: s })),
    [setPersisted],
  );
  const setUsernames = useCallback(
    (a: string, b: string) => setPersisted((p) => ({ ...p, userA: a, userB: b })),
    [setPersisted],
  );

  const startPairingRun = useCallback(() => {
    const runId = Date.now();
    pairingRunIdRef.current = runId;
    clearPairingState();
    return runId;
  }, [clearPairingState]);

  const applyPairingStubs = useCallback(
    (runId: number, stubs: PairWatchlistItem[], counts: PairWatchlistCounts) => {
      if (runId !== pairingRunIdRef.current) return false;
      setStreamingItems(stubs);
      setPairCounts(counts);
      setIsEnriching(true);
      return true;
    },
    [],
  );

  const flushPendingItems = useCallback(() => {
    const batch = pendingItemsRef.current;
    if (batch.length === 0) return;
    pendingItemsRef.current = [];
    setStreamingItems((prev) => {
      const next = [...prev];
      for (const item of batch) {
        const idx = next.findIndex((s) => s.slug === item.slug);
        if (idx === -1) next.push(item);
        else next[idx] = item;
      }
      return next;
    });
  }, []);

  const applyPairingItem = useCallback(
    (runId: number, item: PairWatchlistItem) => {
      if (runId !== pairingRunIdRef.current) return;
      pendingItemsRef.current.push(item);
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = undefined;
          flushPendingItems();
        }, 500);
      }
    },
    [flushPendingItems],
  );

  const completePairingRun = useCallback(
    (runId: number, result: PairWatchlistResult) => {
      if (runId !== pairingRunIdRef.current) return;
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = undefined;
      }
      pendingItemsRef.current = [];
      setPairResult(result);
      setIsEnriching(false);
      setStreamingItems(result.items);
      setPairCounts(result.counts);
    },
    [],
  );

  const reset = useCallback(() => {
    clearPersisted();
    setPersisted({ ...defaultPersisted });
    clearPairingState();
    pairingRunIdRef.current = 0;
  }, [clearPairingState, clearPersisted, setPersisted]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...persisted,
      pairResult,
      streamingItems,
      isEnriching,
      pairCounts,
      setStep,
      setUsernames,
      startPairingRun,
      applyPairingStubs,
      applyPairingItem,
      completePairingRun,
      reset,
    }),
    [
      persisted,
      pairResult,
      streamingItems,
      isEnriching,
      pairCounts,
      setStep,
      setUsernames,
      startPairingRun,
      applyPairingStubs,
      applyPairingItem,
      completePairingRun,
      reset,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
