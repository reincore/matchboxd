// Country detection for JustWatch links.
//
// Priority chain (highest → lowest):
//   1. Manual override  (localStorage)
//   2. Cloudflare IP    (cf-ipcountry echoed via X-Client-Country header)
//   3. Timezone heuristic (Intl.DateTimeFormat → IANA tz → country)
//   4. Default           ('us')

const OVERRIDE_KEY = 'matchboxd:country-override:v1';
const CACHE_KEY = 'matchboxd:country:v1';
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// JustWatch country support
// ---------------------------------------------------------------------------

/** Country codes supported by JustWatch (ISO 3166-1 alpha-2, lowercase). */
export const JUSTWATCH_COUNTRIES = new Set([
  'ad', 'ae', 'ag', 'al', 'ar', 'at', 'au', 'ba', 'bb', 'be', 'bg', 'bh',
  'bm', 'bo', 'br', 'bs', 'ca', 'ch', 'ci', 'cl', 'co', 'cr', 'cu', 'cv',
  'cz', 'de', 'dk', 'do', 'dz', 'ec', 'ee', 'eg', 'es', 'fi', 'fj', 'fr',
  'gb', 'gf', 'gh', 'gi', 'gq', 'gr', 'gt', 'gy', 'hk', 'hn', 'hr', 'hu',
  'id', 'ie', 'il', 'in', 'iq', 'is', 'it', 'jm', 'jo', 'jp', 'ke', 'kr',
  'kw', 'lb', 'li', 'lt', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mk', 'ml',
  'mt', 'mu', 'mx', 'my', 'mz', 'ne', 'ng', 'ni', 'nl', 'no', 'nz', 'om',
  'pa', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'ps', 'pt', 'py', 'qa', 'ro',
  'rs', 'ru', 'sa', 'sc', 'se', 'sg', 'si', 'sk', 'sm', 'sn', 'sv', 'tc',
  'th', 'tn', 'tr', 'tt', 'tw', 'tz', 'ua', 'ug', 'us', 'uy', 've', 'xk',
  'za', 'zm', 'zw',
]);

/** Human-readable names for every JustWatch-supported country. */
export const JUSTWATCH_COUNTRY_NAMES: Record<string, string> = {
  ad: 'Andorra', ae: 'UAE', ag: 'Antigua & Barbuda', al: 'Albania',
  ar: 'Argentina', at: 'Austria', au: 'Australia', ba: 'Bosnia & Herzegovina',
  bb: 'Barbados', be: 'Belgium', bg: 'Bulgaria', bh: 'Bahrain',
  bm: 'Bermuda', bo: 'Bolivia', br: 'Brazil', bs: 'Bahamas',
  ca: 'Canada', ch: 'Switzerland', ci: "Ivory Coast", cl: 'Chile',
  co: 'Colombia', cr: 'Costa Rica', cu: 'Cuba', cv: 'Cape Verde',
  cz: 'Czechia', de: 'Germany', dk: 'Denmark', do: 'Dominican Republic',
  dz: 'Algeria', ec: 'Ecuador', ee: 'Estonia', eg: 'Egypt',
  es: 'Spain', fi: 'Finland', fj: 'Fiji', fr: 'France',
  gb: 'United Kingdom', gf: 'French Guiana', gh: 'Ghana', gi: 'Gibraltar',
  gq: 'Equatorial Guinea', gr: 'Greece', gt: 'Guatemala', gy: 'Guyana',
  hk: 'Hong Kong', hn: 'Honduras', hr: 'Croatia', hu: 'Hungary',
  id: 'Indonesia', ie: 'Ireland', il: 'Israel', in: 'India',
  iq: 'Iraq', is: 'Iceland', it: 'Italy', jm: 'Jamaica',
  jo: 'Jordan', jp: 'Japan', ke: 'Kenya', kr: 'South Korea',
  kw: 'Kuwait', lb: 'Lebanon', li: 'Liechtenstein', lt: 'Lithuania',
  lv: 'Latvia', ly: 'Libya', ma: 'Morocco', mc: 'Monaco',
  md: 'Moldova', me: 'Montenegro', mk: 'North Macedonia', ml: 'Mali',
  mt: 'Malta', mu: 'Mauritius', mx: 'Mexico', my: 'Malaysia',
  mz: 'Mozambique', ne: 'Niger', ng: 'Nigeria', ni: 'Nicaragua',
  nl: 'Netherlands', no: 'Norway', nz: 'New Zealand', om: 'Oman',
  pa: 'Panama', pe: 'Peru', pf: 'French Polynesia', pg: 'Papua New Guinea',
  ph: 'Philippines', pk: 'Pakistan', pl: 'Poland', ps: 'Palestine',
  pt: 'Portugal', py: 'Paraguay', qa: 'Qatar', ro: 'Romania',
  rs: 'Serbia', ru: 'Russia', sa: 'Saudi Arabia', sc: 'Seychelles',
  se: 'Sweden', sg: 'Singapore', si: 'Slovenia', sk: 'Slovakia',
  sm: 'San Marino', sn: 'Senegal', sv: 'El Salvador', tc: 'Turks & Caicos',
  th: 'Thailand', tn: 'Tunisia', tr: 'Turkey', tt: 'Trinidad & Tobago',
  tw: 'Taiwan', tz: 'Tanzania', ua: 'Ukraine', ug: 'Uganda',
  us: 'United States', uy: 'Uruguay', ve: 'Venezuela', xk: 'Kosovo',
  za: 'South Africa', zm: 'Zambia', zw: 'Zimbabwe',
};

/** All countries sorted alphabetically by name, for UI pickers. */
export const JUSTWATCH_COUNTRY_LIST: { code: string; name: string }[] =
  Object.entries(JUSTWATCH_COUNTRY_NAMES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

/** Localized JustWatch search paths. Fallback is 'search'. */
export const JUSTWATCH_SEARCH_PATHS: Record<string, string> = {
  tr: 'arama', de: 'Suche', fr: 'recherche', es: 'buscar',
  it: 'cerca', pt: 'busca', nl: 'zoeken', pl: 'szukaj',
};

// ---------------------------------------------------------------------------
// Timezone → country mapping (IANA timezone → ISO 3166-1 alpha-2)
// ---------------------------------------------------------------------------

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // Turkey
  'Europe/Istanbul': 'tr',
  // Germany
  'Europe/Berlin': 'de',
  // France
  'Europe/Paris': 'fr',
  // Spain
  'Europe/Madrid': 'es', 'Atlantic/Canary': 'es',
  // Italy
  'Europe/Rome': 'it',
  // Portugal
  'Europe/Lisbon': 'pt', 'Atlantic/Azores': 'pt', 'Atlantic/Madeira': 'pt',
  // Netherlands
  'Europe/Amsterdam': 'nl',
  // Poland
  'Europe/Warsaw': 'pl',
  // Japan
  'Asia/Tokyo': 'jp',
  // South Korea
  'Asia/Seoul': 'kr',
  // US
  'America/New_York': 'us', 'America/Chicago': 'us', 'America/Denver': 'us',
  'America/Los_Angeles': 'us', 'America/Anchorage': 'us', 'Pacific/Honolulu': 'us',
  'America/Phoenix': 'us',
  // UK
  'Europe/London': 'gb',
  // Canada (ambiguous with US for some, but these are Canada-only)
  'America/Toronto': 'ca', 'America/Vancouver': 'ca', 'America/Edmonton': 'ca',
  'America/Halifax': 'ca', 'America/Winnipeg': 'ca',
  // Australia
  'Australia/Sydney': 'au', 'Australia/Melbourne': 'au', 'Australia/Brisbane': 'au',
  'Australia/Perth': 'au', 'Australia/Adelaide': 'au', 'Australia/Hobart': 'au',
  // India
  'Asia/Kolkata': 'in', 'Asia/Calcutta': 'in',
  // Brazil
  'America/Sao_Paulo': 'br', 'America/Fortaleza': 'br', 'America/Manaus': 'br',
  // Mexico
  'America/Mexico_City': 'mx', 'America/Cancun': 'mx', 'America/Tijuana': 'mx',
  // Argentina
  'America/Argentina/Buenos_Aires': 'ar',
  // Russia
  'Europe/Moscow': 'ru', 'Asia/Yekaterinburg': 'ru', 'Asia/Novosibirsk': 'ru',
  // Nordic
  'Europe/Stockholm': 'se', 'Europe/Helsinki': 'fi', 'Europe/Oslo': 'no',
  'Europe/Copenhagen': 'dk',
  // Baltics
  'Europe/Tallinn': 'ee', 'Europe/Riga': 'lv', 'Europe/Vilnius': 'lt',
  // Central/Eastern Europe
  'Europe/Prague': 'cz', 'Europe/Vienna': 'at', 'Europe/Zurich': 'ch',
  'Europe/Brussels': 'be', 'Europe/Budapest': 'hu', 'Europe/Bucharest': 'ro',
  'Europe/Sofia': 'bg', 'Europe/Athens': 'gr', 'Europe/Belgrade': 'rs',
  'Europe/Zagreb': 'hr', 'Europe/Ljubljana': 'si', 'Europe/Bratislava': 'sk',
  'Europe/Dublin': 'ie', 'Europe/Sarajevo': 'ba', 'Europe/Skopje': 'mk',
  'Europe/Podgorica': 'me',
  // Middle East
  'Asia/Dubai': 'ae', 'Asia/Riyadh': 'sa', 'Asia/Qatar': 'qa',
  'Asia/Kuwait': 'kw', 'Asia/Bahrain': 'bh', 'Asia/Muscat': 'om',
  'Asia/Baghdad': 'iq', 'Asia/Beirut': 'lb', 'Asia/Jerusalem': 'il',
  'Asia/Amman': 'jo',
  // Southeast Asia
  'Asia/Singapore': 'sg', 'Asia/Bangkok': 'th', 'Asia/Jakarta': 'id',
  'Asia/Manila': 'ph', 'Asia/Kuala_Lumpur': 'my', 'Asia/Ho_Chi_Minh': 'vn',
  // East Asia
  'Asia/Shanghai': 'cn', 'Asia/Hong_Kong': 'hk', 'Asia/Taipei': 'tw',
  // South Asia
  'Asia/Karachi': 'pk',
  // Africa
  'Africa/Cairo': 'eg', 'Africa/Johannesburg': 'za', 'Africa/Lagos': 'ng',
  'Africa/Nairobi': 'ke', 'Africa/Casablanca': 'ma', 'Africa/Tunis': 'tn',
  'Africa/Algiers': 'dz',
  // New Zealand
  'Pacific/Auckland': 'nz',
  // Colombia / Chile / Peru
  'America/Bogota': 'co', 'America/Santiago': 'cl', 'America/Lima': 'pe',
};

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function getCountryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return null;
    const code = TIMEZONE_TO_COUNTRY[tz];
    return code && JUSTWATCH_COUNTRIES.has(code) ? code : null;
  } catch {
    return null;
  }
}

interface CachedCountry {
  code: string;
  ts: number;
}

function getCachedCountry(): string | null {
  const raw = storage()?.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed: CachedCountry = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_MAX_AGE_MS) return null;
    return JUSTWATCH_COUNTRIES.has(parsed.code) ? parsed.code : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return the user's manual country override, or null. */
export function getCountryOverride(): string | null {
  const code = storage()?.getItem(OVERRIDE_KEY) ?? null;
  return code && JUSTWATCH_COUNTRIES.has(code) ? code : null;
}

/** Set or clear the manual country override. */
export function setCountryOverride(code: string | null): void {
  const s = storage();
  if (!s) return;
  if (code) {
    s.setItem(OVERRIDE_KEY, code.toLowerCase());
  } else {
    s.removeItem(OVERRIDE_KEY);
  }
}

/**
 * Extract the IP-based country from a Cloudflare Worker response
 * and cache it in localStorage.
 */
export function setCountryFromHeader(response: Response): void {
  const raw = (response.headers.get('X-Client-Country') ?? '').toLowerCase();
  if (!raw || raw === 'xx' || raw === 't1') return;
  if (!JUSTWATCH_COUNTRIES.has(raw)) return;
  const s = storage();
  if (!s) return;
  const entry: CachedCountry = { code: raw, ts: Date.now() };
  s.setItem(CACHE_KEY, JSON.stringify(entry));
}

/**
 * Synchronously return the best-known 2-letter country code.
 *
 * Priority: manual override → Cloudflare IP cache → timezone → 'us'.
 */
export function getDetectedCountry(): string {
  return getCountryOverride()
    ?? getCachedCountry()
    ?? getCountryFromTimezone()
    ?? 'us';
}

/** Build a JustWatch search URL for a specific country code. */
export function buildJustWatchSearchUrlForCountry(
  title: string,
  year: number | undefined,
  countryCode: string,
): string {
  const country = JUSTWATCH_COUNTRIES.has(countryCode) ? countryCode : 'us';
  const searchPath = JUSTWATCH_SEARCH_PATHS[country] ?? 'search';
  const query = [title, year ? String(year) : '']
    .filter(Boolean)
    .join(' ');
  return `https://www.justwatch.com/${country}/${searchPath}?q=${encodeURIComponent(query)}`;
}

/** Build a JustWatch search URL for the detected country. */
export function buildJustWatchSearchUrl(title: string, year?: number): string {
  return buildJustWatchSearchUrlForCountry(title, year, getDetectedCountry());
}
