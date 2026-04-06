// Pair-watchlists is the beating heart of the simplified Matchboxd flow.
//
// Given two Letterboxd usernames, we:
//   1. Scrape each user's public watchlist (every page).
//   2. Scrape each user's "watched" list so we can drop anything either
//      person has already seen.
//   3. Intersect the two remaining sets.
//   4. For each shared slug, scrape the film detail page to pull poster,
//      rating, runtime, genres, directors, etc.
//
// The whole thing is done client-side via a CORS proxy. No TMDB key needed.

import {
  scrapeFilm,
  scrapeWatched,
  scrapeWatchlist,
  upscalePoster,
  type LetterboxdFilmDetails,
} from './letterboxdScrape';

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
  tmdbId?: number;
  letterboxdUrl: string;
  justwatchUrl: string;
}

export interface PairWatchlistProgress {
  stage: 'watchlists' | 'watched' | 'intersection' | 'details' | 'done';
  message: string;
  detailsLoaded?: number;
  detailsTotal?: number;
  pageLoaded?: number;
  pageTotal?: number;
}

export interface PairWatchlistResult {
  items: PairWatchlistItem[];
  counts: {
    watchlistA: number;
    watchlistB: number;
    overlap: number;
    filtered: number; // overlap minus watched
    enriched: number; // successfully scraped
  };
  userA: string;
  userB: string;
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

/** Run many async tasks with a bounded concurrency window. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function toItem(details: LetterboxdFilmDetails): PairWatchlistItem {
  return {
    slug: details.slug,
    title: details.title,
    year: details.year,
    posterUrl: upscalePoster(details.posterUrl, 460),
    synopsis: details.synopsis,
    runtime: details.runtime,
    genres: details.genres,
    directors: details.directors,
    lbRating: details.lbRating,
    lbRatingCount: details.lbRatingCount,
    tmdbId: details.tmdbId,
    letterboxdUrl: `https://letterboxd.com/film/${details.slug}/`,
    justwatchUrl: `https://www.justwatch.com/tr/search?q=${encodeURIComponent(details.title)}`,
  };
}

export interface PairWatchlistsOptions {
  /** Called as we move through stages; enables a live progress UI. */
  onProgress?: (p: PairWatchlistProgress) => void;
  /** Cap on watchlist pages per user (each page = 28 films). */
  maxWatchlistPages?: number;
  /** Cap on watched-list pages per user. Higher = more accurate filter. */
  maxWatchedPages?: number;
  /** Parallel requests when enriching film details. */
  detailConcurrency?: number;
  /** Optional cap on overlap size sent to enrichment. */
  maxOverlap?: number;
}

/** Build the list of films both users want to see and have not seen yet. */
export async function pairWatchlists(
  userA: string,
  userB: string,
  opts: PairWatchlistsOptions = {},
): Promise<PairWatchlistResult> {
  const {
    onProgress,
    maxWatchlistPages = 25,
    maxWatchedPages = 25,
    detailConcurrency = 2,
    maxOverlap = 60,
  } = opts;

  const cleanA = userA.trim().replace(/^@/, '').toLowerCase();
  const cleanB = userB.trim().replace(/^@/, '').toLowerCase();
  if (!cleanA || !cleanB) {
    throw new PairWatchlistError('Both usernames are required.');
  }
  if (cleanA === cleanB) {
    throw new PairWatchlistError(
      "Those usernames are identical — enter both people's Letterboxd handles.",
    );
  }

  // 1. Watchlists. We do these in parallel at the API level — the global
  // request throttle will serialize them on the wire, but starting both
  // "simultaneously" means neither user blocks the other.
  onProgress?.({
    stage: 'watchlists',
    message: `Fetching @${cleanA} and @${cleanB}'s watchlists…`,
  });
  const progress = { a: { done: 0, total: 0 }, b: { done: 0, total: 0 } };
  const emitWatchlistProgress = () => {
    const done = progress.a.done + progress.b.done;
    const total = (progress.a.total || 0) + (progress.b.total || 0);
    onProgress?.({
      stage: 'watchlists',
      message: total
        ? `Fetching watchlists… page ${done}/${total}`
        : `Fetching watchlists… ${done} pages so far`,
      pageLoaded: done,
      pageTotal: total,
    });
  };
  let listA: string[];
  let listB: string[];
  try {
    [listA, listB] = await Promise.all([
      scrapeWatchlist(cleanA, maxWatchlistPages, (p) => {
        progress.a.done = p.page;
        progress.a.total = p.total;
        emitWatchlistProgress();
      }),
      scrapeWatchlist(cleanB, maxWatchlistPages, (p) => {
        progress.b.done = p.page;
        progress.b.total = p.total;
        emitWatchlistProgress();
      }),
    ]);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err);
    throw new PairWatchlistError(
      `Couldn't read watchlists — the CORS proxies may be rate-limited. Try again in a minute.\n\nDetails: ${msg}`,
      err,
    );
  }
  if (listA.length === 0) {
    throw new PairWatchlistError(
      `Couldn't read @${cleanA}'s watchlist. Make sure the profile exists and the watchlist is set to public in their Letterboxd privacy settings.`,
    );
  }
  if (listB.length === 0) {
    throw new PairWatchlistError(
      `Couldn't read @${cleanB}'s watchlist. Make sure the profile exists and the watchlist is set to public in their Letterboxd privacy settings.`,
    );
  }

  const setB = new Set(listB);
  const overlap = listA.filter((slug) => setB.has(slug));

  onProgress?.({
    stage: 'intersection',
    message: `Found ${overlap.length} shared film${overlap.length === 1 ? '' : 's'} — checking what you've already watched…`,
  });

  if (overlap.length === 0) {
    return {
      items: [],
      userA: cleanA,
      userB: cleanB,
      counts: {
        watchlistA: listA.length,
        watchlistB: listB.length,
        overlap: 0,
        filtered: 0,
        enriched: 0,
      },
    };
  }

  // 2. Watched filter. Best-effort — if either user's watched list can't be
  // read we proceed with an unfiltered overlap.
  onProgress?.({
    stage: 'watched',
    message: 'Filtering out films either of you has already seen…',
  });
  const watchedProgress = { a: 0, b: 0, aT: 0, bT: 0 };
  const emitWatchedProgress = () => {
    const done = watchedProgress.a + watchedProgress.b;
    const total = watchedProgress.aT + watchedProgress.bT;
    onProgress?.({
      stage: 'watched',
      message: total
        ? `Checking watched lists… page ${done}/${total}`
        : `Checking watched lists… ${done} pages so far`,
      pageLoaded: done,
      pageTotal: total,
    });
  };
  const [watchedA, watchedB] = await Promise.all([
    scrapeWatched(cleanA, maxWatchedPages, (p) => {
      watchedProgress.a = p.page;
      watchedProgress.aT = p.total;
      emitWatchedProgress();
    }),
    scrapeWatched(cleanB, maxWatchedPages, (p) => {
      watchedProgress.b = p.page;
      watchedProgress.bT = p.total;
      emitWatchedProgress();
    }),
  ]);
  const seen = new Set<string>([...watchedA, ...watchedB]);
  const filtered = overlap.filter((slug) => !seen.has(slug));

  // Keep a tight cap so enrichment stays fast.
  const toEnrich = filtered.slice(0, maxOverlap);

  // 3. Enrich each film with poster + rating + runtime.
  const total = toEnrich.length;
  let loaded = 0;
  onProgress?.({
    stage: 'details',
    message: `Loading ${total} film${total === 1 ? '' : 's'}…`,
    detailsLoaded: 0,
    detailsTotal: total,
  });

  const details = await runWithConcurrency(toEnrich, detailConcurrency, async (slug) => {
    try {
      const d = await scrapeFilm(slug);
      loaded += 1;
      onProgress?.({
        stage: 'details',
        message: `Loading films… ${loaded}/${total}`,
        detailsLoaded: loaded,
        detailsTotal: total,
      });
      return d;
    } catch {
      loaded += 1;
      onProgress?.({
        stage: 'details',
        message: `Loading films… ${loaded}/${total}`,
        detailsLoaded: loaded,
        detailsTotal: total,
      });
      return null;
    }
  });

  const items = details
    .filter((d): d is LetterboxdFilmDetails => d !== null)
    .map(toItem);

  onProgress?.({ stage: 'done', message: 'Done!' });

  return {
    items,
    userA: cleanA,
    userB: cleanB,
    counts: {
      watchlistA: listA.length,
      watchlistB: listB.length,
      overlap: overlap.length,
      filtered: filtered.length,
      enriched: items.length,
    },
  };
}
