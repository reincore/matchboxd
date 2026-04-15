/** Convert a Letterboxd slug like "the-dark-knight" to "The Dark Knight". */
export function slugToTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
