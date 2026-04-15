import { describe, expect, it } from 'vitest';
import { validateLetterboxdUsername } from './slug';

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
