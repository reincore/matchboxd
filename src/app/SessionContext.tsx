import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  AnalysisResult,
  FilterSelection,
  MovieCandidate,
  SavedSession,
  SessionStep,
  SwipeState,
} from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface SessionState {
  step: SessionStep;
  userA: string;
  userB: string;
  filters: FilterSelection;
  analysis: AnalysisResult | null;
  candidates: MovieCandidate[];
  historicalSessions: SavedSession[];
}

interface SessionContextValue extends SessionState {
  setStep: (s: SessionStep) => void;
  setUsernames: (a: string, b: string) => void;
  setFilters: (f: FilterSelection) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setCandidates: (c: MovieCandidate[]) => void;
  swipe: (candidateId: string, who: 'userA' | 'userB', state: SwipeState) => void;
  resetSwipes: () => void;
  saveSession: (session: SavedSession) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'matchboxd:session:v1';
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

  // Set state derived from persistence
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
    setAnalysis(null);
  }, [clearPersisted]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...persisted,
      analysis,
      historicalSessions: history,
      setStep,
      setUsernames,
      setFilters,
      setAnalysis,
      setCandidates,
      swipe,
      resetSwipes,
      saveSession,
      reset,
    }),
    [
      persisted,
      analysis,
      history,
      setStep,
      setUsernames,
      setFilters,
      setCandidates,
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
