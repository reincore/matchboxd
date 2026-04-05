// Given two taste profiles + filters, produce ~15 candidate movies annotated
// with category, score, confidence, reasons, and optional ownership.

import { FALLBACK_MOVIES, type SeedMovie } from '../data/fallbackMovies';
import { TMDB_NAME_TO_ID } from '../data/genres';
import type {
  FilterSelection,
  MovieCandidate,
  RecommendationCategory,
  RecommendationKind,
  TasteProfile,
} from '../types';
import { HAS_TMDB } from '../utils/env';
import { titleYearId } from '../utils/slug';
import {
  buildReasons,
  confidenceForCandidate,
  scoreCandidate,
  type CandidateAttrs,
} from './scoring';
import {
  discoverMovies,
  genreNames,
  getMovieDetails,
  extractDirectors,
  getTrWatchProviders,
  posterUrl,
  backdropUrl,
  searchMovie,
  type TmdbMovie,
} from './tmdb';

const TARGET_COUNT = 15;

export interface EngineOptions {
  wantProviders: boolean; // usually tied to 'available-tr' constraint
}

export async function generateCandidates(
  profileA: TasteProfile,
  profileB: TasteProfile,
  filters: FilterSelection,
): Promise<MovieCandidate[]> {
  const wantProviders = filters.constraints.includes('available-tr');
  const opts: EngineOptions = { wantProviders };

  const candidates: MovieCandidate[] = [];
  const seenKeys = new Set<string>();

  const add = (c: MovieCandidate) => {
    const key = c.tmdbId ? `t${c.tmdbId}` : c.id;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    candidates.push(c);
  };

  // 1. Deterministic: watchlist overlap.
  for (const slug of profileA.watchlistSlugs) {
    if (profileB.watchlistSlugs.has(slug)) {
      const c = await buildFromSlug(slug, 'watchlist-overlap', 'deterministic', profileA, profileB, filters, opts);
      if (c) add(c);
      if (candidates.length >= TARGET_COUNT) break;
    }
  }

  // 2. Deterministic: rewatch (seen by both, both high rated).
  for (const slug of profileA.highRatedSlugs) {
    if (profileB.highRatedSlugs.has(slug)) {
      const c = await buildFromSlug(slug, 'rewatch', 'deterministic', profileA, profileB, filters, opts);
      if (c) add(c);
      if (candidates.length >= TARGET_COUNT) break;
    }
  }

  // 3. Inferred: taste-match via TMDB discover (when we have profile data + key).
  if (HAS_TMDB && candidates.length < TARGET_COUNT) {
    const tasteMatches = await discoverForProfiles(profileA, profileB, filters, opts);
    for (const c of tasteMatches) {
      add(c);
      if (candidates.length >= TARGET_COUNT) break;
    }
  }

  // 4. Inferred: stretch picks — one for each person's zone if we have room.
  if (HAS_TMDB && candidates.length < TARGET_COUNT) {
    const stretchA = await discoverStretch(profileA, profileB, filters, 'userA', opts);
    const stretchB = await discoverStretch(profileB, profileA, filters, 'userB', opts);
    for (const c of [...stretchA, ...stretchB]) {
      add(c);
      if (candidates.length >= TARGET_COUNT) break;
    }
  }

  // 5. Fallback seed pool — fills gaps and cold-starts.
  if (candidates.length < TARGET_COUNT) {
    const seeds = await buildFromSeeds(FALLBACK_MOVIES, profileA, profileB, filters, opts);
    for (const c of seeds) {
      add(c);
      if (candidates.length >= TARGET_COUNT) break;
    }
  }

  // Trim and sort: exclude hard-filtered, sort by score desc, cap at target.
  const final = candidates
    .filter((c) => c.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, TARGET_COUNT);

  return final;
}

/** When we only have a letterboxd slug, approximate title from it. */
async function buildFromSlug(
  slug: string,
  category: RecommendationCategory,
  kind: RecommendationKind,
  profileA: TasteProfile,
  profileB: TasteProfile,
  filters: FilterSelection,
  opts: EngineOptions,
): Promise<MovieCandidate | null> {
  const title = slug
    .replace(/-/g, ' ')
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
  // Try to resolve via TMDB.
  const tmdb = HAS_TMDB ? await searchMovie(title) : undefined;
  return buildFromTmdb(tmdb, title, undefined, slug, category, kind, profileA, profileB, filters, opts);
}

async function discoverForProfiles(
  profileA: TasteProfile,
  profileB: TasteProfile,
  filters: FilterSelection,
  opts: EngineOptions,
): Promise<MovieCandidate[]> {
  // Use overlap of each person's top genres; if no overlap, fall back to union.
  const topA = top3(profileA.genreAffinity);
  const topB = top3(profileB.genreAffinity);
  const overlap = topA.filter((g) => topB.includes(g));
  const pickedGenres = (overlap.length ? overlap : [...new Set([...topA, ...topB])]).slice(0, 2);
  const genreIds = pickedGenres.map((g) => TMDB_NAME_TO_ID[g]).filter(Boolean);

  const withoutIds: number[] = [];
  if (filters.constraints.includes('no-horror')) {
    const id = TMDB_NAME_TO_ID['Horror'];
    if (id) withoutIds.push(id);
  }
  if (filters.constraints.includes('no-animation')) {
    const id = TMDB_NAME_TO_ID['Animation'];
    if (id) withoutIds.push(id);
  }

  const runtimeGte = filters.constraints.includes('long-runtime') ? 130 : undefined;
  const runtimeLte = filters.constraints.includes('short-runtime') ? 105 : undefined;
  const yearGte = filters.constraints.includes('modern') ? 2015 : undefined;
  const yearLte = filters.constraints.includes('classic') ? 1999 : undefined;

  const raw = await discoverMovies({
    withGenres: genreIds,
    withoutGenres: withoutIds,
    runtimeGte,
    runtimeLte,
    releaseYearGte: yearGte,
    releaseYearLte: yearLte,
    voteCountGte: 400,
    sortBy: 'popularity.desc',
    page: 1,
  });

  const out: MovieCandidate[] = [];
  for (const m of raw.slice(0, 20)) {
    // Skip anything either user has already seen.
    const c = await buildFromTmdbMovie(m, 'taste-match', 'inferred', profileA, profileB, filters, opts);
    if (c) out.push(c);
  }
  return out;
}

async function discoverStretch(
  primary: TasteProfile,
  _other: TasteProfile,
  filters: FilterSelection,
  ownership: 'userA' | 'userB',
  _opts: EngineOptions,
): Promise<MovieCandidate[]> {
  const top = top3(primary.genreAffinity);
  const genreIds = top.map((g) => TMDB_NAME_TO_ID[g]).filter(Boolean).slice(0, 1);
  if (!genreIds.length) return [];

  const withoutIds: number[] = [];
  if (filters.constraints.includes('no-horror')) {
    const id = TMDB_NAME_TO_ID['Horror'];
    if (id) withoutIds.push(id);
  }
  if (filters.constraints.includes('no-animation')) {
    const id = TMDB_NAME_TO_ID['Animation'];
    if (id) withoutIds.push(id);
  }

  const raw = await discoverMovies({
    withGenres: genreIds,
    withoutGenres: withoutIds,
    voteCountGte: 600,
    sortBy: 'vote_average.desc',
    page: 2,
  });

  const out: MovieCandidate[] = [];
  for (const m of raw.slice(0, 6)) {
    const c = await buildFromTmdbMovie(m, 'stretch-pick', 'inferred', primary, primary, filters, { wantProviders: false });
    if (!c) continue;
    c.ownership = ownership;
    // Rewrite reasons so stretch picks read accurately.
    c.explanationReasons = [
      `closer to ${ownership === 'userA' ? primary.username : primary.username}'s taste zone`,
      ...c.explanationReasons.slice(1),
    ];
    out.push(c);
  }
  return out;
}

async function buildFromTmdbMovie(
  m: TmdbMovie,
  category: RecommendationCategory,
  kind: RecommendationKind,
  profileA: TasteProfile,
  profileB: TasteProfile,
  filters: FilterSelection,
  opts: EngineOptions,
): Promise<MovieCandidate | null> {
  return buildFromTmdb(m, m.title, m.release_date ? Number(m.release_date.slice(0, 4)) : undefined, undefined, category, kind, profileA, profileB, filters, opts);
}

async function buildFromTmdb(
  tmdb: TmdbMovie | undefined,
  fallbackTitle: string,
  fallbackYear: number | undefined,
  letterboxdSlug: string | undefined,
  category: RecommendationCategory,
  kind: RecommendationKind,
  profileA: TasteProfile,
  profileB: TasteProfile,
  filters: FilterSelection,
  opts: EngineOptions,
): Promise<MovieCandidate | null> {
  let title = fallbackTitle;
  let year = fallbackYear;
  let synopsis: string | undefined;
  let poster: string | undefined;
  let backdrop: string | undefined;
  let genres: string[] = [];
  let runtime: number | undefined;
  let directors: string[] = [];
  let tmdbId: number | undefined;
  let providersTR: MovieCandidate['providersTR'] = [];

  if (tmdb) {
    tmdbId = tmdb.id;
    title = tmdb.title || fallbackTitle;
    year = tmdb.release_date ? Number(tmdb.release_date.slice(0, 4)) : fallbackYear;
    synopsis = tmdb.overview;
    poster = posterUrl(tmdb.poster_path);
    backdrop = backdropUrl(tmdb.backdrop_path);
    genres = tmdb.genres ? tmdb.genres.map((g) => g.name) : genreNames(tmdb.genre_ids);

    // Details for runtime + directors.
    const details = await getMovieDetails(tmdb.id);
    if (details) {
      runtime = details.runtime ?? runtime;
      directors = extractDirectors(details);
      if (!genres.length && details.genres)
        genres = details.genres.map((g) => g.name);
    }

    if (opts.wantProviders) {
      providersTR = await getTrWatchProviders(tmdb.id);
    }
  }

  const attrs: CandidateAttrs & { hasTrProvider?: boolean } = {
    genres,
    directors,
    year,
    runtime,
    hasTrProvider: providersTR && providersTR.length > 0,
  };
  const score = scoreCandidate({ attrs, profileA, profileB, filters });
  if (score.excluded) return null;

  const id = tmdbId ? `tmdb-${tmdbId}` : titleYearId(title, year);
  const reasons = buildReasons(attrs, profileA, profileB, score, filters);
  const candidate: MovieCandidate = {
    id,
    tmdbId,
    letterboxdSlug,
    title,
    year,
    posterUrl: poster,
    backdropUrl: backdrop,
    synopsis,
    genres,
    runtime,
    directors,
    providersTR,
    userAState: 'pending',
    userBState: 'pending',
    recommendationCategory: category,
    recommendationKind: kind,
    confidence: 'moderate',
    explanationReasons: reasons,
    moodFit: score.moodFit,
    availabilityFit: score.availabilityFit,
    finalScore: score.finalScore,
    ownership: category === 'stretch-pick' ? score.ownership : undefined,
  };
  candidate.confidence = confidenceForCandidate(candidate, profileA, profileB);
  return candidate;
}

async function buildFromSeeds(
  seeds: SeedMovie[],
  profileA: TasteProfile,
  profileB: TasteProfile,
  filters: FilterSelection,
  opts: EngineOptions,
): Promise<MovieCandidate[]> {
  // Pre-filter seeds by mood tag if possible — keeps candidate pool on-vibe.
  let pool = seeds;
  if (filters.mood) {
    const onVibe = seeds.filter((s) => s.moodTags.includes(filters.mood!));
    if (onVibe.length >= 6) pool = onVibe;
  }

  const out: MovieCandidate[] = [];
  for (const s of pool) {
    let tmdb: TmdbMovie | undefined;
    if (HAS_TMDB) {
      tmdb = s.tmdbId
        ? ({
            id: s.tmdbId,
            title: s.title,
            release_date: `${s.year}-01-01`,
          } as TmdbMovie)
        : await searchMovie(s.title, s.year);
    }

    const attrs: CandidateAttrs = {
      genres: s.genres,
      directors: s.directors,
      year: s.year,
      runtime: s.runtime,
    };
    const score = scoreCandidate({ attrs, profileA, profileB, filters });
    if (score.excluded) continue;

    let poster: string | undefined;
    let backdrop: string | undefined;
    let synopsis: string | undefined = s.blurb;
    let providersTR: MovieCandidate['providersTR'] = [];

    if (tmdb && HAS_TMDB) {
      const details = await getMovieDetails(tmdb.id);
      poster = posterUrl(tmdb.poster_path ?? details?.poster_path ?? null);
      backdrop = backdropUrl(tmdb.backdrop_path ?? details?.backdrop_path ?? null);
      synopsis = details?.overview ?? tmdb.overview ?? s.blurb;
      if (opts.wantProviders) {
        providersTR = await getTrWatchProviders(tmdb.id);
      }
    }

    const id = tmdb?.id ? `tmdb-${tmdb.id}` : titleYearId(s.title, s.year);
    const reasons = buildReasons(attrs, profileA, profileB, score, filters);
    // Add a gentle "consensus pick" tag for seed fallbacks.
    if (profileA.confidence === 'exploratory' || profileB.confidence === 'exploratory') {
      reasons.unshift('broadly loved, safe start');
    }

    const candidate: MovieCandidate = {
      id,
      tmdbId: tmdb?.id,
      title: s.title,
      year: s.year,
      posterUrl: poster,
      backdropUrl: backdrop,
      synopsis,
      genres: s.genres,
      runtime: s.runtime,
      directors: s.directors,
      providersTR,
      userAState: 'pending',
      userBState: 'pending',
      recommendationCategory: 'taste-match',
      recommendationKind: 'inferred',
      confidence: 'exploratory',
      explanationReasons: reasons.slice(0, 4),
      moodFit: score.moodFit,
      availabilityFit: score.availabilityFit,
      finalScore: score.finalScore,
    };
    out.push(candidate);
  }
  return out;
}

function top3(rec: Record<string, number>): string[] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
}
