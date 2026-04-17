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
  LetterboxdScrapeError,
  scrapeWatchlist,
} from './letterboxdScrape';
import { validateLetterboxdUsername } from '../utils/slug';
import { enrichPairCandidates } from './pairWatchlists/enrichment';
import { buildStubItem } from './pairWatchlists/itemFactory';
import {
  createWatchlistProgressReporter,
  reportDone,
  reportIntersection,
  reportWatchlistStart,
} from './pairWatchlists/progress';
import { selectPairCandidates } from './pairWatchlists/selection';
import {
  PairWatchlistError,
  type PairWatchlistResult,
  type PairWatchlistsOptions,
} from './pairWatchlists/types';
export { PairWatchlistError } from './pairWatchlists/types';
export type {
  ItemSource,
  PairWatchlistCandidate,
  PairWatchlistCounts,
  PairWatchlistItem,
  PairWatchlistProgress,
  PairWatchlistResult,
  PairWatchlistsOptions,
} from './pairWatchlists/types';

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

  reportWatchlistStart(onProgress, cleanA, cleanB);
  const { reportUserA, reportUserB } = createWatchlistProgressReporter(onProgress);
  let listA: string[];
  let listB: string[];
  try {
    [listA, listB] = await Promise.all([
      scrapeWatchlist(cleanA, maxWatchlistPages, (p) => {
        reportUserA(p);
      }).catch((err) => {
        throw new PairWatchlistError(watchlistErrorMessage(cleanA, err), err);
      }),
      scrapeWatchlist(cleanB, maxWatchlistPages, (p) => {
        reportUserB(p);
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

  const { candidates, counts } = selectPairCandidates(
    listA,
    listB,
    maxOverlap,
    maxNearMisses,
  );
  const stubs = candidates.map(({ slug, source }) => buildStubItem(slug, source));
  onStubs?.(stubs, counts);
  reportIntersection(onProgress, counts.overlap);

  if (candidates.length === 0) {
    reportDone(onProgress);
    return { items: [], userA: cleanA, userB: cleanB, counts };
  }

  const items = await enrichPairCandidates(
    candidates,
    detailConcurrency,
    onItem,
    onProgress,
  );
  counts.enriched = items.length;

  reportDone(onProgress);

  return { items, userA: cleanA, userB: cleanB, counts };
}
