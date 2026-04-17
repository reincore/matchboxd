import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildJustWatchSearchUrl,
  buildJustWatchSearchUrlForCountry,
  getCountryOverride,
  getDetectedCountry,
  setCountryFromHeader,
  setCountryOverride,
} from './countryDetection';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

beforeEach(() => {
  localStorageMock.clear();
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getDetectedCountry', () => {
  it('returns "us" as default when no signals are available', () => {
    // No localStorage entries, mock Intl to return empty tz
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(getDetectedCountry()).toBe('us');
  });

  it('returns timezone-based country when no cache or override', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Istanbul' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(getDetectedCountry()).toBe('tr');
  });

  it('returns cached worker country over timezone', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Istanbul' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);

    // Simulate cached worker result
    localStorageMock.setItem(
      'matchboxd:country:v1',
      JSON.stringify({ code: 'ee', ts: Date.now() }),
    );

    expect(getDetectedCountry()).toBe('ee');
  });

  it('returns manual override over everything else', () => {
    localStorageMock.setItem(
      'matchboxd:country:v1',
      JSON.stringify({ code: 'ee', ts: Date.now() }),
    );
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Istanbul' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);

    setCountryOverride('de');
    expect(getDetectedCountry()).toBe('de');
  });

  it('falls through expired cache to timezone', () => {
    const expired = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorageMock.setItem(
      'matchboxd:country:v1',
      JSON.stringify({ code: 'ee', ts: expired }),
    );
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);

    expect(getDetectedCountry()).toBe('jp');
  });
});

describe('setCountryFromHeader', () => {
  it('caches valid country from response header', () => {
    const res = new Response('', {
      headers: { 'X-Client-Country': 'TR' },
    });
    setCountryFromHeader(res);
    expect(getDetectedCountry()).toBe('tr');
  });

  it('ignores XX (unknown IP)', () => {
    const res = new Response('', {
      headers: { 'X-Client-Country': 'XX' },
    });
    setCountryFromHeader(res);
    // Should still fall through to default
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(getDetectedCountry()).toBe('us');
  });

  it('ignores T1 (Tor exit)', () => {
    const res = new Response('', {
      headers: { 'X-Client-Country': 'T1' },
    });
    setCountryFromHeader(res);
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(getDetectedCountry()).toBe('us');
  });

  it('ignores empty header', () => {
    const res = new Response('');
    setCountryFromHeader(res);
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }) as Intl.ResolvedDateTimeFormatOptions,
    } as Intl.DateTimeFormat);
    expect(getDetectedCountry()).toBe('us');
  });
});

describe('setCountryOverride / getCountryOverride', () => {
  it('sets and gets an override', () => {
    expect(getCountryOverride()).toBeNull();
    setCountryOverride('fr');
    expect(getCountryOverride()).toBe('fr');
  });

  it('clears override with null', () => {
    setCountryOverride('fr');
    expect(getCountryOverride()).toBe('fr');
    setCountryOverride(null);
    expect(getCountryOverride()).toBeNull();
  });

  it('ignores invalid country codes', () => {
    setCountryOverride('zz');
    expect(getCountryOverride()).toBeNull();
  });
});

describe('buildJustWatchSearchUrl', () => {
  it('uses detected country and localized search path', () => {
    setCountryOverride('tr');
    expect(buildJustWatchSearchUrl('Inception', 2010)).toBe(
      'https://www.justwatch.com/tr/arama?q=Inception%202010',
    );
  });

  it('uses "search" for countries without localized path', () => {
    setCountryOverride('us');
    expect(buildJustWatchSearchUrl('Inception', 2010)).toBe(
      'https://www.justwatch.com/us/search?q=Inception%202010',
    );
  });

  it('omits year when not provided', () => {
    setCountryOverride('de');
    expect(buildJustWatchSearchUrl('Matrix')).toBe(
      'https://www.justwatch.com/de/Suche?q=Matrix',
    );
  });

  it('builds a URL for an explicit country code', () => {
    expect(buildJustWatchSearchUrlForCountry('Perfect Days', 2023, 'tr')).toBe(
      'https://www.justwatch.com/tr/arama?q=Perfect%20Days%202023',
    );
  });
});
