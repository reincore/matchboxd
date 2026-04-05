/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_RSS_ADAPTER?: 'rss2json' | 'allorigins' | 'custom';
  readonly VITE_RSS_BASE_URL?: string;
  readonly VITE_APP_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
