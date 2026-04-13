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

/**
 * Letterboxd usernames: 2-15 chars, letters/digits/hyphens/underscores only.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateLetterboxdUsername(raw: string): string | null {
  const name = raw.trim().replace(/^@/, '');
  if (!name) return 'Username is required.';
  if (name.length < 2) return 'Letterboxd usernames are at least 2 characters.';
  if (name.length > 15) return 'Letterboxd usernames are at most 15 characters.';
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Letterboxd usernames can only contain letters, numbers, hyphens, and underscores.';
  }
  return null;
}
