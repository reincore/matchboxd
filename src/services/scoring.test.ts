import { describe, expect, it } from 'vitest';
import {
  buildReasons,
  candidateAffinityFor,
  clamp01,
  mapSimilarity,
  moodFitScore,
  passesHardConstraints,
  scoreCandidate,
} from './scoring';
import type { TasteProfile } from '../types';

function makeProfile(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return {
    username: 'test',
    fetched: true,
    entryCount: 20,
    ratedCount: 10,
    averageRating: 3.7,
    genreAffinity: { Drama: 1, Thriller: 0.7, Comedy: 0.3 },
    decadeAffinity: { '1990': 0.4, '2010': 1.0 },
    directorAffinity: { 'David Fincher': 1 },
    watchlistSlugs: new Set(),
    seenSlugs: new Set(),
    highRatedSlugs: new Set(),
    topTitles: [],
    confidence: 'moderate',
    ...overrides,
  };
}

describe('clamp01', () => {
  it('clamps to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
  });
});

describe('mapSimilarity', () => {
  it('returns 0 when either side is empty', () => {
    expect(mapSimilarity({}, { a: 1 })).toBe(0);
    expect(mapSimilarity({ a: 1 }, {})).toBe(0);
  });
  it('returns 1 for identical maps', () => {
    expect(mapSimilarity({ a: 1, b: 0.5 }, { a: 1, b: 0.5 })).toBeCloseTo(1, 5);
  });
  it('returns 0 for disjoint maps', () => {
    expect(mapSimilarity({ a: 1 }, { b: 1 })).toBe(0);
  });
  it('is symmetric', () => {
    const x = mapSimilarity({ a: 1, b: 0.3 }, { a: 0.5, b: 0.7 });
    const y = mapSimilarity({ a: 0.5, b: 0.7 }, { a: 1, b: 0.3 });
    expect(x).toBeCloseTo(y, 6);
  });
});

describe('candidateAffinityFor', () => {
  it('scores higher when genres align', () => {
    const profile = makeProfile();
    const drama = candidateAffinityFor({ genres: ['Drama'], directors: [] }, profile);
    const comedy = candidateAffinityFor({ genres: ['Comedy'], directors: [] }, profile);
    expect(drama).toBeGreaterThan(comedy);
  });
  it('rewards director match', () => {
    const profile = makeProfile();
    const withDirector = candidateAffinityFor(
      { genres: ['Drama'], directors: ['David Fincher'] },
      profile,
    );
    const without = candidateAffinityFor(
      { genres: ['Drama'], directors: ['Nobody'] },
      profile,
    );
    expect(withDirector).toBeGreaterThan(without);
  });
  it('rewards decade match', () => {
    const profile = makeProfile();
    const modern = candidateAffinityFor(
      { genres: ['Drama'], directors: [], year: 2015 },
      profile,
    );
    const other = candidateAffinityFor(
      { genres: ['Drama'], directors: [], year: 1980 },
      profile,
    );
    expect(modern).toBeGreaterThanOrEqual(other);
  });
});

describe('moodFitScore', () => {
  it('boosts comedy for easy mood', () => {
    const easy = moodFitScore({ genres: ['Comedy'], directors: [] }, 'easy');
    const horror = moodFitScore({ genres: ['Horror'], directors: [] }, 'easy');
    expect(easy).toBeGreaterThan(horror);
  });
  it('boosts horror/thriller for intense', () => {
    const intense = moodFitScore({ genres: ['Thriller', 'Crime'], directors: [] }, 'intense');
    const family = moodFitScore({ genres: ['Family'], directors: [] }, 'intense');
    expect(intense).toBeGreaterThan(family);
  });
  it('returns baseline when mood is null', () => {
    expect(moodFitScore({ genres: [], directors: [] }, null)).toBeCloseTo(0.6, 2);
  });
});

describe('passesHardConstraints', () => {
  const attrs = {
    genres: ['Drama'],
    directors: [],
    year: 2020,
    runtime: 120,
  };

  it('enforces short-runtime', () => {
    expect(passesHardConstraints({ ...attrs, runtime: 140 }, ['short-runtime'])).toBe(false);
    expect(passesHardConstraints({ ...attrs, runtime: 90 }, ['short-runtime'])).toBe(true);
  });
  it('enforces long-runtime', () => {
    expect(passesHardConstraints({ ...attrs, runtime: 100 }, ['long-runtime'])).toBe(false);
    expect(passesHardConstraints({ ...attrs, runtime: 150 }, ['long-runtime'])).toBe(true);
  });
  it('enforces classic / modern', () => {
    expect(passesHardConstraints({ ...attrs, year: 2020 }, ['classic'])).toBe(false);
    expect(passesHardConstraints({ ...attrs, year: 1988 }, ['classic'])).toBe(true);
    expect(passesHardConstraints({ ...attrs, year: 2010 }, ['modern'])).toBe(false);
    expect(passesHardConstraints({ ...attrs, year: 2020 }, ['modern'])).toBe(true);
  });
  it('excludes horror and animation', () => {
    expect(passesHardConstraints({ ...attrs, genres: ['Horror'] }, ['no-horror'])).toBe(false);
    expect(passesHardConstraints({ ...attrs, genres: ['Animation'] }, ['no-animation'])).toBe(false);
  });
});

describe('scoreCandidate', () => {
  it('zeros out excluded candidates', () => {
    const profile = makeProfile();
    const result = scoreCandidate({
      attrs: { genres: ['Horror'], directors: [], runtime: 100, year: 2020 },
      profileA: profile,
      profileB: profile,
      filters: { mood: 'easy', constraints: ['no-horror'] },
    });
    expect(result.excluded).toBe(true);
    expect(result.finalScore).toBe(0);
  });
  it('produces higher scores when both profiles overlap', () => {
    const profile = makeProfile();
    const aligned = scoreCandidate({
      attrs: { genres: ['Drama'], directors: [], runtime: 110, year: 2015 },
      profileA: profile,
      profileB: profile,
      filters: { mood: 'emotional', constraints: [] },
    });
    const misaligned = scoreCandidate({
      attrs: { genres: ['War'], directors: [], runtime: 110, year: 2015 },
      profileA: profile,
      profileB: profile,
      filters: { mood: 'emotional', constraints: [] },
    });
    expect(aligned.finalScore).toBeGreaterThan(misaligned.finalScore);
  });
  it('labels ownership based on diff', () => {
    const profileA = makeProfile({ genreAffinity: { Drama: 1 } });
    const profileB = makeProfile({ genreAffinity: { Comedy: 1 } });
    const r = scoreCandidate({
      attrs: { genres: ['Drama'], directors: [], runtime: 100, year: 2020 },
      profileA,
      profileB,
      filters: { mood: null, constraints: [] },
    });
    expect(r.ownership).toBe('userA');
  });
});

describe('buildReasons', () => {
  it('produces at least one reason when overlap exists', () => {
    const profileA = makeProfile({ username: 'deniz', genreAffinity: { Drama: 1 } });
    const profileB = makeProfile({ username: 'ada', genreAffinity: { Drama: 0.9 } });
    const attrs = { genres: ['Drama'], directors: [], year: 2015 };
    const score = scoreCandidate({
      attrs,
      profileA,
      profileB,
      filters: { mood: 'emotional', constraints: [] },
    });
    const reasons = buildReasons(attrs, profileA, profileB, score, {
      mood: 'emotional',
      constraints: [],
    });
    expect(reasons.length).toBeGreaterThan(0);
  });
});
