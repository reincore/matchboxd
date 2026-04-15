// Scrape public Letterboxd pages through a CORS proxy. This gives us posters,
// ratings, runtime, genres, and directors WITHOUT requiring a TMDB key.
//
// Pages we read:
//   https://letterboxd.com/<user>/watchlist/           (paginated)
//   https://letterboxd.com/<user>/films/               (paginated, watched list)
//   https://letterboxd.com/film/<slug>/                (per-film details)
//
// These are all publicly accessible and Letterboxd serves them to anonymous
// visitors. The only reason we need a proxy is browser CORS.

import { RSS_ADAPTER, RSS_BASE_URL } from '../utils/env';

const LETTERBOXD_BASE = 'https://letterboxd.com';
const POSTER_WIDTH = 460;
const FETCH_TIMEOUT_MS = 15_000;

export class LetterboxdScrapeError extends Error {
  constructor(
    message: string,
    public code: 'not-found' | 'private' | 'unknown' = 'unknown',
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'LetterboxdScrapeError';
  }
}

/** A list of CORS-friendly HTML proxies. We try them in order until one
 *  works, because each of them goes down or rate-limits unpredictably. */
interface ProxyAdapter {
  name: string;
  build: (targetUrl: string) => string;
}

const DEFAULT_PROXIES: ProxyAdapter[] = [
  // In dev, try our local proxy first (no rate limits!).
  ...(typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? [
        {
          name: 'local',
          build: (u: string) =>
            `http://localhost:8787/?url=${encodeURIComponent(u)}`,
        },
      ]
    : [
        // Production: our own Cloudflare Worker — fast, no shared rate limits,
        // 5-min edge cache. Free tier = 100K req/day.
        {
          name: 'cfworker',
          build: (u: string) =>
            `https://matchboxd-proxy.reincore.workers.dev/?url=${encodeURIComponent(u)}`,
        },
      ]),
  // Public fallbacks in case the Worker is down.
  {
    name: 'codetabs',
    build: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  },
  {
    name: 'corsproxy.io',
    build: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  },
  {
    name: 'allorigins',
    build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  },
];

/** Build the proxy chain we'll try for this request. Honors the `custom`
 *  adapter first when configured. */
function proxyChain(): ProxyAdapter[] {
  if (RSS_ADAPTER === 'custom' && RSS_BASE_URL) {
    const custom: ProxyAdapter = {
      name: 'custom',
      build: (u) => {
        const sep = RSS_BASE_URL.includes('?') ? '&' : '?';
        return `${RSS_BASE_URL}${sep}url=${encodeURIComponent(u)}`;
      },
    };
    return [custom, ...DEFAULT_PROXIES];
  }
  // For any built-in adapter we still try the chain so one flaky proxy
  // doesn't take down the whole session.
  return DEFAULT_PROXIES;
}

// Proxy health tracking: proxies that fail get "cooldown" timestamps.
// We skip a proxy for COOLDOWN_MS after it fails, so we don't waste
// time on unreachable services.
const PROXY_COOLDOWNS = new Map<string, number>();
const COOLDOWN_MS = 60_000; // 1 minute

function sortedProxies(): ProxyAdapter[] {
  const now = Date.now();
  const chain = proxyChain();
  // Partition: usable first, cooled-down last.
  const usable = chain.filter((p) => {
    const cd = PROXY_COOLDOWNS.get(p.name);
    return !cd || now - cd > COOLDOWN_MS;
  });
  const cooled = chain.filter((p) => {
    const cd = PROXY_COOLDOWNS.get(p.name);
    return cd !== undefined && now - cd <= COOLDOWN_MS;
  });
  return [...usable, ...cooled];
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Tiny helper: sleep ms.
const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Per-proxy throttle: each proxy gets its own 1200ms gate so requests to
 *  different proxies can proceed in parallel. Cloudflare rate limits are
 *  per-origin, not per-client, so spreading across proxies is safe. */
const IS_LOCALHOST =
  typeof window !== 'undefined' && window.location.hostname === 'localhost';
/** Per-proxy throttle gaps. Our own proxies (local dev, Cloudflare Worker) can
 *  handle much tighter spacing than shared public proxies. */
const FAST_PROXY_GAP_MS = 150;
const PUBLIC_PROXY_GAP_MS = 1200;
const FAST_PROXIES = new Set(['local', 'cfworker', 'custom']);
const PROXY_LAST_REQUEST = new Map<string, number>();

async function acquireSlot(proxyName: string): Promise<void> {
  const gap = FAST_PROXIES.has(proxyName) || IS_LOCALHOST
    ? FAST_PROXY_GAP_MS
    : PUBLIC_PROXY_GAP_MS;
  const now = Date.now();
  const last = PROXY_LAST_REQUEST.get(proxyName) ?? 0;
  const next = Math.max(now, last + gap);
  const wait = next - now;
  PROXY_LAST_REQUEST.set(proxyName, next);
  if (wait > 0) await delay(wait);
}

/** Detect the Cloudflare rate-limit / challenge bodies some proxies serve
 *  through. When we see one we should treat it as a failure and try the
 *  next proxy or retry later. */
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

function looksPrivate(body: string): boolean {
  const lower = body.toLowerCase();
  return lower.includes('watchlist is private') || lower.includes('list is private');
}

function looksLikeLetterboxd(body: string): boolean {
  // Letterboxd ships their base stylesheet on every page.
  return body.includes('letterboxd.com') && (
    body.includes('data-item-slug') ||
    body.includes('og:site_name') ||
    body.includes('application/ld+json') ||
    body.includes('id="film-page-wrapper"') ||
    body.includes('paginate-page')
  );
}

// Persistent HTML cache, scoped to the current browser tab. StrictMode double
// mounts + repeated navigation are the common case, so caching shaves 50%+
// of requests off.
const HTML_CACHE = new Map<string, string>();
const IN_FLIGHT = new Map<string, Promise<string>>();

const SESSION_PREFIX = 'matchboxd:html:';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function readFromSession(url: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + url);
    if (!raw) return null;
    const { ts, body } = JSON.parse(raw) as { ts: number; body: string };
    if (Date.now() - ts > SESSION_TTL_MS) return null;
    return body;
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
    // storage full — fall back to memory only
  }
}

async function fetchHtml(targetUrl: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  // In-memory
  const cached = HTML_CACHE.get(targetUrl);
  if (cached) return cached;
  // sessionStorage
  const sessionHit = readFromSession(targetUrl);
  if (sessionHit) {
    HTML_CACHE.set(targetUrl, sessionHit);
    return sessionHit;
  }
  // De-dupe in-flight requests
  const existing = IN_FLIGHT.get(targetUrl);
  if (existing) return existing;

  const promise = (async () => {
    const MAX_ROUNDS = 2;
    let lastErr: unknown;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      if (round > 0) {
        // Before retrying, clear cooldowns so every proxy gets another shot,
        // and wait a bit for Cloudflare rate limits to relax.
        PROXY_COOLDOWNS.clear();
        await delay(3000);
      }
      const proxies = sortedProxies();
      for (let attempt = 0; attempt < proxies.length; attempt += 1) {
        const proxy = proxies[attempt];
        try {
          await acquireSlot(proxy.name);
          const res = await fetchWithTimeout(proxy.build(targetUrl), timeoutMs);
          if (!res.ok) {
            if (res.status === 404) {
              throw new LetterboxdScrapeError(
                `Letterboxd returned 404 for ${targetUrl}`,
                'not-found',
              );
            }
            PROXY_COOLDOWNS.set(proxy.name, Date.now());
            lastErr = new LetterboxdScrapeError(
              `${proxy.name} returned ${res.status} for ${targetUrl}`,
              'unknown',
            );
            if (res.status === 429 || res.status === 503) {
              await delay(1200);
            }
            continue;
          }
          const text = await res.text();
          if (text.length < 500 || looksRateLimited(text) || !looksLikeLetterboxd(text)) {
            // Rate-limited body. DON'T cooldown this proxy for long —
            // the rate limit is Letterboxd's edge, not the proxy itself.
            lastErr = new LetterboxdScrapeError(
              `${proxy.name} returned rate-limit/empty for ${targetUrl}`,
            );
            await delay(800);
            continue;
          }
          HTML_CACHE.set(targetUrl, text);
          writeToSession(targetUrl, text);
          return text;
        } catch (err) {
          if (err instanceof LetterboxdScrapeError && err.code === 'not-found') {
            throw err;
          }
          // Network error = proxy genuinely unreachable — cooldown.
          PROXY_COOLDOWNS.set(proxy.name, Date.now());
          lastErr = err;
          await delay(400);
        }
      }
    }
    throw new LetterboxdScrapeError(`All proxies failed for ${targetUrl}`, 'unknown', lastErr);
  })();

  IN_FLIGHT.set(targetUrl, promise);
  try {
    return await promise;
  } finally {
    IN_FLIGHT.delete(targetUrl);
  }
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

// -----------------------------------------------------------------------------
// Watchlist + watched list scraping
// -----------------------------------------------------------------------------

// Cache of slug → Letterboxd film ID, populated during watchlist scraping.
// Cache of slug → metadata from watchlist pages, populated during scraping.
// Used to build instant stubs before detail pages load.
export interface ListPageMeta {
  filmId?: string;
  title?: string;
  year?: number;
  posterUrl?: string;
}
const LIST_PAGE_META = new Map<string, ListPageMeta>();

/** Look up metadata captured from watchlist pages. */
export function getListPageMeta(slug: string): ListPageMeta | undefined {
  return LIST_PAGE_META.get(slug);
}

/** Construct a best-guess poster URL from a Letterboxd film ID and slug.
 *  Works for ~80%+ of films; the Poster component handles 404s gracefully. */
function guessPosterUrl(filmId: string, slug: string, width = 230): string {
  const height = Math.round((width * 3) / 2);
  const path = filmId.split('').join('/');
  return `https://a.ltrbxd.com/resized/film-poster/${path}/${filmId}-${slug}-0-${width}-0-${height}-crop.jpg`;
}

/** Parse "Title Name (2023)" into { title, year }. */
function parseItemName(name: string): { title: string; year?: number } {
  const m = name.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (m) return { title: m[1].trim(), year: Number(m[2]) };
  return { title: name.trim() };
}

/** Extract all film slugs from a watchlist/films-list page. Letterboxd uses
 *  a `data-item-slug` (sometimes `data-film-slug`) attribute on poster cards.
 *  Also extracts metadata (title, year, filmId) into LIST_PAGE_META. */
function extractSlugsFromListPage(doc: Document): string[] {
  const slugs = new Set<string>();

  /** Capture metadata for a slug from the DOM node's attributes. */
  function captureMeta(slug: string, node: Element): void {
    const filmId = node.getAttribute('data-film-id') ?? undefined;
    const itemName = node.getAttribute('data-item-name') ?? undefined;
    const parsed = itemName ? parseItemName(itemName) : undefined;
    const posterUrl = filmId ? guessPosterUrl(filmId, slug, POSTER_WIDTH) : undefined;
    LIST_PAGE_META.set(slug, {
      filmId,
      title: parsed?.title,
      year: parsed?.year,
      posterUrl,
    });
  }

  // Primary selector: modern poster component exposes data-item-slug.
  doc.querySelectorAll('[data-item-slug]').forEach((node) => {
    const s = node.getAttribute('data-item-slug');
    if (s) {
      const slug = s.toLowerCase();
      slugs.add(slug);
      captureMeta(slug, node);
    }
  });
  // Legacy selector seen on some pages.
  doc.querySelectorAll('[data-film-slug]').forEach((node) => {
    const s = node.getAttribute('data-film-slug');
    if (s) {
      const slug = s.toLowerCase();
      slugs.add(slug);
      captureMeta(slug, node);
    }
  });
  // Also grab data-item-link / data-film-link hrefs.
  doc.querySelectorAll('[data-item-link], [data-film-link]').forEach((node) => {
    const href =
      node.getAttribute('data-item-link') ?? node.getAttribute('data-film-link') ?? '';
    const m = href.match(/\/film\/([^/]+)\/?/);
    if (m) slugs.add(m[1].toLowerCase());
  });
  // Fallback: anchor tags pointing at /film/<slug>/
  if (slugs.size === 0) {
    doc.querySelectorAll('a[href^="/film/"]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const m = href.match(/^\/film\/([^/]+)\/?/);
      if (m) slugs.add(m[1].toLowerCase());
    });
  }
  return Array.from(slugs);
}

/** Does the list page have more pages after this one? */
function hasNextPage(doc: Document, currentPage: number): boolean {
  // Letterboxd paginator has .paginate-nextprev a.next, or page links.
  const next = doc.querySelector('.paginate-nextprev .next');
  if (next && !next.classList.contains('disabled')) return true;
  // Alt: look at the highest page number link.
  const pageLinks = doc.querySelectorAll('.paginate-pages a, .paginate-page a');
  let maxPage = currentPage;
  pageLinks.forEach((a) => {
    const n = Number(a.textContent?.trim());
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  });
  return maxPage > currentPage;
}

export interface PageProgress {
  page: number;
  total: number; // 0 if unknown
  collected: number;
}

async function scrapePaginatedList(
  path: (page: number) => string,
  maxPages: number,
  onPage?: (p: PageProgress) => void,
): Promise<string[]> {
  const allSlugs: string[] = [];
  let estimatedTotal = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 2;

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const html = await fetchHtml(`${LETTERBOXD_BASE}${path(page)}`);
      const doc = parseHtml(html);
      const slugs = extractSlugsFromListPage(doc);
      consecutiveFailures = 0; // reset on success
      if (slugs.length === 0) {
        if (page === 1 && looksPrivate(html)) {
          throw new LetterboxdScrapeError('Watchlist is private', 'private');
        }
        break;
      }
      allSlugs.push(...slugs);
      if (page === 1) estimatedTotal = estimateTotalPages(doc, page);
      onPage?.({ page, total: estimatedTotal, collected: allSlugs.length });
      if (!hasNextPage(doc, page)) break;
    } catch (err) {
      consecutiveFailures += 1;
      if (page === 1) {
        if (err instanceof LetterboxdScrapeError) throw err;
        throw new LetterboxdScrapeError(`Failed to read page 1 of list`, 'unknown', err);
      }
      // If we already have some results, stop gracefully rather than fail.
      // The user still gets a partial (but useful) overlap.
      if (allSlugs.length > 0 || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        break;
      }
    }
  }
  // Preserve order, dedupe.
  return Array.from(new Set(allSlugs));
}

function estimateTotalPages(doc: Document, fallback: number): number {
  let max = fallback;
  doc
    .querySelectorAll('.paginate-pages a, .paginate-page a')
    .forEach((a) => {
      const n = Number(a.textContent?.trim());
      if (Number.isFinite(n) && n > max) max = n;
    });
  return max;
}

/** Scrape a user's full public watchlist. */
export async function scrapeWatchlist(
  username: string,
  maxPages = 10,
  onPage?: (p: PageProgress) => void,
): Promise<string[]> {
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  if (!clean) throw new LetterboxdScrapeError('Empty username');
  try {
    return await scrapePaginatedList(
      (page) => `/${encodeURIComponent(clean)}/watchlist/page/${page}/`,
      maxPages,
      onPage,
    );
  } catch (err) {
    if (err instanceof LetterboxdScrapeError) throw err;
    throw new LetterboxdScrapeError(
      `Couldn't read @${clean}'s public watchlist. The profile may be private or the proxy may be down.`,
      'unknown',
      err,
    );
  }
}

/** Scrape every film a user has logged as watched. */
export async function scrapeWatched(
  username: string,
  maxPages = 20,
  onPage?: (p: PageProgress) => void,
): Promise<string[]> {
  const clean = username.trim().replace(/^@/, '').toLowerCase();
  if (!clean) return [];
  try {
    return await scrapePaginatedList(
      (page) => `/${encodeURIComponent(clean)}/films/page/${page}/`,
      maxPages,
      onPage,
    );
  } catch {
    // Watched list is a best-effort filter; if it fails, we just don't apply it.
    return [];
  }
}

// -----------------------------------------------------------------------------
// Per-film scraping
// -----------------------------------------------------------------------------

export interface LetterboxdFilmDetails {
  slug: string;
  title: string;
  year?: number;
  posterUrl?: string;
  synopsis?: string;
  runtime?: number;
  genres: string[];
  directors: string[];
  lbRating?: number; // 0..5 from aggregateRating
  lbRatingCount?: number;
  tmdbId?: number;
}

const MEMORY_CACHE = new Map<string, LetterboxdFilmDetails>();

/** Letterboxd poster URLs look like:
 *    https://a.ltrbxd.com/.../foo-0-230-0-345-crop.jpg
 *  The four numbers are x-offset, width, y-offset, height. We can rewrite
 *  them to any sane size Letterboxd's CDN can render. */
export function upscalePoster(url: string | undefined, width = POSTER_WIDTH): string | undefined {
  if (!url) return url;
  const height = Math.round((width * 3) / 2); // posters are 2:3
  return url.replace(
    /-0-(\d+)-0-(\d+)-crop\.(jpe?g|png|webp)(\?.*)?$/i,
    (_m, _w, _h, ext, qs) => `-0-${width}-0-${height}-crop.${ext}${qs ?? ''}`,
  );
}

/** Scrape a single film detail page. Cheap in-memory cache per session. */
export async function scrapeFilm(slug: string): Promise<LetterboxdFilmDetails> {
  const normalized = slug.toLowerCase();
  const cached = MEMORY_CACHE.get(normalized);
  if (cached) return cached;

  try {
    const html = await fetchHtml(`${LETTERBOXD_BASE}/film/${encodeURIComponent(normalized)}/`);
    const details = extractFilmDetails(normalized, html);
    MEMORY_CACHE.set(normalized, details);
    return details;
  } catch {
    // Return a stub built from list-page metadata so we don't lose this film.
    const meta = LIST_PAGE_META.get(normalized);
    const stub: LetterboxdFilmDetails = {
      slug: normalized,
      title: meta?.title ?? normalized.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      year: meta?.year,
      posterUrl: meta?.posterUrl,
      genres: [],
      directors: [],
    };
    return stub;
  }
}

function extractFilmDetails(slug: string, html: string): LetterboxdFilmDetails {
  const doc = parseHtml(html);

  // Pull JSON-LD block — Letterboxd always emits one on film pages.
  const ld = readJsonLd(doc);

  const ogImage = doc
    .querySelector('meta[property="og:image"]')
    ?.getAttribute('content') ?? undefined;
  const ogTitle = doc
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content') ?? undefined;
  const description = doc
    .querySelector('meta[property="og:description"]')
    ?.getAttribute('content') ?? undefined;

  // Title + year: prefer JSON-LD, fall back to og:title parsing.
  let title = (ld?.name as string | undefined) ?? ogTitle ?? slug;
  let year: number | undefined =
    parseYear(ld?.releasedEvent) ?? parseYearFromTitle(ogTitle);
  if (!year) year = parseYearFromTitle(title);
  title = cleanTitle(title);

  // Poster: og:image usually points at a 1000x1500 poster crop. Prefer JSON-LD
  // image if present since it can be higher resolution.
  const jsonImage = Array.isArray(ld?.image) ? ld?.image[0] : ld?.image;
  const posterUrl = (typeof jsonImage === 'string' ? jsonImage : undefined) ?? ogImage;

  // Directors.
  const directors = normalizeNameList(ld?.director);

  // Rating (0..5).
  let lbRating: number | undefined;
  let lbRatingCount: number | undefined;
  const rating = ld?.aggregateRating;
  if (rating && typeof rating === 'object') {
    const v = Number((rating as { ratingValue?: unknown }).ratingValue);
    if (Number.isFinite(v)) lbRating = v;
    const c = Number((rating as { ratingCount?: unknown }).ratingCount);
    if (Number.isFinite(c)) lbRatingCount = c;
  }

  // Runtime: JSON-LD doesn't reliably include it; parse the visible footer.
  const runtime = parseRuntime(doc);

  // Genres: scrape from the "genres" tab anchors.
  const genres = parseGenres(doc, ld);

  // TMDB id if Letterboxd links out to it — useful later if a key appears.
  const tmdbId = parseTmdbId(doc);

  return {
    slug,
    title,
    year,
    posterUrl,
    synopsis: description,
    runtime,
    genres,
    directors,
    lbRating,
    lbRatingCount,
    tmdbId,
  };
}

function readJsonLd(doc: Document): Record<string, unknown> | undefined {
  const nodes = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const node of Array.from(nodes)) {
    const raw = (node.textContent ?? '').trim();
    if (!raw) continue;
    // Letterboxd sometimes wraps the JSON in CDATA comments.
    const cleaned = raw
      .replace(/^\/\*\s*<!\[CDATA\[\s*\*\//, '')
      .replace(/\/\*\s*\]\]>\s*\*\/\s*$/, '');
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep trying next block
    }
  }
  return undefined;
}

function normalizeNameList(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) {
    return input
      .map((x) => {
        if (typeof x === 'string') return x;
        if (x && typeof x === 'object' && 'name' in x)
          return String((x as { name: unknown }).name ?? '');
        return '';
      })
      .filter(Boolean);
  }
  if (typeof input === 'object' && input && 'name' in input) {
    return [String((input as { name: unknown }).name ?? '')].filter(Boolean);
  }
  return [];
}

function parseYear(releasedEvent: unknown): number | undefined {
  if (!releasedEvent) return undefined;
  const evs = Array.isArray(releasedEvent) ? releasedEvent : [releasedEvent];
  for (const ev of evs) {
    if (!ev || typeof ev !== 'object') continue;
    const s = (ev as { startDate?: unknown }).startDate;
    if (typeof s === 'string') {
      const y = Number(s.slice(0, 4));
      if (Number.isFinite(y)) return y;
    }
  }
  return undefined;
}

function parseYearFromTitle(t?: string): number | undefined {
  if (!t) return undefined;
  const m = t.match(/\((\d{4})\)\s*$/);
  return m ? Number(m[1]) : undefined;
}

function cleanTitle(t: string): string {
  return t.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

function parseRuntime(doc: Document): number | undefined {
  // Letterboxd shows "95 mins" (sometimes "1h 35m") in .text-footer near the footer.
  const candidates = doc.querySelectorAll('.text-footer, p.text-link.text-footer');
  for (const node of Array.from(candidates)) {
    const txt = node.textContent ?? '';
    const mins = txt.match(/(\d+)\s*mins?\b/i);
    if (mins) return Number(mins[1]);
    const hm = txt.match(/(\d+)\s*h(?:r?s?)?\s*(\d+)?\s*m?/i);
    if (hm) {
      const h = Number(hm[1]);
      const m = Number(hm[2] ?? 0);
      return h * 60 + m;
    }
  }
  return undefined;
}

function parseGenres(doc: Document, ld: Record<string, unknown> | undefined): string[] {
  // JSON-LD `genre` is usually an array of strings.
  const fromLd = ld?.genre;
  if (Array.isArray(fromLd)) {
    return fromLd.map((x) => String(x)).filter(Boolean);
  }
  if (typeof fromLd === 'string') return [fromLd];
  // Fall back to anchors under the genres tab.
  const out = new Set<string>();
  doc.querySelectorAll('a[href^="/films/genre/"]').forEach((a) => {
    const txt = (a.textContent ?? '').trim();
    if (txt) out.add(txt);
  });
  return Array.from(out);
}

function parseTmdbId(doc: Document): number | undefined {
  const link = doc.querySelector('a[href*="themoviedb.org/movie/"]');
  if (!link) return undefined;
  const href = link.getAttribute('href') ?? '';
  const m = href.match(/movie\/(\d+)/);
  return m ? Number(m[1]) : undefined;
}
