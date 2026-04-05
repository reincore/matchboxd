// Letterboxd public-data adapter.
//
// Letterboxd exposes user RSS feeds such as:
//   https://letterboxd.com/<user>/rss/
// which lists recent public activity (watched, liked, reviewed, rewatched).
// They do NOT serve an Access-Control-Allow-Origin header, so a browser
// cannot fetch them directly. This module reads them through a configurable
// adapter.

import type { LetterboxdEntry } from '../types';
import { RSS_ADAPTER, RSS_BASE_URL } from '../utils/env';
import { extractLetterboxdSlug } from '../utils/slug';

const LETTERBOXD_BASE = 'https://letterboxd.com';

export class LetterboxdFetchError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'LetterboxdFetchError';
  }
}

interface Rss2JsonItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  guid?: string;
}

interface Rss2JsonResponse {
  status: string;
  items?: Rss2JsonItem[];
  message?: string;
}

/** Public surface: fetch a user's recent activity as normalized entries. */
export async function fetchUserActivity(
  username: string,
): Promise<LetterboxdEntry[]> {
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  if (!clean) throw new LetterboxdFetchError('Empty username');

  const rssUrl = `${LETTERBOXD_BASE}/${encodeURIComponent(clean)}/rss/`;

  const items = await fetchRssItems(rssUrl);
  if (!items.length) return [];

  return items
    .map(parseRssItem)
    .filter((e): e is LetterboxdEntry => e !== null);
}

async function fetchRssItems(rssUrl: string): Promise<Rss2JsonItem[]> {
  try {
    if (RSS_ADAPTER === 'rss2json') {
      const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=100`;
      const res = await fetch(api);
      if (!res.ok)
        throw new LetterboxdFetchError(`rss2json returned ${res.status}`);
      const json = (await res.json()) as Rss2JsonResponse;
      if (json.status !== 'ok') {
        throw new LetterboxdFetchError(
          json.message || 'rss2json returned non-ok status',
        );
      }
      return json.items ?? [];
    }

    if (RSS_ADAPTER === 'allorigins') {
      const api = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
      const res = await fetch(api);
      if (!res.ok)
        throw new LetterboxdFetchError(`allorigins returned ${res.status}`);
      const xml = await res.text();
      return parseRawRss(xml);
    }

    if (RSS_ADAPTER === 'custom') {
      if (!RSS_BASE_URL) {
        throw new LetterboxdFetchError(
          'VITE_RSS_BASE_URL is required when VITE_RSS_ADAPTER=custom',
        );
      }
      const sep = RSS_BASE_URL.includes('?') ? '&' : '?';
      const api = `${RSS_BASE_URL}${sep}url=${encodeURIComponent(rssUrl)}`;
      const res = await fetch(api);
      if (!res.ok)
        throw new LetterboxdFetchError(`custom proxy returned ${res.status}`);
      const xml = await res.text();
      return parseRawRss(xml);
    }

    throw new LetterboxdFetchError(`Unknown RSS adapter: ${RSS_ADAPTER}`);
  } catch (err) {
    if (err instanceof LetterboxdFetchError) throw err;
    throw new LetterboxdFetchError(
      'Failed to fetch Letterboxd feed. The user may not exist, their profile may be private, or the RSS proxy may be rate-limited.',
      err,
    );
  }
}

/** Minimal DOM-based RSS parser for the allorigins/custom adapters. */
function parseRawRss(xml: string): Rss2JsonItem[] {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const itemNodes = Array.from(doc.querySelectorAll('item'));
    return itemNodes.map((node) => ({
      title: node.querySelector('title')?.textContent ?? undefined,
      link: node.querySelector('link')?.textContent ?? undefined,
      pubDate: node.querySelector('pubDate')?.textContent ?? undefined,
      description: node.querySelector('description')?.textContent ?? undefined,
      guid: node.querySelector('guid')?.textContent ?? undefined,
    }));
  } catch {
    return [];
  }
}

/** Title pattern examples:
 *    "Past Lives, 2023 - ★★★★½"
 *    "Parasite, 2019 - ★★★★★ (rewatched)"
 *    "Watchlist: Dune"
 */
function parseRssItem(item: Rss2JsonItem): LetterboxdEntry | null {
  const rawTitle = (item.title ?? '').trim();
  const link = item.link ?? '';
  const slug = extractLetterboxdSlug(link);

  if (!rawTitle) return null;

  // Watchlist items come through as their own feed typically, but some
  // aggregators label them with "Watchlist:" prefix.
  if (/^watchlist:/i.test(rawTitle)) {
    const title = rawTitle.replace(/^watchlist:\s*/i, '').trim();
    return {
      kind: 'watchlist',
      title,
      letterboxdSlug: slug,
    };
  }

  // "Title, Year - ★★★½" pattern.
  const match = rawTitle.match(
    /^(.+?),\s*(\d{4})\s*(?:-\s*(★+½?)\s*)?(\(rewatched\))?\s*$/,
  );
  if (match) {
    const title = match[1].trim();
    const year = Number(match[2]);
    const stars = match[3];
    const rewatch = Boolean(match[4]);
    const rating = stars ? starsToRating(stars) : undefined;
    return {
      kind: rating !== undefined ? 'watched' : 'watched',
      title,
      year: Number.isFinite(year) ? year : undefined,
      rating,
      letterboxdSlug: slug,
      watchedAt: item.pubDate,
      rewatch,
    };
  }

  // Fallback: treat as watched without rating.
  return {
    kind: 'watched',
    title: rawTitle,
    letterboxdSlug: slug,
    watchedAt: item.pubDate,
  };
}

function starsToRating(stars: string): number {
  const full = (stars.match(/★/g) ?? []).length;
  const half = stars.includes('½') ? 0.5 : 0;
  return full + half;
}

/** Best-effort watchlist fetcher. Letterboxd also exposes a separate watchlist
 *  RSS at /<user>/watchlist/rss/ on some accounts. We try it and swallow failures. */
export async function fetchUserWatchlist(
  username: string,
): Promise<LetterboxdEntry[]> {
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  const rssUrl = `${LETTERBOXD_BASE}/${encodeURIComponent(clean)}/watchlist/rss/`;
  try {
    const items = await fetchRssItems(rssUrl);
    const entries: LetterboxdEntry[] = [];
    for (const i of items) {
      const slug = extractLetterboxdSlug(i.link ?? '');
      const title = (i.title ?? '').replace(/^watchlist:\s*/i, '').trim();
      if (!title) continue;
      entries.push({
        kind: 'watchlist',
        title,
        letterboxdSlug: slug,
      });
    }
    return entries;
  } catch {
    return [];
  }
}
