// TMDB API client. Client-side only. Key is exposed at runtime by design.
//
// We keep the surface minimal: search, movie details, discover, watch providers.

import { TMDB_GENRE_MAP } from '../data/genres';
import type { WatchProvider } from '../types';
import { HAS_TMDB, TMDB_API_KEY } from '../utils/env';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

export interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

export interface TmdbMovieDetails extends TmdbMovie {
  credits?: {
    crew?: { job: string; name: string }[];
  };
}

export interface TmdbProvidersResponse {
  results?: Record<
    string,
    {
      link?: string;
      flatrate?: TmdbProviderEntry[];
      rent?: TmdbProviderEntry[];
      buy?: TmdbProviderEntry[];
      free?: TmdbProviderEntry[];
      ads?: TmdbProviderEntry[];
    }
  >;
}

interface TmdbProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
}

export class TmdbError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== '') url.searchParams.set(k, v);
  }
  return url.toString();
}

async function tmdbFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) {
      throw new TmdbError('TMDB auth failed. Check VITE_TMDB_API_KEY.', 401);
    }
    if (res.status === 429) {
      throw new TmdbError('TMDB rate limit hit. Try again shortly.', 429);
    }
    throw new TmdbError(`TMDB request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export function posterUrl(path?: string | null, size: 'w342' | 'w500' = 'w500'): string | undefined {
  if (!path) return undefined;
  return `${IMG_BASE}/${size}${path}`;
}

export function backdropUrl(path?: string | null, size: 'w780' | 'w1280' = 'w1280'): string | undefined {
  if (!path) return undefined;
  return `${IMG_BASE}/${size}${path}`;
}

/** Search TMDB movies by title + optional year. */
export async function searchMovie(
  title: string,
  year?: number,
): Promise<TmdbMovie | undefined> {
  if (!HAS_TMDB) return undefined;
  const url = buildUrl('/search/movie', {
    query: title,
    year: year ? String(year) : '',
    include_adult: 'false',
  });
  try {
    const data = await tmdbFetch<{ results: TmdbMovie[] }>(url);
    return data.results?.[0];
  } catch {
    return undefined;
  }
}

/** Get full movie details including credits. */
export async function getMovieDetails(
  tmdbId: number,
): Promise<TmdbMovieDetails | undefined> {
  if (!HAS_TMDB) return undefined;
  const url = buildUrl(`/movie/${tmdbId}`, { append_to_response: 'credits' });
  try {
    return await tmdbFetch<TmdbMovieDetails>(url);
  } catch {
    return undefined;
  }
}

/** Get TR watch providers for a movie. */
export async function getTrWatchProviders(
  tmdbId: number,
): Promise<WatchProvider[]> {
  if (!HAS_TMDB) return [];
  const url = buildUrl(`/movie/${tmdbId}/watch/providers`);
  try {
    const data = await tmdbFetch<TmdbProvidersResponse>(url);
    const tr = data.results?.TR;
    if (!tr) return [];
    const out: WatchProvider[] = [];
    const pushAll = (
      list: TmdbProviderEntry[] | undefined,
      type: WatchProvider['type'],
    ) => {
      if (!list) return;
      for (const p of list) {
        out.push({
          providerId: p.provider_id,
          providerName: p.provider_name,
          logoPath: p.logo_path,
          type,
        });
      }
    };
    pushAll(tr.flatrate, 'flatrate');
    pushAll(tr.free, 'free');
    pushAll(tr.ads, 'ads');
    pushAll(tr.rent, 'rent');
    pushAll(tr.buy, 'buy');
    return out;
  } catch {
    return [];
  }
}

/** TMDB discover for generating fresh candidates. */
export async function discoverMovies(opts: {
  withGenres?: number[];
  withoutGenres?: number[];
  releaseYearGte?: number;
  releaseYearLte?: number;
  runtimeGte?: number;
  runtimeLte?: number;
  voteCountGte?: number;
  sortBy?: string;
  page?: number;
}): Promise<TmdbMovie[]> {
  if (!HAS_TMDB) return [];
  const params: Record<string, string> = {
    include_adult: 'false',
    include_video: 'false',
    language: 'en-US',
    sort_by: opts.sortBy ?? 'popularity.desc',
    page: String(opts.page ?? 1),
    'vote_count.gte': String(opts.voteCountGte ?? 200),
  };
  if (opts.withGenres?.length)
    params.with_genres = opts.withGenres.join(',');
  if (opts.withoutGenres?.length)
    params.without_genres = opts.withoutGenres.join(',');
  if (opts.releaseYearGte)
    params['primary_release_date.gte'] = `${opts.releaseYearGte}-01-01`;
  if (opts.releaseYearLte)
    params['primary_release_date.lte'] = `${opts.releaseYearLte}-12-31`;
  if (opts.runtimeGte) params['with_runtime.gte'] = String(opts.runtimeGte);
  if (opts.runtimeLte) params['with_runtime.lte'] = String(opts.runtimeLte);

  const url = buildUrl('/discover/movie', params);
  try {
    const data = await tmdbFetch<{ results: TmdbMovie[] }>(url);
    return data.results ?? [];
  } catch {
    return [];
  }
}

/** Convert genre ids to names (for TMDB entries returned from search/discover). */
export function genreNames(ids: number[] | undefined): string[] {
  if (!ids) return [];
  return ids.map((id) => TMDB_GENRE_MAP[id]).filter(Boolean);
}

/** Extract directors from TMDB credits.crew. */
export function extractDirectors(details?: TmdbMovieDetails): string[] {
  if (!details?.credits?.crew) return [];
  return details.credits.crew
    .filter((c) => c.job === 'Director')
    .map((c) => c.name);
}
