// Central place to read Vite env vars with sensible defaults so the rest of
// the app never reads import.meta.env directly.

const env = import.meta.env;

type LegacyAdapter = 'rss2json' | 'allorigins' | 'custom';
type LetterboxdProxyMode = 'auto' | 'custom';

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const legacyAdapter = env.VITE_RSS_ADAPTER as LegacyAdapter | undefined;

export const LETTERBOXD_PROXY_MODE: LetterboxdProxyMode =
  env.VITE_LETTERBOXD_PROXY_MODE === 'custom' || legacyAdapter === 'custom'
    ? 'custom'
    : 'auto';

export const LETTERBOXD_PROXY_BASE_URL: string =
  env.VITE_LETTERBOXD_PROXY_BASE_URL ??
  env.VITE_RSS_BASE_URL ??
  '';

export const ENABLE_PUBLIC_PROXY_FALLBACKS = readBoolean(
  env.VITE_ENABLE_PUBLIC_PROXY_FALLBACKS,
  legacyAdapter === 'allorigins' || legacyAdapter === 'rss2json',
);

// Deprecated aliases kept for one migration pass while old deployments and docs
// move over to the Letterboxd-specific naming.
export const RSS_ADAPTER: LegacyAdapter =
  LETTERBOXD_PROXY_MODE === 'custom' ? 'custom' : 'allorigins';
export const RSS_BASE_URL: string = LETTERBOXD_PROXY_BASE_URL;
export const APP_BASE_PATH: string = env.VITE_APP_BASE_PATH ?? '/';
