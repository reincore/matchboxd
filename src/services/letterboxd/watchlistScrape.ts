import { LETTERBOXD_BASE, LetterboxdScrapeError, POSTER_WIDTH } from './shared';
import { fetchHtml, looksPrivate, parseHtml } from './proxyClient';
import { storeListPageMeta } from './listPageMeta';

export interface PageProgress {
  page: number;
  total: number;
  collected: number;
}

function guessPosterUrl(filmId: string, slug: string, width = 230): string {
  const height = Math.round((width * 3) / 2);
  const path = filmId.split('').join('/');
  return `https://a.ltrbxd.com/resized/film-poster/${path}/${filmId}-${slug}-0-${width}-0-${height}-crop.jpg`;
}

function parseItemName(name: string): { title: string; year?: number } {
  const match = name.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (match) return { title: match[1].trim(), year: Number(match[2]) };
  return { title: name.trim() };
}

function extractSlugsFromListPage(doc: Document): string[] {
  const slugs = new Set<string>();

  function captureMeta(slug: string, node: Element): void {
    const filmId = node.getAttribute('data-film-id') ?? undefined;
    const itemName = node.getAttribute('data-item-name') ?? undefined;
    const parsed = itemName ? parseItemName(itemName) : undefined;
    const posterUrl = filmId ? guessPosterUrl(filmId, slug, POSTER_WIDTH) : undefined;

    storeListPageMeta(slug, {
      filmId,
      title: parsed?.title,
      year: parsed?.year,
      posterUrl,
    });
  }

  doc.querySelectorAll('[data-item-slug]').forEach((node) => {
    const raw = node.getAttribute('data-item-slug');
    if (!raw) return;
    const slug = raw.toLowerCase();
    slugs.add(slug);
    captureMeta(slug, node);
  });

  doc.querySelectorAll('[data-film-slug]').forEach((node) => {
    const raw = node.getAttribute('data-film-slug');
    if (!raw) return;
    const slug = raw.toLowerCase();
    slugs.add(slug);
    captureMeta(slug, node);
  });

  doc.querySelectorAll('[data-item-link], [data-film-link]').forEach((node) => {
    const href =
      node.getAttribute('data-item-link') ??
      node.getAttribute('data-film-link') ??
      '';
    const match = href.match(/\/film\/([^/]+)\/?/);
    if (match) {
      slugs.add(match[1].toLowerCase());
    }
  });

  if (slugs.size === 0) {
    doc.querySelectorAll('a[href^="/film/"]').forEach((anchor) => {
      const href = anchor.getAttribute('href') ?? '';
      const match = href.match(/^\/film\/([^/]+)\/?/);
      if (match) {
        slugs.add(match[1].toLowerCase());
      }
    });
  }

  return Array.from(slugs);
}

function hasNextPage(doc: Document, currentPage: number): boolean {
  const next = doc.querySelector('.paginate-nextprev .next');
  if (next && !next.classList.contains('disabled')) return true;

  let maxPage = currentPage;
  doc.querySelectorAll('.paginate-pages a, .paginate-page a').forEach((anchor) => {
    const pageNumber = Number(anchor.textContent?.trim());
    if (Number.isFinite(pageNumber) && pageNumber > maxPage) {
      maxPage = pageNumber;
    }
  });

  return maxPage > currentPage;
}

function estimateTotalPages(doc: Document, fallback: number): number {
  let maxPage = fallback;
  doc.querySelectorAll('.paginate-pages a, .paginate-page a').forEach((anchor) => {
    const pageNumber = Number(anchor.textContent?.trim());
    if (Number.isFinite(pageNumber) && pageNumber > maxPage) {
      maxPage = pageNumber;
    }
  });
  return maxPage;
}

async function scrapePaginatedList(
  pathForPage: (page: number) => string,
  maxPages: number,
  onPage?: (progress: PageProgress) => void,
): Promise<string[]> {
  const allSlugs: string[] = [];
  let estimatedTotal = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 2;

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const html = await fetchHtml(`${LETTERBOXD_BASE}${pathForPage(page)}`);
      const doc = parseHtml(html);
      const slugs = extractSlugsFromListPage(doc);
      consecutiveFailures = 0;

      if (slugs.length === 0) {
        if (page === 1 && looksPrivate(html)) {
          throw new LetterboxdScrapeError('Watchlist is private', 'private');
        }
        break;
      }

      allSlugs.push(...slugs);
      if (page === 1) {
        estimatedTotal = estimateTotalPages(doc, page);
      }

      onPage?.({ page, total: estimatedTotal, collected: allSlugs.length });

      if (!hasNextPage(doc, page)) {
        break;
      }
    } catch (error) {
      consecutiveFailures += 1;
      if (page === 1) {
        if (error instanceof LetterboxdScrapeError) throw error;
        throw new LetterboxdScrapeError('Failed to read page 1 of list', 'unknown', error);
      }

      if (allSlugs.length > 0 || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        break;
      }
    }
  }

  return Array.from(new Set(allSlugs));
}

export async function scrapeWatchlist(
  username: string,
  maxPages = 10,
  onPage?: (progress: PageProgress) => void,
): Promise<string[]> {
  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
  if (!cleanUsername) {
    throw new LetterboxdScrapeError('Empty username');
  }

  try {
    return await scrapePaginatedList(
      (page) => `/${encodeURIComponent(cleanUsername)}/watchlist/page/${page}/`,
      maxPages,
      onPage,
    );
  } catch (error) {
    if (error instanceof LetterboxdScrapeError) throw error;
    throw new LetterboxdScrapeError(
      `Couldn't read @${cleanUsername}'s public watchlist. The profile may be private or the proxy may be down.`,
      'unknown',
      error,
    );
  }
}

export async function scrapeWatched(
  username: string,
  maxPages = 20,
  onPage?: (progress: PageProgress) => void,
): Promise<string[]> {
  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
  if (!cleanUsername) return [];

  try {
    return await scrapePaginatedList(
      (page) => `/${encodeURIComponent(cleanUsername)}/films/page/${page}/`,
      maxPages,
      onPage,
    );
  } catch {
    return [];
  }
}
