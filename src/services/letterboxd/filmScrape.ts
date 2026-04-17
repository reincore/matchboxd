import { slugToTitle } from '../../utils/slug';
import { getListPageMeta } from './listPageMeta';
import { fetchHtml, parseHtml } from './proxyClient';
import { LETTERBOXD_BASE, POSTER_WIDTH } from './shared';

export interface LetterboxdFilmDetails {
  slug: string;
  title: string;
  year?: number;
  posterUrl?: string;
  synopsis?: string;
  runtime?: number;
  genres: string[];
  directors: string[];
  lbRating?: number;
  lbRatingCount?: number;
}

const MEMORY_CACHE = new Map<string, LetterboxdFilmDetails>();

export function resetFilmDetailsCache(): void {
  MEMORY_CACHE.clear();
}

export function upscalePoster(
  url: string | undefined,
  width = POSTER_WIDTH,
): string | undefined {
  if (!url) return url;
  const height = Math.round((width * 3) / 2);
  return url.replace(
    /-0-(\d+)-0-(\d+)-crop\.(jpe?g|png|webp)(\?.*)?$/i,
    (_match, _sourceWidth, _sourceHeight, extension, query) =>
      `-0-${width}-0-${height}-crop.${extension}${query ?? ''}`,
  );
}

export async function scrapeFilm(slug: string): Promise<LetterboxdFilmDetails> {
  const normalizedSlug = slug.toLowerCase();
  const cached = MEMORY_CACHE.get(normalizedSlug);
  if (cached) return cached;

  try {
    const html = await fetchHtml(`${LETTERBOXD_BASE}/film/${encodeURIComponent(normalizedSlug)}/`);
    const details = extractFilmDetails(normalizedSlug, html);
    MEMORY_CACHE.set(normalizedSlug, details);
    return details;
  } catch {
    const meta = getListPageMeta(normalizedSlug);
    return {
      slug: normalizedSlug,
      title: meta?.title ?? slugToTitle(normalizedSlug),
      year: meta?.year,
      posterUrl: meta?.posterUrl,
      genres: [],
      directors: [],
    };
  }
}

function extractFilmDetails(slug: string, html: string): LetterboxdFilmDetails {
  const doc = parseHtml(html);
  const jsonLd = readJsonLd(doc);
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? undefined;
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? undefined;
  const description = doc
    .querySelector('meta[property="og:description"]')
    ?.getAttribute('content') ?? undefined;

  let title = (jsonLd?.name as string | undefined) ?? ogTitle ?? slug;
  let year = parseYear(jsonLd?.releasedEvent) ?? parseYearFromTitle(ogTitle);
  if (!year) year = parseYearFromTitle(title);
  title = cleanTitle(title);

  const jsonImage = Array.isArray(jsonLd?.image) ? jsonLd?.image[0] : jsonLd?.image;
  const posterUrl = (typeof jsonImage === 'string' ? jsonImage : undefined) ?? ogImage;
  const directors = normalizeNameList(jsonLd?.director);
  const runtime = parseRuntime(doc);
  const genres = parseGenres(doc, jsonLd);

  let lbRating: number | undefined;
  let lbRatingCount: number | undefined;
  const rating = jsonLd?.aggregateRating;
  if (rating && typeof rating === 'object') {
    const value = Number((rating as { ratingValue?: unknown }).ratingValue);
    const count = Number((rating as { ratingCount?: unknown }).ratingCount);
    if (Number.isFinite(value)) lbRating = value;
    if (Number.isFinite(count)) lbRatingCount = count;
  }

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
  };
}

function readJsonLd(doc: Document): Record<string, unknown> | undefined {
  const nodes = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const node of Array.from(nodes)) {
    const raw = (node.textContent ?? '').trim();
    if (!raw) continue;

    const cleaned = raw
      .replace(/^\/\*\s*<!\[CDATA\[\s*\*\//, '')
      .replace(/\/\*\s*\]\]>\s*\*\/\s*$/, '');

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Keep looking for a parseable JSON-LD block.
    }
  }

  return undefined;
}

function normalizeNameList(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];

  if (Array.isArray(input)) {
    return input
      .map((value) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object' && 'name' in value) {
          return String((value as { name: unknown }).name ?? '');
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof input === 'object' && 'name' in input) {
    return [String((input as { name: unknown }).name ?? '')].filter(Boolean);
  }

  return [];
}

function parseYear(releasedEvent: unknown): number | undefined {
  if (!releasedEvent) return undefined;

  const events = Array.isArray(releasedEvent) ? releasedEvent : [releasedEvent];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const value = (event as { startDate?: unknown }).startDate;
    if (typeof value !== 'string') continue;
    const year = Number(value.slice(0, 4));
    if (Number.isFinite(year)) return year;
  }

  return undefined;
}

function parseYearFromTitle(title?: string): number | undefined {
  if (!title) return undefined;
  const match = title.match(/\((\d{4})\)\s*$/);
  return match ? Number(match[1]) : undefined;
}

function cleanTitle(title: string): string {
  return title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
}

function parseRuntime(doc: Document): number | undefined {
  const candidates = doc.querySelectorAll('.text-footer, p.text-link.text-footer');
  for (const node of Array.from(candidates)) {
    const text = node.textContent ?? '';
    const minutesMatch = text.match(/(\d+)\s*mins?\b/i);
    if (minutesMatch) return Number(minutesMatch[1]);

    const hoursMinutesMatch = text.match(/(\d+)\s*h(?:r?s?)?\s*(\d+)?\s*m?/i);
    if (hoursMinutesMatch) {
      const hours = Number(hoursMinutesMatch[1]);
      const minutes = Number(hoursMinutesMatch[2] ?? 0);
      return hours * 60 + minutes;
    }
  }

  return undefined;
}

function parseGenres(
  doc: Document,
  jsonLd: Record<string, unknown> | undefined,
): string[] {
  const fromJsonLd = jsonLd?.genre;
  if (Array.isArray(fromJsonLd)) {
    return fromJsonLd.map((value) => String(value)).filter(Boolean);
  }
  if (typeof fromJsonLd === 'string') {
    return [fromJsonLd];
  }

  const genres = new Set<string>();
  doc.querySelectorAll('a[href^="/films/genre/"]').forEach((anchor) => {
    const label = (anchor.textContent ?? '').trim();
    if (label) genres.add(label);
  });
  return Array.from(genres);
}
