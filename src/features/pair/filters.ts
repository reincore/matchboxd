import type { PairWatchlistItem } from '../../services/pairWatchlists';

export type MoodFilter =
  | 'all'
  | 'horror'
  | 'romcom'
  | 'drama'
  | 'comedy'
  | 'thriller'
  | 'scifi'
  | 'animation'
  | 'recent';
export type SourceFilter = 'all' | 'both' | 'userA' | 'userB';
export type SortOption = 'rating' | 'year-desc' | 'runtime-asc' | 'title';

export const MOODS: { id: MoodFilter; label: string; emoji: string }[] = [
  { id: 'all', label: 'Everything', emoji: '✨' },
  { id: 'horror', label: 'Horror', emoji: '🩸' },
  { id: 'romcom', label: 'Rom-Com', emoji: '💌' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'comedy', label: 'Comedy', emoji: '😄' },
  { id: 'thriller', label: 'Thriller', emoji: '🔪' },
  { id: 'scifi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'animation', label: 'Animation', emoji: '🎨' },
  { id: 'recent', label: 'Recent', emoji: '🗓️' },
];

export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'rating', label: 'Top rated' },
  { id: 'year-desc', label: 'Newest' },
  { id: 'runtime-asc', label: 'Shortest' },
  { id: 'title', label: 'A–Z' },
];

const CURRENT_YEAR = new Date().getFullYear();
export const RECENT_THRESHOLD = CURRENT_YEAR - 5;
export const SHORT_RUNTIME_CEILING = 100;
export const HIGH_RATING_THRESHOLD = 4.0;

export function hasGenre(item: PairWatchlistItem, pattern: RegExp) {
  return item.genres.some((g) => pattern.test(g));
}

export function sortItems(items: PairWatchlistItem[], sort: SortOption): PairWatchlistItem[] {
  const copy = [...items];
  switch (sort) {
    case 'rating':
      copy.sort(
        (a, b) => (b.lbRating ?? -1) - (a.lbRating ?? -1) ||
          (b.lbRatingCount ?? 0) - (a.lbRatingCount ?? 0),
      );
      break;
    case 'year-desc':
      copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      break;
    case 'runtime-asc':
      copy.sort((a, b) => (a.runtime ?? 9999) - (b.runtime ?? 9999));
      break;
    case 'title':
      copy.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }
  return copy;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
