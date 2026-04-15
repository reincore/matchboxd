// Core domain types for Matchboxd.

export type SessionStep = 'landing' | 'pair-loading' | 'pair-results';

export interface SavedSession {
  id: string;
  createdAt: string;
  userA: string;
  userB: string;
  pickTitle?: string;
  pickYear?: number;
}
