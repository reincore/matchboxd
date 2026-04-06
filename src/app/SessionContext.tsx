import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AnalysisResult,
  FilterSelection,
  MovieCandidate,
  SavedSession,
  SessionStep,
  SwipeState,
} from '../types';
import type { PairWatchlistItem, PairWatchlistResult } from '../services/pairWatchlists';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SessionState {
  step: SessionStep;
  userA: string;
  userB: string;
  filters: FilterSelection;
  analysis: AnalysisResult | null;
  candidates: MovieCandidate[];
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
  setStep: (s: SessionStep) => void;
  setUsernames: (a: string, b: string) => void;
  setFilters: (f: FilterSelection) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setCandidates: (c: MovieCandidate[]) => void;
  setPairResult: (r: PairWatchlistResult | null) => void;
  /** Set initial stubs from list-page metadata (titles + posters). */
  setStreamingStubs: (stubs: PairWatchlistItem[], counts: PairWatchlistResult['counts']) => void;
  /** Replace a stub with its enriched version. */
  updateStreamingItem: (item: PairWatchlistItem) => void;
  /** Mark enrichment as finished and consolidate into pairResult. */
  finalizeEnrichment: (result: PairWatchlistResult) => void;
  swipe: (candidateId: string, who: 'userA' | 'userB', state: SwipeState) => void;
  resetSwipes: () => void;
  saveSession: (session: SavedSession) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'matchboxd:session:v2';
const HISTORY_KEY = 'matchboxd:history:v1';

const defaultFilters: FilterSelection = { mood: null, constraints: [] };

interface PersistedSession {
  userA: string;
  userB: string;
  filters: FilterSelection;
  candidates: MovieCandidate[];
  step: SessionStep;
}

const defaultPersisted: PersistedSession = {
  userA: '',
  userB: '',
  filters: defaultFilters,
  candidates: [],
  step: 'landing',
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [persisted, setPersisted, clearPersisted] = useLocalStorage<PersistedSession>(
    STORAGE_KEY,
    defaultPersisted,
  );
  const [history, setHistory] = useLocalStorage<SavedSession[]>(HISTORY_KEY, []);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [pairResult, setPairResult] = useState<PairWatchlistResult | null>(null);
  const [streamingItems, setStreamingItems] = useState<PairWatchlistItem[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [pairCounts, setPairCounts] = useState<PairWatchlistResult['counts'] | null>(null);

  const setStep = useCallback(
    (s: SessionStep) => setPersisted((p) => ({ ...p, step: s })),
    [setPersisted],
  );
  const setUsernames = useCallback(
    (a: string, b: string) => setPersisted((p) => ({ ...p, userA: a, userB: b })),
    [setPersisted],
  );
  const setFilters = useCallback(
    (f: FilterSelection) => setPersisted((p) => ({ ...p, filters: f })),
    [setPersisted],
  );
  const setCandidates = useCallback(
    (c: MovieCandidate[]) => setPersisted((p) => ({ ...p, candidates: c })),
    [setPersisted],
  );

  const setStreamingStubs = useCallback(
    (stubs: PairWatchlistItem[], counts: PairWatchlistResult['counts']) => {
      setStreamingItems(stubs);
      setPairCounts(counts);
      setIsEnriching(true);
    },
    [],
  );

  const updateStreamingItem = useCallback(
    (item: PairWatchlistItem) => {
      setStreamingItems((prev) => {
        const idx = prev.findIndex((s) => s.slug === item.slug);
        if (idx === -1) return [...prev, item];
        const next = [...prev];
        next[idx] = item;
        return next;
      });
    },
    [],
  );

  const finalizeEnrichment = useCallback(
    (result: PairWatchlistResult) => {
      setPairResult(result);
      setIsEnriching(false);
      // Keep streamingItems in sync with final result
      setStreamingItems(result.items);
      setPairCounts(result.counts);
    },
    [],
  );

  const swipe = useCallback(
    (candidateId: string, who: 'userA' | 'userB', state: SwipeState) => {
      setPersisted((p) => ({
        ...p,
        candidates: p.candidates.map((c) =>
          c.id === candidateId
            ? { ...c, [who === 'userA' ? 'userAState' : 'userBState']: state }
            : c,
        ),
      }));
    },
    [setPersisted],
  );
  const resetSwipes = useCallback(() => {
    setPersisted((p) => ({
      ...p,
      candidates: p.candidates.map((c) => ({
        ...c,
        userAState: 'pending',
        userBState: 'pending',
      })),
    }));
  }, [setPersisted]);

  const saveSession = useCallback(
    (session: SavedSession) => {
      setHistory((h) => [session, ...h].slice(0, 20));
    },
    [setHistory],
  );

  const reset = useCallback(() => {
    clearPersisted();
    setPersisted({ ...defaultPersisted });
    setAnalysis(null);
    setPairResult(null);
    setStreamingItems([]);
    setIsEnriching(false);
    setPairCounts(null);
  }, [clearPersisted, setPersisted]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...persisted,
      analysis,
      pairResult,
      streamingItems,
      isEnriching,
      pairCounts,
      historicalSessions: history,
      setStep,
      setUsernames,
      setFilters,
      setAnalysis,
      setCandidates,
      setPairResult,
      setStreamingStubs,
      updateStreamingItem,
      finalizeEnrichment,
      swipe,
      resetSwipes,
      saveSession,
      reset,
    }),
    [
      persisted,
      analysis,
      pairResult,
      streamingItems,
      isEnriching,
      pairCounts,
      history,
      setStep,
      setUsernames,
      setFilters,
      setCandidates,
      setStreamingStubs,
      updateStreamingItem,
      finalizeEnrichment,
      swipe,
      resetSwipes,
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
