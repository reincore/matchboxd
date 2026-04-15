import {
  createContext,
  useEffect,
  useRef,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SavedSession, SessionStep } from '../types';
import type { PairWatchlistItem, PairWatchlistResult } from '../services/pairWatchlists';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SessionState {
  step: SessionStep;
  userA: string;
  userB: string;
  historicalSessions: SavedSession[];
  pairResult: PairWatchlistResult | null;
  /** Items streamed in during enrichment (stubs → enriched progressively). */
  streamingItems: PairWatchlistItem[];
  /** True while enrichment is still running. */
  isEnriching: boolean;
  /** Counts from the intersection phase, available before enrichment. */
  pairCounts: PairWatchlistResult['counts'] | null;
}

interface SessionContextValue extends SessionState {
  beginPairingRun: () => number;
  setStep: (s: SessionStep) => void;
  setUsernames: (a: string, b: string) => void;
  setPairResult: (r: PairWatchlistResult | null) => void;
  /** Set initial stubs from list-page metadata (titles + posters). */
  setStreamingStubs: (runId: number, stubs: PairWatchlistItem[], counts: PairWatchlistResult['counts']) => void;
  /** Replace a stub with its enriched version. */
  updateStreamingItem: (runId: number, item: PairWatchlistItem) => void;
  /** Mark enrichment as finished and consolidate into pairResult. */
  finalizeEnrichment: (runId: number, result: PairWatchlistResult) => void;
  saveSession: (session: SavedSession) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'matchboxd:session:v2';
const HISTORY_KEY = 'matchboxd:history:v1';

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
  const [history, setHistory] = useLocalStorage<SavedSession[]>(HISTORY_KEY, []);
  const [pairResult, setPairResult] = useState<PairWatchlistResult | null>(null);
  const [streamingItems, setStreamingItems] = useState<PairWatchlistItem[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [pairCounts, setPairCounts] = useState<PairWatchlistResult['counts'] | null>(null);
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

  const beginPairingRun = useCallback(() => {
    const runId = Date.now();
    pairingRunIdRef.current = runId;
    setPairResult(null);
    setStreamingItems([]);
    setPairCounts(null);
    setIsEnriching(false);
    return runId;
  }, []);

  const setStep = useCallback(
    (s: SessionStep) => setPersisted((p) => ({ ...p, step: s })),
    [setPersisted],
  );
  const setUsernames = useCallback(
    (a: string, b: string) => setPersisted((p) => ({ ...p, userA: a, userB: b })),
    [setPersisted],
  );

  const setStreamingStubs = useCallback(
    (runId: number, stubs: PairWatchlistItem[], counts: PairWatchlistResult['counts']) => {
      if (runId !== pairingRunIdRef.current) return;
      setStreamingItems(stubs);
      setPairCounts(counts);
      setIsEnriching(true);
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

  const updateStreamingItem = useCallback(
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

  const finalizeEnrichment = useCallback(
    (runId: number, result: PairWatchlistResult) => {
      if (runId !== pairingRunIdRef.current) return;
      // Flush any pending batched items before finalizing
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = undefined;
      }
      pendingItemsRef.current = [];
      setPairResult(result);
      setIsEnriching(false);
      // Keep streamingItems in sync with final result
      setStreamingItems(result.items);
      setPairCounts(result.counts);
    },
    [],
  );

  const saveSession = useCallback(
    (session: SavedSession) => {
      setHistory((h) => [session, ...h].slice(0, 20));
    },
    [setHistory],
  );

  const reset = useCallback(() => {
    clearPersisted();
    setPersisted({ ...defaultPersisted });
    setPairResult(null);
    setStreamingItems([]);
    setIsEnriching(false);
    setPairCounts(null);
    pairingRunIdRef.current = 0;
  }, [clearPersisted, setPersisted]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...persisted,
      pairResult,
      streamingItems,
      isEnriching,
      pairCounts,
      historicalSessions: history,
      beginPairingRun,
      setStep,
      setUsernames,
      setPairResult,
      setStreamingStubs,
      updateStreamingItem,
      finalizeEnrichment,
      saveSession,
      reset,
    }),
    [
      persisted,
      pairResult,
      streamingItems,
      isEnriching,
      pairCounts,
      history,
      beginPairingRun,
      setStep,
      setUsernames,
      setStreamingStubs,
      updateStreamingItem,
      finalizeEnrichment,
      saveSession,
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
