import { describe, expect, it } from 'vitest';
import type { PairWatchlistItem } from './pairWatchlists';
import {
  filterPairItems,
  sortPairItems,
} from '../features/pair/filters';

const CURRENT_YEAR = new Date().getFullYear();
const RECENT_THRESHOLD = CURRENT_YEAR - 5;

function makeItem(overrides: Partial<PairWatchlistItem> = {}): PairWatchlistItem {
  return {
    slug: 'test-film',
    title: 'Test Film',
    genres: [],
    directors: [],
    letterboxdUrl: 'https://letterboxd.com/film/test-film/',
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

    const result = filterPairItems([romcom, pureComedy, pureRomance], {
      mood: 'romcom',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result.map((i) => i.slug)).toEqual(['test-film']);
  });

  it('horror filter matches case-insensitively', () => {
    const item = makeItem({ genres: ['horror'] });
    expect(filterPairItems([item], {
      mood: 'horror',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    })).toHaveLength(1);
  });

  it('scifi matches "Science Fiction" and "Sci-Fi"', () => {
    const sf = makeItem({ slug: 'sf', genres: ['Science Fiction'] });
    const scifi = makeItem({ slug: 'scifi', genres: ['Sci-Fi'] });
    const action = makeItem({ slug: 'action', genres: ['Action'] });

    const result = filterPairItems([sf, scifi, action], {
      mood: 'scifi',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result.map((i) => i.slug)).toEqual(['sf', 'scifi']);
  });

  it('recent filter uses CURRENT_YEAR - 5 threshold', () => {
    const recent = makeItem({ slug: 'new', year: CURRENT_YEAR });
    const old = makeItem({ slug: 'old', year: 2000 });
    const boundary = makeItem({ slug: 'boundary', year: RECENT_THRESHOLD });

    const result = filterPairItems([recent, old, boundary], {
      mood: 'recent',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result.map((i) => i.slug)).toEqual(['new', 'boundary']);
  });

  it('"all" mood returns everything', () => {
    const items = [
      makeItem({ slug: 'a', genres: ['Horror'] }),
      makeItem({ slug: 'b', genres: ['Comedy'] }),
    ];
    expect(filterPairItems(items, {
      mood: 'all',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    })).toHaveLength(2);
  });
});

describe('unenriched stub passthrough', () => {
  it('keeps unenriched stubs visible when a genre mood filter is active', () => {
    const stub = makeItem({ slug: 'stub', enriched: false, genres: [] });
    const enriched = makeItem({ slug: 'horror', enriched: true, genres: ['Horror'] });

    const result = filterPairItems([stub, enriched], {
      mood: 'horror',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result.map((i) => i.slug)).toEqual(['stub', 'horror']);
  });

  it('does NOT keep enriched items with empty genres', () => {
    const enrichedEmpty = makeItem({ slug: 'empty', enriched: true, genres: [] });
    const result = filterPairItems([enrichedEmpty], {
      mood: 'horror',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result).toHaveLength(0);
  });

  it('applies "recent" filter normally to stubs (year is available on stubs)', () => {
    const oldStub = makeItem({ slug: 'old', enriched: false, genres: [], year: 2000 });
    const result = filterPairItems([oldStub], {
      mood: 'recent',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result).toHaveLength(0);
  });
});

describe('quick filters', () => {
  it('underOneHundred excludes films over 100 min', () => {
    const short = makeItem({ slug: 'short', runtime: 90 });
    const long = makeItem({ slug: 'long', runtime: 120 });
    const noRuntime = makeItem({ slug: 'no-runtime' });

    const result = filterPairItems([short, long, noRuntime], {
      mood: 'all',
      sourceFilter: 'all',
      underOneHundred: true,
      highRatedOnly: false,
      sort: 'rating',
    });
    expect(result.map((i) => i.slug)).toEqual(['short']);
  });

  it('highRatedOnly excludes films under 4.0', () => {
    const high = makeItem({ slug: 'high', lbRating: 4.2 });
    const low = makeItem({ slug: 'low', lbRating: 3.5 });
    const noRating = makeItem({ slug: 'none' });

    const result = filterPairItems([high, low, noRating], {
      mood: 'all',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: true,
      sort: 'rating',
    });
    expect(result.map((i) => i.slug)).toEqual(['high']);
  });
});

describe('source filter', () => {
  it('filters by source correctly', () => {
    const both = makeItem({ slug: 'both', source: 'both' });
    const a = makeItem({ slug: 'a', source: 'userA' });
    const b = makeItem({ slug: 'b', source: 'userB' });

    expect(filterPairItems([both, a, b], {
      mood: 'all',
      sourceFilter: 'both',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    }).map((i) => i.slug)).toEqual(['both']);
    expect(filterPairItems([both, a, b], {
      mood: 'all',
      sourceFilter: 'userA',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    }).map((i) => i.slug)).toEqual(['both', 'a']);
    expect(filterPairItems([both, a, b], {
      mood: 'all',
      sourceFilter: 'userB',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    }).map((i) => i.slug)).toEqual(['both', 'b']);
    expect(filterPairItems([both, a, b], {
      mood: 'all',
      sourceFilter: 'all',
      underOneHundred: false,
      highRatedOnly: false,
      sort: 'rating',
    })).toHaveLength(3);
  });
});

describe('sorting', () => {
  const items: PairWatchlistItem[] = [
    makeItem({ slug: 'b', title: 'Beta', lbRating: 3.5, year: 2020, runtime: 120 }),
    makeItem({ slug: 'a', title: 'Alpha', lbRating: 4.5, year: 2015, runtime: 90 }),
    makeItem({ slug: 'c', title: 'Charlie', lbRating: 4.0, year: 2023, runtime: 150 }),
  ];

  it('sorts by rating descending', () => {
    const sorted = sortPairItems(items, 'rating');
    expect(sorted.map((i) => i.slug)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by year descending', () => {
    const sorted = sortPairItems(items, 'year-desc');
    expect(sorted.map((i) => i.slug)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by runtime ascending', () => {
    const sorted = sortPairItems(items, 'runtime-asc');
    expect(sorted.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title alphabetically', () => {
    const sorted = sortPairItems(items, 'title');
    expect(sorted.map((i) => i.slug)).toEqual(['a', 'b', 'c']);
  });

  it('handles missing values gracefully', () => {
    const mixed = [
      makeItem({ slug: 'no-rating', title: 'Z' }),
      makeItem({ slug: 'rated', title: 'A', lbRating: 4.0 }),
    ];
    const sorted = sortPairItems(mixed, 'rating');
    expect(sorted[0].slug).toBe('rated');
  });
});
