// Convert a Letterboxd film URL or title to a normalized comparable slug.
// https://letterboxd.com/film/past-lives/  ->  past-lives
export function extractLetterboxdSlug(input: string): string | undefined {
  const m = input.match(/letterboxd\.com\/film\/([^/]+)\/?/i);
  if (m) return m[1].toLowerCase();
  return undefined;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Stable ID combining title + year, used when no TMDB id exists. */
export function titleYearId(title: string, year?: number): string {
  return `${slugify(title)}-${year ?? 'x'}`;
}
