import { describe, expect, it } from 'vitest';
import type { PairWatchlistItem } from './pairWatchlists';
import {
  DEFAULT_PAIR_RESULTS_FILTERS,
  filterPairItems,
  sortPairItems,
  type PairResultsFilters,
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

function filterSlugs(
  items: PairWatchlistItem[],
  filters: Partial<PairResultsFilters>,
) {
  return filterPairItems(items, {
    ...DEFAULT_PAIR_RESULTS_FILTERS,
    ...filters,
  }).map((item) => item.slug);
}

describe('genre filtering', () => {
  it('romcom requires BOTH romance AND comedy genres', () => {
    const romcom = makeItem({ genres: ['Romance', 'Comedy'] });
    const pureComedy = makeItem({ slug: 'comedy', genres: ['Comedy'] });
    const pureRomance = makeItem({ slug: 'romance', genres: ['Romance'] });

    expect(filterSlugs([romcom, pureComedy, pureRomance], {
      mood: 'romcom',
    })).toEqual(['test-film']);
  });

  it('horror filter matches case-insensitively', () => {
    const item = makeItem({ genres: ['horror'] });
    expect(filterSlugs([item], {
      mood: 'horror',
    })).toEqual(['test-film']);
  });

  it('scifi matches "Science Fiction" and "Sci-Fi"', () => {
    const sf = makeItem({ slug: 'sf', genres: ['Science Fiction'] });
    const scifi = makeItem({ slug: 'scifi', genres: ['Sci-Fi'] });
    const action = makeItem({ slug: 'action', genres: ['Action'] });

    const result = filterSlugs([sf, scifi, action], {
      mood: 'scifi',
    });
    expect(result).toEqual(['sf', 'scifi']);
  });

  it('recent filter uses CURRENT_YEAR - 5 threshold', () => {
    const recent = makeItem({ slug: 'new', year: CURRENT_YEAR });
    const old = makeItem({ slug: 'old', year: 2000 });
    const boundary = makeItem({ slug: 'boundary', year: RECENT_THRESHOLD });

    const result = filterSlugs([recent, old, boundary], {
      mood: 'recent',
    });
    expect(result).toEqual(['new', 'boundary']);
  });

  it('"all" mood returns everything', () => {
    const items = [
      makeItem({ slug: 'a', genres: ['Horror'] }),
      makeItem({ slug: 'b', genres: ['Comedy'] }),
    ];
    expect(filterSlugs(items, {
      mood: 'all',
    })).toEqual(['a', 'b']);
  });
});

describe('unenriched stub passthrough', () => {
  it('keeps unenriched stubs visible when a genre mood filter is active', () => {
    const stub = makeItem({ slug: 'stub', enriched: false, genres: [] });
    const enriched = makeItem({ slug: 'horror', enriched: true, genres: ['Horror'] });

    const result = filterSlugs([stub, enriched], {
      mood: 'horror',
    });
    expect(result).toEqual(['stub', 'horror']);
  });

  it('does NOT keep enriched items with empty genres', () => {
    const enrichedEmpty = makeItem({ slug: 'empty', enriched: true, genres: [] });
    const result = filterSlugs([enrichedEmpty], {
      mood: 'horror',
    });
    expect(result).toHaveLength(0);
  });

  it('applies "recent" filter normally to stubs (year is available on stubs)', () => {
    const oldStub = makeItem({ slug: 'old', enriched: false, genres: [], year: 2000 });
    const result = filterSlugs([oldStub], {
      mood: 'recent',
    });
    expect(result).toHaveLength(0);
  });

  it('still applies source filters before allowing unknown-genre stubs through', () => {
    const aStub = makeItem({ slug: 'a-stub', source: 'userA', enriched: false, genres: [] });
    const bStub = makeItem({ slug: 'b-stub', source: 'userB', enriched: false, genres: [] });

    expect(filterSlugs([aStub, bStub], {
      mood: 'horror',
      sourceFilter: 'userA',
    })).toEqual(['a-stub']);
  });
});

describe('quick filters', () => {
  it('underOneHundred excludes films over 100 min', () => {
    const short = makeItem({ slug: 'short', runtime: 90 });
    const long = makeItem({ slug: 'long', runtime: 120 });
    const noRuntime = makeItem({ slug: 'no-runtime' });

    const result = filterSlugs([short, long, noRuntime], {
      underOneHundred: true,
    });
    expect(result).toEqual(['short']);
  });

  it('highRatedOnly excludes films under 4.0', () => {
    const high = makeItem({ slug: 'high', lbRating: 4.2 });
    const low = makeItem({ slug: 'low', lbRating: 3.5 });
    const noRating = makeItem({ slug: 'none' });

    const result = filterSlugs([high, low, noRating], {
      highRatedOnly: true,
    });
    expect(result).toEqual(['high']);
  });

  it('combines source, mood, runtime, and rating as an intersection', () => {
    const match = makeItem({
      slug: 'match',
      source: 'userA',
      genres: ['Comedy'],
      runtime: 92,
      lbRating: 4.1,
    });
    const wrongSource = makeItem({
      slug: 'wrong-source',
      source: 'userB',
      genres: ['Comedy'],
      runtime: 92,
      lbRating: 4.1,
    });
    const wrongMood = makeItem({
      slug: 'wrong-mood',
      source: 'userA',
      genres: ['Drama'],
      runtime: 92,
      lbRating: 4.1,
    });
    const tooLong = makeItem({
      slug: 'too-long',
      source: 'userA',
      genres: ['Comedy'],
      runtime: 101,
      lbRating: 4.1,
    });
    const tooLow = makeItem({
      slug: 'too-low',
      source: 'userA',
      genres: ['Comedy'],
      runtime: 92,
      lbRating: 3.9,
    });

    expect(filterSlugs([match, wrongSource, wrongMood, tooLong, tooLow], {
      mood: 'comedy',
      sourceFilter: 'userA',
      underOneHundred: true,
      highRatedOnly: true,
    })).toEqual(['match']);
  });
});

describe('source filter', () => {
  it('filters by source correctly', () => {
    const both = makeItem({ slug: 'both', source: 'both' });
    const a = makeItem({ slug: 'a', source: 'userA' });
    const b = makeItem({ slug: 'b', source: 'userB' });

    expect(filterSlugs([both, a, b], {
      sourceFilter: 'both',
    })).toEqual(['both']);
    expect(filterSlugs([both, a, b], {
      sourceFilter: 'userA',
    })).toEqual(['a']);
    expect(filterSlugs([both, a, b], {
      sourceFilter: 'userB',
    })).toEqual(['b']);
    expect(filterSlugs([both, a, b], {
      sourceFilter: 'all',
    })).toEqual(['both', 'a', 'b']);
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

  it('does not mutate the original items array', () => {
    const original = [...items];

    sortPairItems(items, 'rating');

    expect(items).toEqual(original);
  });
});
