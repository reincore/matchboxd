// Core domain types for Matchboxd.

export type SwipeState = 'pending' | 'yes' | 'no' | 'super';

export type Mood = 'easy' | 'intense' | 'emotional' | 'weird' | 'cozy';

export type Constraint =
  | 'short-runtime'
  | 'long-runtime'
  | 'classic'
  | 'modern'
  | 'no-horror'
  | 'no-animation'
  | 'no-subtitles'
  | 'available-tr';

export interface MoodOption {
  id: Mood;
  label: string;
  description: string;
  emoji: string;
}

export interface ConstraintOption {
  id: Constraint;
  label: string;
  hint?: string;
}

export type RecommendationCategory =
  | 'watchlist-overlap'
  | 'taste-match'
  | 'rewatch'
  | 'stretch-pick';

export type RecommendationKind = 'deterministic' | 'inferred';

export type ConfidenceLevel = 'high' | 'moderate' | 'exploratory';

/** A public Letterboxd activity item, normalized. */
export interface LetterboxdEntry {
  kind: 'watched' | 'watchlist' | 'liked' | 'reviewed';
  title: string;
  year?: number;
  rating?: number; // 0.5..5 in half-star increments
  letterboxdSlug?: string;
  watchedAt?: string; // ISO date
  rewatch?: boolean;
}

/** A user's aggregated taste profile, derived from their public feed. */
export interface TasteProfile {
  username: string;
  fetched: boolean;
  entryCount: number;
  ratedCount: number;
  averageRating: number; // 0 if no ratings
  genreAffinity: Record<string, number>; // genreName -> score 0..1
  decadeAffinity: Record<string, number>; // "1990" -> score 0..1
  directorAffinity: Record<string, number>; // director -> score
  watchlistSlugs: Set<string>;
  seenSlugs: Set<string>;
  highRatedSlugs: Set<string>; // rated >= 3.5
  topTitles: string[];
  confidence: ConfidenceLevel;
}

/** Normalized internal movie model for candidates. */
export interface MovieCandidate {
  id: string;
  tmdbId?: number;
  letterboxdSlug?: string;
  title: string;
  year?: number;
  posterUrl?: string;
  backdropUrl?: string;
  synopsis?: string;
  genres: string[];
  runtime?: number; // minutes
  directors: string[];
  providersTR?: WatchProvider[];
  userAState: SwipeState;
  userBState: SwipeState;
  recommendationCategory: RecommendationCategory;
  recommendationKind: RecommendationKind;
  confidence: ConfidenceLevel;
  explanationReasons: string[];
  moodFit: number; // 0..1
  availabilityFit: number; // 0..1, 0 if hard filter excludes
  finalScore: number; // 0..1
  ownership?: 'userA' | 'userB' | 'shared';
}

export interface WatchProvider {
  providerId: number;
  providerName: string;
  logoPath?: string;
  type: 'flatrate' | 'rent' | 'buy' | 'free' | 'ads';
}

export interface FilterSelection {
  mood: Mood | null;
  constraints: Constraint[];
}

export type SessionStep =
  | 'landing'
  | 'analysis'
  | 'filters'
  | 'swipe'
  | 'results'
  | 'pair-loading'
  | 'pair-results';

export interface SavedSession {
  id: string;
  createdAt: string;
  userA: string;
  userB: string;
  filters: FilterSelection;
  pickTitle?: string;
  pickYear?: number;
  pickCategory?: string;
}

export interface AnalysisResult {
  profileA: TasteProfile;
  profileB: TasteProfile;
  overallConfidence: ConfidenceLevel;
  sparseData: boolean;
  notes: string[];
}

export interface ResultBundle {
  bestMutualFit?: MovieCandidate;
  safestPick?: MovieCandidate;
  adventurePick?: MovieCandidate;
  inYourZone?: MovieCandidate;
  inTheirZone?: MovieCandidate;
  trueOverlap?: MovieCandidate;
  allMutuals: MovieCandidate[];
}
