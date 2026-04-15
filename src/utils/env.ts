// Central place to read Vite env vars with sensible defaults so the rest of
// the app never reads import.meta.env directly.

const env = import.meta.env;

// Default to allorigins because we need to scrape Letterboxd HTML pages
// (watchlists + film details), and rss2json only handles RSS.
export const RSS_ADAPTER: 'rss2json' | 'allorigins' | 'custom' =
  (env.VITE_RSS_ADAPTER as 'rss2json' | 'allorigins' | 'custom') || 'allorigins';
export const RSS_BASE_URL: string = env.VITE_RSS_BASE_URL ?? '';
export const APP_BASE_PATH: string = env.VITE_APP_BASE_PATH ?? '/';
