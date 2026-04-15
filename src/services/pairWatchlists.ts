// Pair-watchlists is the beating heart of the simplified Matchboxd flow.
//
// Given two Letterboxd usernames, we:
//   1. Scrape each user's public watchlist (every page).
//   2. Intersect → build stubs from list-page metadata → emit them immediately.
//   3. Enrich each film with detail page data (poster, rating, runtime, etc.)
//      and stream updates to the caller via onItem callback.
//
// The whole thing is done client-side via a CORS proxy.

import {
  getListPageMeta,
  LetterboxdScrapeError,
  scrapeFilm,
  scrapeWatchlist,
  upscalePoster,
  type LetterboxdFilmDetails,
} from './letterboxdScrape';
import { buildJustWatchSearchUrl } from './countryDetection';
import { slugToTitle, validateLetterboxdUsername } from '../utils/slug';

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
  justwatchUrl: string;
  source: ItemSource;
  /** True if this item has been enriched with detail page data. */
  enriched: boolean;
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
  counts: {
    watchlistA: number;
    watchlistB: number;
    overlap: number;
    filtered: number;
    enriched: number; // successfully scraped detail pages
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

/** Build a stub PairWatchlistItem from list-page metadata (no detail scrape). */
function buildStub(slug: string, source: ItemSource): PairWatchlistItem {
  const meta = getListPageMeta(slug);
  return {
    slug,
    title: meta?.title ?? slugToTitle(slug),
    year: meta?.year,
    posterUrl: meta?.posterUrl,
    genres: [],
    directors: [],
    letterboxdUrl: `https://letterboxd.com/film/${slug}/`,
    justwatchUrl: buildJustWatchSearchUrl(
      meta?.title ?? slugToTitle(slug),
      meta?.year,
    ),
    source,
    enriched: false,
  };
}

function toItem(details: LetterboxdFilmDetails, source: ItemSource): PairWatchlistItem {
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
    letterboxdUrl: `https://letterboxd.com/film/${details.slug}/`,
    justwatchUrl: buildJustWatchSearchUrl(details.title, details.year),
    source,
    enriched: true,
  };
}

export interface PairWatchlistsOptions {
  /** Called as we move through stages; enables a live progress UI. */
  onProgress?: (p: PairWatchlistProgress) => void;
  /** Called with each enriched item as soon as it's ready — enables streaming UI. */
  onItem?: (item: PairWatchlistItem) => void;
  /** Called with all stubs immediately after intersection, before enrichment. */
  onStubs?: (stubs: PairWatchlistItem[], counts: PairWatchlistResult['counts']) => void;
  /** Cap on watchlist pages per user (each page = 28 films). */
  maxWatchlistPages?: number;
  /** Parallel requests when enriching film details. With per-proxy throttle
   *  this maps to parallel proxy usage. */
  detailConcurrency?: number;
  /** Optional cap on total films sent to enrichment. */
  maxOverlap?: number;
  /** Cap on near-miss films (from one watchlist only) to enrich. */
  maxNearMisses?: number;
}

function watchlistErrorMessage(username: string, err: unknown): string {
  if (err instanceof LetterboxdScrapeError) {
    if (err.code === 'not-found') {
      return `Couldn't find @${username} on Letterboxd. Check the username and try again.`;
    }
    if (err.code === 'private') {
      return `@${username}'s watchlist is set to private. They need to make it public in their Letterboxd settings.`;
    }
  }

  return `Couldn't read @${username}'s public watchlist. Make sure the profile exists, the watchlist is public, and the proxy isn't being rate-limited.`;
}

/** Build the list of films both users want to see. */
export async function pairWatchlists(
  userA: string,
  userB: string,
  opts: PairWatchlistsOptions = {},
): Promise<PairWatchlistResult> {
  const {
    onProgress,
    onItem,
    onStubs,
    maxWatchlistPages = 25,
    detailConcurrency = 5,
    maxOverlap = 60,
    maxNearMisses = 40,
  } = opts;

  const cleanA = userA.trim().replace(/^@/, '').toLowerCase();
  const cleanB = userB.trim().replace(/^@/, '').toLowerCase();
  const errA = validateLetterboxdUsername(cleanA);
  if (errA) throw new PairWatchlistError(errA);
  const errB = validateLetterboxdUsername(cleanB);
  if (errB) throw new PairWatchlistError(errB);
  if (cleanA === cleanB) {
    throw new PairWatchlistError(
      "Those usernames are identical — enter both people's Letterboxd handles.",
    );
  }

  // 1. Scrape both watchlists in parallel. With per-proxy throttle, requests
  //    to different proxies actually run concurrently.
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
      }).catch((err) => {
        throw new PairWatchlistError(watchlistErrorMessage(cleanA, err), err);
      }),
      scrapeWatchlist(cleanB, maxWatchlistPages, (p) => {
        progress.b.done = p.page;
        progress.b.total = p.total;
        emitWatchlistProgress();
      }).catch((err) => {
        throw new PairWatchlistError(watchlistErrorMessage(cleanB, err), err);
      }),
    ]);
  } catch (err) {
    if (err instanceof PairWatchlistError) throw err;
    throw new PairWatchlistError(
      'Couldn’t read one or both watchlists. The proxy may be rate-limited — try again in a minute.',
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

  // 2. Intersection + near-misses (instant — no network needed).
  const setA = new Set(listA);
  const setB = new Set(listB);
  const overlap = listA.filter((slug) => setB.has(slug));

  const onlyA = listA.filter((slug) => !setB.has(slug));
  const onlyB = listB.filter((slug) => !setA.has(slug));

  // Interleave near-misses from both lists evenly.
  const nearMisses: { slug: string; source: ItemSource }[] = [];
  const halfCap = Math.ceil(maxNearMisses / 2);
  const cappedA = onlyA.slice(0, halfCap);
  const cappedB = onlyB.slice(0, halfCap);
  for (let i = 0; i < Math.max(cappedA.length, cappedB.length); i++) {
    if (i < cappedA.length) nearMisses.push({ slug: cappedA[i], source: 'userA' });
    if (i < cappedB.length) nearMisses.push({ slug: cappedB[i], source: 'userB' });
    if (nearMisses.length >= maxNearMisses) break;
  }

  const overlapToEnrich = overlap.slice(0, maxOverlap);
  const allToEnrich = [
    ...overlapToEnrich.map((slug) => ({ slug, source: 'both' as ItemSource })),
    ...nearMisses,
  ];

  const counts: PairWatchlistResult['counts'] = {
    watchlistA: listA.length,
    watchlistB: listB.length,
    overlap: overlap.length,
    filtered: overlapToEnrich.length + nearMisses.length,
    enriched: 0,
  };

  // Build stubs from list-page metadata and emit immediately.
  // This lets the UI show a full grid of films with posters + titles
  // before any detail pages have loaded.
  const stubs = allToEnrich.map(({ slug, source }) => buildStub(slug, source));
  onStubs?.(stubs, counts);

  onProgress?.({
    stage: 'intersection',
    message: `Found ${overlap.length} shared film${overlap.length === 1 ? '' : 's'} — loading details…`,
  });

  if (allToEnrich.length === 0) {
    onProgress?.({ stage: 'done', message: 'Done!' });
    return { items: [], userA: cleanA, userB: cleanB, counts };
  }

  // 3. Enrich each film with detail page data, streaming items to the caller.
  const total = allToEnrich.length;
  let loaded = 0;
  onProgress?.({
    stage: 'details',
    message: `Loading ${total} film${total === 1 ? '' : 's'}…`,
    detailsLoaded: 0,
    detailsTotal: total,
  });

  const details = await runWithConcurrency(allToEnrich, detailConcurrency, async ({ slug, source }) => {
    try {
      const d = await scrapeFilm(slug);
      loaded += 1;
      const item = toItem(d, source);
      onItem?.(item);
      onProgress?.({
        stage: 'details',
        message: `Loading films… ${loaded}/${total}`,
        detailsLoaded: loaded,
        detailsTotal: total,
      });
      return item;
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

  const items = details.filter((d): d is PairWatchlistItem => d !== null);
  counts.enriched = items.length;

  onProgress?.({ stage: 'done', message: 'Done!' });

  return { items, userA: cleanA, userB: cleanB, counts };
}
