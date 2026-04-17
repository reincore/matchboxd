import { setCountryFromHeader } from '../countryDetection';
import {
  ENABLE_PUBLIC_PROXY_FALLBACKS,
  LETTERBOXD_PROXY_BASE_URL,
  LETTERBOXD_PROXY_MODE,
} from '../../utils/env';
import { FETCH_TIMEOUT_MS, LetterboxdScrapeError, delay } from './shared';

interface ProxyAdapter {
  name: string;
  build: (targetUrl: string) => string;
}

const PUBLIC_PROXY_ADAPTERS: ProxyAdapter[] = [
  {
    name: 'codetabs',
    build: (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  },
  {
    name: 'corsproxy.io',
    build: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  },
  {
    name: 'allorigins',
    build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  },
];

const PROXY_COOLDOWNS = new Map<string, number>();
const PROXY_LAST_REQUEST = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const FAST_PROXY_GAP_MS = 150;
const PUBLIC_PROXY_GAP_MS = 1200;
const FAST_PROXIES = new Set(['local', 'cfworker', 'custom']);
const HTML_CACHE = new Map<string, string>();
const IN_FLIGHT = new Map<string, Promise<string>>();
const SESSION_PREFIX = 'matchboxd:html:';
const SESSION_TTL_MS = 30 * 60 * 1000;

function isLocalhost(): boolean {
  return typeof window !== 'undefined' && window.location.hostname === 'localhost';
}

function controlledProxies(): ProxyAdapter[] {
  const proxies: ProxyAdapter[] = [];

  if (LETTERBOXD_PROXY_MODE === 'custom' && LETTERBOXD_PROXY_BASE_URL) {
    proxies.push({
      name: 'custom',
      build: (url) => {
        const separator = LETTERBOXD_PROXY_BASE_URL.includes('?') ? '&' : '?';
        return `${LETTERBOXD_PROXY_BASE_URL}${separator}url=${encodeURIComponent(url)}`;
      },
    });
  }

  if (isLocalhost()) {
    proxies.push({
      name: 'local',
      build: (url) => `http://localhost:8787/?url=${encodeURIComponent(url)}`,
    });
  }

  proxies.push({
    name: 'cfworker',
    build: (url) => `https://matchboxd-proxy.reincore.workers.dev/?url=${encodeURIComponent(url)}`,
  });

  return dedupeByName(proxies);
}

function dedupeByName(proxies: ProxyAdapter[]): ProxyAdapter[] {
  const seen = new Set<string>();
  return proxies.filter((proxy) => {
    if (seen.has(proxy.name)) return false;
    seen.add(proxy.name);
    return true;
  });
}

function proxyChain(): ProxyAdapter[] {
  const base = controlledProxies();
  return ENABLE_PUBLIC_PROXY_FALLBACKS
    ? [...base, ...PUBLIC_PROXY_ADAPTERS]
    : base;
}

function sortedProxies(): ProxyAdapter[] {
  const now = Date.now();
  const chain = proxyChain();
  const available = chain.filter((proxy) => {
    const cooldown = PROXY_COOLDOWNS.get(proxy.name);
    return !cooldown || now - cooldown > COOLDOWN_MS;
  });
  const cooledDown = chain.filter((proxy) => {
    const cooldown = PROXY_COOLDOWNS.get(proxy.name);
    return cooldown !== undefined && now - cooldown <= COOLDOWN_MS;
  });
  return [...available, ...cooledDown];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function acquireSlot(proxyName: string): Promise<void> {
  const gap =
    FAST_PROXIES.has(proxyName) || isLocalhost()
      ? FAST_PROXY_GAP_MS
      : PUBLIC_PROXY_GAP_MS;
  const now = Date.now();
  const last = PROXY_LAST_REQUEST.get(proxyName) ?? 0;
  const next = Math.max(now, last + gap);
  PROXY_LAST_REQUEST.set(proxyName, next);

  if (next > now) {
    await delay(next - now);
  }
}

function readFromSession(url: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + url);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; body: string };
    return Date.now() - parsed.ts <= SESSION_TTL_MS ? parsed.body : null;
  } catch {
    return null;
  }
}

function writeToSession(url: string, body: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(
      SESSION_PREFIX + url,
      JSON.stringify({ ts: Date.now(), body }),
    );
  } catch {
    // Ignore storage quota failures and keep the in-memory cache.
  }
}

function looksRateLimited(body: string): boolean {
  if (!body) return true;

  const head = body.slice(0, 2000).toLowerCase();
  return (
    head.includes('error code: 1015') ||
    head.includes('error code: 1020') ||
    head.includes('attention required') ||
    head.includes('cloudflare</title>') ||
    head.includes('just a moment') ||
    head.includes('ratelimited')
  );
}

export function looksPrivate(body: string): boolean {
  const lower = body.toLowerCase();
  return lower.includes('watchlist is private') || lower.includes('list is private');
}

function looksLikeLetterboxd(body: string): boolean {
  return body.includes('letterboxd.com') && (
    body.includes('data-item-slug') ||
    body.includes('og:site_name') ||
    body.includes('application/ld+json') ||
    body.includes('id="film-page-wrapper"') ||
    body.includes('paginate-page')
  );
}

export async function fetchHtml(
  targetUrl: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<string> {
  const memoryHit = HTML_CACHE.get(targetUrl);
  if (memoryHit) return memoryHit;

  const sessionHit = readFromSession(targetUrl);
  if (sessionHit) {
    HTML_CACHE.set(targetUrl, sessionHit);
    return sessionHit;
  }

  const inFlight = IN_FLIGHT.get(targetUrl);
  if (inFlight) return inFlight;

  const request = (async () => {
    const MAX_ROUNDS = 2;
    let lastError: unknown;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      if (round > 0) {
        PROXY_COOLDOWNS.clear();
        await delay(3000);
      }

      for (const proxy of sortedProxies()) {
        try {
          await acquireSlot(proxy.name);
          const response = await fetchWithTimeout(proxy.build(targetUrl), timeoutMs);

          if (!response.ok) {
            if (response.status === 404) {
              throw new LetterboxdScrapeError(
                `Letterboxd returned 404 for ${targetUrl}`,
                'not-found',
              );
            }

            PROXY_COOLDOWNS.set(proxy.name, Date.now());
            lastError = new LetterboxdScrapeError(
              `${proxy.name} returned ${response.status} for ${targetUrl}`,
              'unknown',
            );

            if (response.status === 429 || response.status === 503) {
              await delay(1200);
            }
            continue;
          }

          if (proxy.name === 'cfworker' || proxy.name === 'custom') {
            setCountryFromHeader(response);
          }

          const body = await response.text();
          if (body.length < 500 || looksRateLimited(body) || !looksLikeLetterboxd(body)) {
            lastError = new LetterboxdScrapeError(
              `${proxy.name} returned rate-limit/empty for ${targetUrl}`,
            );
            await delay(800);
            continue;
          }

          HTML_CACHE.set(targetUrl, body);
          writeToSession(targetUrl, body);
          return body;
        } catch (error) {
          if (error instanceof LetterboxdScrapeError && error.code === 'not-found') {
            throw error;
          }

          PROXY_COOLDOWNS.set(proxy.name, Date.now());
          lastError = error;
          await delay(400);
        }
      }
    }

    throw new LetterboxdScrapeError(
      `All proxies failed for ${targetUrl}`,
      'unknown',
      lastError,
    );
  })();

  IN_FLIGHT.set(targetUrl, request);

  try {
    return await request;
  } finally {
    IN_FLIGHT.delete(targetUrl);
  }
}

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

export function resetProxyClientState(): void {
  PROXY_COOLDOWNS.clear();
  PROXY_LAST_REQUEST.clear();
  HTML_CACHE.clear();
  IN_FLIGHT.clear();

  if (typeof window !== 'undefined') {
    try {
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith(SESSION_PREFIX)) {
          window.sessionStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage access errors during tests.
    }
  }
}
