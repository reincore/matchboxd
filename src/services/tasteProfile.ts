// Build a taste profile from a user's Letterboxd activity + optional TMDB
// enrichment to attach genres/directors/decades to each entry.

import type { LetterboxdEntry, TasteProfile } from '../types';
import { searchMovie, getMovieDetails, genreNames, extractDirectors } from './tmdb';
import { confidenceFromSignals } from '../utils/confidence';

interface EnrichedEntry extends LetterboxdEntry {
  genres?: string[];
  directors?: string[];
  decade?: string;
}

/** Enrich up to `limit` entries with TMDB metadata. The rest keep raw info. */
async function enrichEntries(
  entries: LetterboxdEntry[],
  limit = 20,
): Promise<EnrichedEntry[]> {
  const rated = entries
    .filter((e) => e.rating !== undefined)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const pool = [...rated, ...entries.filter((e) => e.rating === undefined)].slice(0, limit);
  const poolIds = new Set(pool.map((e) => `${e.title}|${e.year ?? ''}`));

  const enriched = await Promise.all(
    pool.map(async (e): Promise<EnrichedEntry> => {
      const tmdb = await searchMovie(e.title, e.year);
      if (!tmdb) return e;
      const details = await getMovieDetails(tmdb.id);
      const genres = details?.genres?.map((g) => g.name) ?? genreNames(tmdb.genre_ids);
      const directors = extractDirectors(details);
      const releaseYear = (details?.release_date ?? tmdb.release_date ?? '').slice(0, 4);
      const decade = releaseYear ? `${Math.floor(Number(releaseYear) / 10) * 10}` : undefined;
      return { ...e, genres, directors, decade };
    }),
  );

  // Non-enriched entries still count for signal volume.
  const untouched = entries
    .filter((e) => !poolIds.has(`${e.title}|${e.year ?? ''}`))
    .map((e) => e as EnrichedEntry);

  return [...enriched, ...untouched];
}

export async function buildTasteProfile(
  username: string,
  entries: LetterboxdEntry[],
): Promise<TasteProfile> {
  const enriched = await enrichEntries(entries);

  const genreAffinity: Record<string, number> = {};
  const decadeAffinity: Record<string, number> = {};
  const directorAffinity: Record<string, number> = {};
  const watchlistSlugs = new Set<string>();
  const seenSlugs = new Set<string>();
  const highRatedSlugs = new Set<string>();

  let ratedCount = 0;
  let ratingSum = 0;

  const topTitlesList: Array<{ title: string; rating: number }> = [];

  for (const e of enriched) {
    if (e.letterboxdSlug) {
      if (e.kind === 'watchlist') watchlistSlugs.add(e.letterboxdSlug);
      else seenSlugs.add(e.letterboxdSlug);
      if (e.rating !== undefined && e.rating >= 3.5)
        highRatedSlugs.add(e.letterboxdSlug);
    }

    if (e.rating !== undefined) {
      ratedCount += 1;
      ratingSum += e.rating;
      if (e.rating >= 4) {
        topTitlesList.push({ title: e.title, rating: e.rating });
      }
    }

    // Weighted signal: rated entries weigh by (rating / 5), unrated by 0.35.
    const weight = e.rating !== undefined ? Math.max(0.1, e.rating / 5) : 0.35;

    for (const g of e.genres ?? []) {
      genreAffinity[g] = (genreAffinity[g] ?? 0) + weight;
    }
    for (const d of e.directors ?? []) {
      directorAffinity[d] = (directorAffinity[d] ?? 0) + weight;
    }
    if (e.decade) {
      decadeAffinity[e.decade] = (decadeAffinity[e.decade] ?? 0) + weight;
    }
  }

  normalize(genreAffinity);
  normalize(decadeAffinity);
  normalize(directorAffinity);

  const averageRating = ratedCount > 0 ? ratingSum / ratedCount : 0;

  const topTitles = topTitlesList
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map((t) => t.title);

  const signalCount = entries.length + ratedCount + watchlistSlugs.size;

  return {
    username,
    fetched: true,
    entryCount: entries.length,
    ratedCount,
    averageRating,
    genreAffinity,
    decadeAffinity,
    directorAffinity,
    watchlistSlugs,
    seenSlugs,
    highRatedSlugs,
    topTitles,
    confidence: confidenceFromSignals(signalCount),
  };
}

export function emptyProfile(username: string): TasteProfile {
  return {
    username,
    fetched: false,
    entryCount: 0,
    ratedCount: 0,
    averageRating: 0,
    genreAffinity: {},
    decadeAffinity: {},
    directorAffinity: {},
    watchlistSlugs: new Set(),
    seenSlugs: new Set(),
    highRatedSlugs: new Set(),
    topTitles: [],
    confidence: 'exploratory',
  };
}

function normalize(rec: Record<string, number>): void {
  const max = Math.max(0, ...Object.values(rec));
  if (max === 0) return;
  for (const k of Object.keys(rec)) rec[k] = rec[k] / max;
}
