import { describe, expect, it } from 'vitest';
import {
  extractLetterboxdSlug,
  slugify,
  titleYearId,
  validateLetterboxdUsername,
} from './slug';

describe('extractLetterboxdSlug', () => {
  it('extracts slug from a standard film URL', () => {
    expect(extractLetterboxdSlug('https://letterboxd.com/film/past-lives/')).toBe('past-lives');
  });

  it('extracts slug without trailing slash', () => {
    expect(extractLetterboxdSlug('https://letterboxd.com/film/parasite')).toBe('parasite');
  });

  it('returns undefined for non-film URLs', () => {
    expect(extractLetterboxdSlug('https://letterboxd.com/deniz/watchlist/')).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    expect(extractLetterboxdSlug('')).toBeUndefined();
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Past Lives')).toBe('past-lives');
  });

  it('strips diacritics', () => {
    expect(slugify('Amélie')).toBe('amelie');
  });

  it('removes leading/trailing hyphens', () => {
    expect(slugify('  --hello-- ')).toBe('hello');
  });

  it('collapses multiple non-alphanumeric chars', () => {
    expect(slugify('a & b / c')).toBe('a-b-c');
  });
});

describe('titleYearId', () => {
  it('combines slugified title with year', () => {
    expect(titleYearId('Past Lives', 2023)).toBe('past-lives-2023');
  });

  it('uses x when year is undefined', () => {
    expect(titleYearId('Parasite')).toBe('parasite-x');
  });
});

describe('validateLetterboxdUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateLetterboxdUsername('deniz')).toBeNull();
    expect(validateLetterboxdUsername('ada_99')).toBeNull();
    expect(validateLetterboxdUsername('film-fan')).toBeNull();
    expect(validateLetterboxdUsername('AB')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(validateLetterboxdUsername('')).toBe('Username is required.');
    expect(validateLetterboxdUsername('  ')).toBe('Username is required.');
  });

  it('strips @ prefix before validating', () => {
    expect(validateLetterboxdUsername('@deniz')).toBeNull();
  });

  it('rejects single character', () => {
    expect(validateLetterboxdUsername('a')).toMatch(/at least 2/);
  });

  it('rejects usernames longer than 15 chars', () => {
    expect(validateLetterboxdUsername('abcdefghijklmnop')).toMatch(/at most 15/);
  });

  it('rejects spaces and special characters', () => {
    expect(validateLetterboxdUsername('user name')).toMatch(/can only contain/);
    expect(validateLetterboxdUsername('user!name')).toMatch(/can only contain/);
    expect(validateLetterboxdUsername('user@name')).toMatch(/can only contain/);
    expect(validateLetterboxdUsername('user.name')).toMatch(/can only contain/);
  });

  it('accepts exactly 2 and 15 chars (boundary)', () => {
    expect(validateLetterboxdUsername('ab')).toBeNull();
    expect(validateLetterboxdUsername('abcdefghijklmno')).toBeNull();
  });
});
