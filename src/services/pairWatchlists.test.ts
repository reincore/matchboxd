import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./countryDetection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./countryDetection')>();
  return {
    ...actual,
    getDetectedCountry: () => 'us',
    buildJustWatchSearchUrl: (title: string, year?: number) => {
      const query = [title, year ? String(year) : ''].filter(Boolean).join(' ');
      return `https://www.justwatch.com/us/search?q=${encodeURIComponent(query)}`;
    },
  };
});

vi.mock('./letterboxdScrape', () => {
  class LetterboxdScrapeError extends Error {
    code: 'not-found' | 'private' | 'unknown';
    cause?: unknown;

    constructor(message: string, code: 'not-found' | 'private' | 'unknown' = 'unknown', cause?: unknown) {
      super(message);
      this.name = 'LetterboxdScrapeError';
      this.code = code;
      this.cause = cause;
    }
  }

  return {
    LetterboxdScrapeError,
    getListPageMeta: vi.fn(),
    scrapeFilm: vi.fn(),
    scrapeWatchlist: vi.fn(),
    upscalePoster: vi.fn((url: string | undefined) => url),
  };
});

import * as scrape from './letterboxdScrape';
import { pairWatchlists } from './pairWatchlists';

const scrapeWatchlistMock = vi.mocked(scrape.scrapeWatchlist);
const scrapeFilmMock = vi.mocked(scrape.scrapeFilm);
const getListPageMetaMock = vi.mocked(scrape.getListPageMeta);

describe('pairWatchlists', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getListPageMetaMock.mockImplementation((slug: string) => ({
      title: slug
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      year: 2020,
      posterUrl: `https://images.test/${slug}.jpg`,
    }));
  });

  it('builds overlap and near-miss results without storing derived JustWatch URLs', async () => {
    scrapeWatchlistMock
      .mockResolvedValueOnce(['shared-film', 'only-a'])
      .mockResolvedValueOnce(['shared-film', 'only-b']);

    scrapeFilmMock.mockImplementation(async (slug: string) => ({
      slug,
      title: slug === 'shared-film' ? 'Shared Film' : slug === 'only-a' ? 'Only A' : 'Only B',
      year: slug === 'shared-film' ? 2018 : 2021,
      posterUrl: `https://images.test/${slug}.jpg`,
      synopsis: `${slug} synopsis`,
      runtime: 100,
      genres: ['Drama'],
      directors: ['Director'],
      lbRating: 4.2,
      lbRatingCount: 1200,
    }));

    const stubs: unknown[] = [];
    const streamed: string[] = [];

    const result = await pairWatchlists('alice', 'bob', {
      onStubs(items) {
        stubs.push(...items);
      },
      onItem(item) {
        streamed.push(item.slug);
      },
    });

    expect(result.counts.overlap).toBe(1);
    expect(result.counts.filtered).toBe(3);
    expect(result.counts.enriched).toBe(3);
    expect(result.items.map((item) => item.slug)).toEqual(['shared-film', 'only-a', 'only-b']);
    expect(streamed).toEqual(['shared-film', 'only-a', 'only-b']);
    expect(stubs).toHaveLength(3);
    expect('justwatchUrl' in result.items[0]).toBe(false);
  });

  it('emits empty stubs and returns cleanly when nothing is selected for enrichment', async () => {
    scrapeWatchlistMock
      .mockResolvedValueOnce(['film-a'])
      .mockResolvedValueOnce(['film-b']);

    const onStubs = vi.fn();

    const result = await pairWatchlists('alice', 'bob', {
      maxOverlap: 0,
      maxNearMisses: 0,
      onStubs,
    });

    expect(onStubs).toHaveBeenCalledWith([], {
      watchlistA: 1,
      watchlistB: 1,
      overlap: 0,
      filtered: 0,
      enriched: 0,
    });
    expect(result.items).toEqual([]);
    expect(result.counts.filtered).toBe(0);
  });

  it('fails fast with a friendly error for unknown usernames', async () => {
    scrapeWatchlistMock.mockRejectedValueOnce(
      new scrape.LetterboxdScrapeError('Letterboxd returned 404', 'not-found'),
    );
    scrapeWatchlistMock.mockResolvedValueOnce(['shared-film']);

    await expect(pairWatchlists('nouser', 'other')).rejects.toMatchObject({
      name: 'PairWatchlistError',
      message: "Couldn't find @nouser on Letterboxd. Check the username and try again.",
    });
  });

  it('rejects invalid username format before any scraping', async () => {
    await expect(pairWatchlists('a', 'bob')).rejects.toMatchObject({
      name: 'PairWatchlistError',
      message: expect.stringMatching(/at least 2/),
    });
    // scrapeWatchlist should never have been called
    expect(scrapeWatchlistMock).not.toHaveBeenCalled();
  });
});
