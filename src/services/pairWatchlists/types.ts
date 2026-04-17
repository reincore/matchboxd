export type ItemSource = 'both' | 'userA' | 'userB';

export interface PairWatchlistItem {
  slug: string;
  title: string;
  year?: number;
  posterUrl?: string;
  synopsis?: string;
  runtime?: number;
  genres: string[];
  directors: string[];
  lbRating?: number;
  lbRatingCount?: number;
  letterboxdUrl: string;
  source: ItemSource;
  enriched: boolean;
}

export interface PairWatchlistCounts {
  watchlistA: number;
  watchlistB: number;
  overlap: number;
  filtered: number;
  enriched: number;
}

export interface PairWatchlistProgress {
  stage: 'watchlists' | 'intersection' | 'details' | 'done';
  message: string;
  detailsLoaded?: number;
  detailsTotal?: number;
  pageLoaded?: number;
  pageTotal?: number;
}

export interface PairWatchlistResult {
  items: PairWatchlistItem[];
  counts: PairWatchlistCounts;
  userA: string;
  userB: string;
}

export interface PairWatchlistsOptions {
  onProgress?: (progress: PairWatchlistProgress) => void;
  onItem?: (item: PairWatchlistItem) => void;
  onStubs?: (stubs: PairWatchlistItem[], counts: PairWatchlistCounts) => void;
  maxWatchlistPages?: number;
  detailConcurrency?: number;
  maxOverlap?: number;
  maxNearMisses?: number;
}

export interface PairWatchlistCandidate {
  slug: string;
  source: ItemSource;
}

export class PairWatchlistError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'PairWatchlistError';
  }
}
