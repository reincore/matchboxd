// Central place to read Vite env vars with sensible defaults so the rest of
// the app never reads import.meta.env directly.

const env = import.meta.env;

export const TMDB_API_KEY: string = env.VITE_TMDB_API_KEY ?? '';
export const RSS_ADAPTER: 'rss2json' | 'allorigins' | 'custom' =
  (env.VITE_RSS_ADAPTER as 'rss2json' | 'allorigins' | 'custom') || 'rss2json';
export const RSS_BASE_URL: string = env.VITE_RSS_BASE_URL ?? '';
export const APP_BASE_PATH: string = env.VITE_APP_BASE_PATH ?? '/matchboxd/';

export const HAS_TMDB = TMDB_API_KEY.length > 0;
