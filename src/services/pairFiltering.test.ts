import { describe, expect, it } from 'vitest';
import type { PairWatchlistItem } from './pairWatchlists';

// Replicate the filtering and sorting logic from PairResultsPage so it's
// testable without a DOM.  These functions mirror the component exactly.

type MoodFilter =
  | 'all'
  | 'horror'
  | 'romcom'
  | 'drama'
  | 'comedy'
  | 'thriller'
  | 'scifi'
  | 'animation'
  | 'recent';
type SortOption = 'rating' | 'year-desc' | 'runtime-asc' | 'title';

const CURRENT_YEAR = new Date().getFullYear();
const RECENT_THRESHOLD = CURRENT_YEAR - 5;

function hasGenre(item: PairWatchlistItem, pattern: RegExp) {
  return item.genres.some((g) => pattern.test(g));
}

function filterItems(
  items: PairWatchlistItem[],
  opts: {
    mood: MoodFilter;
    underOneHundred?: boolean;
    highRatedOnly?: boolean;
    sourceFilter?: 'all' | 'both' | 'userA' | 'userB';
  },
): PairWatchlistItem[] {
  const { mood, underOneHundred, highRatedOnly, sourceFilter = 'all' } = opts;
  return items.filter((item) => {
    if (underOneHundred && (item.runtime ?? Infinity) > 100) return false;
    if (highRatedOnly && (item.lbRating ?? 0) < 4) return false;
    if (sourceFilter === 'both' && item.source !== 'both') return false;
    if (sourceFilter === 'userA' && item.source === 'userB') return false;
    if (sourceFilter === 'userB' && item.source === 'userA') return false;
    // Unenriched stubs with no genres should pass through during enrichment
    if (mood !== 'all' && mood !== 'recent' && !item.enriched && item.genres.length === 0) {
      return true;
    }
    switch (mood) {
      case 'horror':
        return hasGenre(item, /horror/i);
      case 'romcom':
        return hasGenre(item, /romance/i) && hasGenre(item, /comedy/i);
      case 'drama':
        return hasGenre(item, /drama/i);
      case 'comedy':
        return hasGenre(item, /comedy/i);
      case 'thriller':
        return hasGenre(item, /thriller/i);
      case 'scifi':
        return hasGenre(item, /science fiction|sci-?fi/i);
      case 'animation':
        return hasGenre(item, /animation/i);
      case 'recent':
        return (item.year ?? 0) >= RECENT_THRESHOLD;
      default:
        return true;
    }
  });
}

function sortItems(items: PairWatchlistItem[], sort: SortOption): PairWatchlistItem[] {
  const copy = [...items];
  switch (sort) {
    case 'rating':
      copy.sort(
        (a, b) =>
          (b.lbRating ?? -1) - (a.lbRating ?? -1) ||
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

function makeItem(overrides: Partial<PairWatchlistItem> = {}): PairWatchlistItem {
  return {
    slug: 'test-film',
    title: 'Test Film',
    genres: [],
    directors: [],
    letterboxdUrl: 'https://letterboxd.com/film/test-film/',
    justwatchUrl: 'https://www.justwatch.com/tr/arama?q=Test%20Film',
    source: 'both',
    enriched: true,
    ...overrides,
  };
}

describe('genre filtering', () => {
  it('romcom requires BOTH romance AND comedy genres', () => {
    const romcom = makeItem({ genres: ['Romance', 'Comedy'] });
    const pureComedy = makeItem({ slug: 'comedy', genres: ['Comedy'] });
    const pureRomance = makeItem({ slug: 'romance', genres: ['Romance'] });

    const result = filterItems([romcom, pureComedy, pureRomance], { mood: 'romcom' });
    expect(result.map((i) => i.slug)).toEqual(['test-film']);
  });

  it('horror filter matches case-insensitively', () => {
    const item = makeItem({ genres: ['horror'] });
    expect(filterItems([item], { mood: 'horror' })).toHaveLength(1);
  });

  it('scifi matches "Science Fiction" and "Sci-Fi"', () => {
    const sf = makeItem({ slug: 'sf', genres: ['Science Fiction'] });
    const scifi = makeItem({ slug: 'scifi', genres: ['Sci-Fi'] });
    const action = makeItem({ slug: 'action', genres: ['Action'] });

    const result = filterItems([sf, scifi, action], { mood: 'scifi' });
    expect(result.map((i) => i.slug)).toEqual(['sf', 'scifi']);
  });

  it('recent filter uses CURRENT_YEAR - 5 threshold', () => {
    const recent = makeItem({ slug: 'new', year: CURRENT_YEAR });
    const old = makeItem({ slug: 'old', year: 2000 });
    const boundary = makeItem({ slug: 'boundary', year: RECENT_THRESHOLD });

    const result = filterItems([recent, old, boundary], { mood: 'recent' });
    expect(result.map((i) => i.slug)).toEqual(['new', 'boundary']);
  });

  it('"all" mood returns everything', () => {
    const items = [
      makeItem({ slug: 'a', genres: ['Horror'] }),
      makeItem({ slug: 'b', genres: ['Comedy'] }),
    ];
    expect(filterItems(items, { mood: 'all' })).toHaveLength(2);
  });
});

describe('unenriched stub passthrough', () => {
  it('keeps unenriched stubs visible when a genre mood filter is active', () => {
    const stub = makeItem({ slug: 'stub', enriched: false, genres: [] });
    const enriched = makeItem({ slug: 'horror', enriched: true, genres: ['Horror'] });

    const result = filterItems([stub, enriched], { mood: 'horror' });
    expect(result.map((i) => i.slug)).toEqual(['stub', 'horror']);
  });

  it('does NOT keep enriched items with empty genres', () => {
    const enrichedEmpty = makeItem({ slug: 'empty', enriched: true, genres: [] });
    const result = filterItems([enrichedEmpty], { mood: 'horror' });
    expect(result).toHaveLength(0);
  });

  it('applies "recent" filter normally to stubs (year is available on stubs)', () => {
    const oldStub = makeItem({ slug: 'old', enriched: false, genres: [], year: 2000 });
    const result = filterItems([oldStub], { mood: 'recent' });
    expect(result).toHaveLength(0);
  });
});

describe('quick filters', () => {
  it('underOneHundred excludes films over 100 min', () => {
    const short = makeItem({ slug: 'short', runtime: 90 });
    const long = makeItem({ slug: 'long', runtime: 120 });
    const noRuntime = makeItem({ slug: 'no-runtime' });

    const result = filterItems([short, long, noRuntime], { mood: 'all', underOneHundred: true });
    expect(result.map((i) => i.slug)).toEqual(['short']);
  });

  it('highRatedOnly excludes films under 4.0', () => {
    const high = makeItem({ slug: 'high', lbRating: 4.2 });
    const low = makeItem({ slug: 'low', lbRating: 3.5 });
    const noRating = makeItem({ slug: 'none' });

    const result = filterItems([high, low, noRating], { mood: 'all', highRatedOnly: true });
    expect(result.map((i) => i.slug)).toEqual(['high']);
  });
});

describe('source filter', () => {
  it('filters by source correctly', () => {
    const both = makeItem({ slug: 'both', source: 'both' });
    const a = makeItem({ slug: 'a', source: 'userA' });
    const b = makeItem({ slug: 'b', source: 'userB' });

    expect(filterItems([both, a, b], { mood: 'all', sourceFilter: 'both' }).map((i) => i.slug)).toEqual(['both']);
    // Selecting a user shows their exclusives AND shared films
    expect(filterItems([both, a, b], { mood: 'all', sourceFilter: 'userA' }).map((i) => i.slug)).toEqual(['both', 'a']);
    expect(filterItems([both, a, b], { mood: 'all', sourceFilter: 'userB' }).map((i) => i.slug)).toEqual(['both', 'b']);
    expect(filterItems([both, a, b], { mood: 'all', sourceFilter: 'all' })).toHaveLength(3);
  });
});

describe('sorting', () => {
  const items: PairWatchlistItem[] = [
    makeItem({ slug: 'b', title: 'Beta', lbRating: 3.5, year: 2020, runtime: 120 }),
    makeItem({ slug: 'a', title: 'Alpha', lbRating: 4.5, year: 2015, runtime: 90 }),
    makeItem({ slug: 'c', title: 'Charlie', lbRating: 4.0, year: 2023, runtime: 150 }),
  ];

  it('sorts by rating descending', () => {
    const sorted = sortItems(items, 'rating');
    expect(sorted.map((i) => i.slug)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by year descending', () => {
    const sorted = sortItems(items, 'year-desc');
    expect(sorted.map((i) => i.slug)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by runtime ascending', () => {
    const sorted = sortItems(items, 'runtime-asc');
    expect(sorted.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title alphabetically', () => {
    const sorted = sortItems(items, 'title');
    expect(sorted.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
  });

  it('handles missing values gracefully', () => {
    const mixed = [
      makeItem({ slug: 'no-rating', title: 'Z' }),
      makeItem({ slug: 'rated', title: 'A', lbRating: 4.0 }),
    ];
    const sorted = sortItems(mixed, 'rating');
    expect(sorted[0].slug).toBe('rated');
  });
});
