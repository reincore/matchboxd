/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LETTERBOXD_PROXY_MODE?: 'auto' | 'custom';
  readonly VITE_LETTERBOXD_PROXY_BASE_URL?: string;
  readonly VITE_ENABLE_PUBLIC_PROXY_FALLBACKS?: string;
  readonly VITE_RSS_ADAPTER?: 'rss2json' | 'allorigins' | 'custom';
  readonly VITE_RSS_BASE_URL?: string;
  readonly VITE_APP_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
