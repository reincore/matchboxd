import { describe, expect, it } from 'vitest';
import {
  candidateAffinityFor,
  clamp01,
  mapSimilarity,
  moodFitScore,
  passesHardConstraints,
  scoreCandidate,
  type CandidateAttrs,
} from './scoring';
import type { TasteProfile, Mood } from '../types';

function makeProfile(overrides: Partial<TasteProfile> = {}): TasteProfile {
  return {
    username: 'test',
    fetched: true,
    entryCount: 50,
    ratedCount: 40,
    averageRating: 3.8,
    genreAffinity: {},
    decadeAffinity: {},
    directorAffinity: {},
    watchlistSlugs: new Set(),
    seenSlugs: new Set(),
    highRatedSlugs: new Set(),
    topTitles: [],
    confidence: 'high',
    ...overrides,
  };
}

describe('clamp01', () => {
  it('clamps values to 0-1 range', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });

  it('returns 0 for NaN', () => {
    expect(clamp01(NaN)).toBe(0);
  });
});

describe('mapSimilarity', () => {
  it('returns 1 for identical maps', () => {
    const m = { Drama: 0.8, Comedy: 0.6 };
    expect(mapSimilarity(m, m)).toBeCloseTo(1, 5);
  });

  it('returns 0 when one map is empty', () => {
    expect(mapSimilarity({}, { Drama: 1 })).toBe(0);
  });

  it('returns 0 for orthogonal maps', () => {
    // Maps that share keys but one has all zeros
    expect(mapSimilarity({ Drama: 0 }, { Drama: 1 })).toBe(0);
  });
});

describe('candidateAffinityFor', () => {
  it('scores higher when candidate genres match profile affinity', () => {
    const profile = makeProfile({ genreAffinity: { Drama: 0.9, Romance: 0.7 } });
    const matching: CandidateAttrs = { genres: ['Drama', 'Romance'], directors: [], year: 2020 };
    const nonMatching: CandidateAttrs = { genres: ['Horror', 'Action'], directors: [], year: 2020 };

    expect(candidateAffinityFor(matching, profile)).toBeGreaterThan(
      candidateAffinityFor(nonMatching, profile),
    );
  });

  it('returns 0 for empty genres and affinities', () => {
    const profile = makeProfile();
    const attrs: CandidateAttrs = { genres: [], directors: [] };
    expect(candidateAffinityFor(attrs, profile)).toBe(0);
  });
});

describe('moodFitScore', () => {
  it('returns neutral baseline when no mood is selected', () => {
    const attrs: CandidateAttrs = { genres: ['Drama'], directors: [] };
    expect(moodFitScore(attrs, null)).toBe(0.6);
  });

  const moodGenrePairs: [Mood, string][] = [
    ['easy', 'Comedy'],
    ['intense', 'Thriller'],
    ['emotional', 'Drama'],
    ['weird', 'Science Fiction'],
    ['cozy', 'Romance'],
  ];

  for (const [mood, genre] of moodGenrePairs) {
    it(`boosts ${genre} for '${mood}' mood`, () => {
      const matching: CandidateAttrs = { genres: [genre], directors: [] };
      const nonMatching: CandidateAttrs = { genres: ['Documentary'], directors: [] };
      expect(moodFitScore(matching, mood)).toBeGreaterThan(moodFitScore(nonMatching, mood));
    });
  }

  it('penalizes horror for cozy mood', () => {
    const horror: CandidateAttrs = { genres: ['Horror'], directors: [] };
    const comedy: CandidateAttrs = { genres: ['Comedy'], directors: [] };
    expect(moodFitScore(horror, 'cozy')).toBeLessThan(moodFitScore(comedy, 'cozy'));
  });
});

describe('passesHardConstraints', () => {
  it('excludes long films when short-runtime is set', () => {
    expect(passesHardConstraints({ genres: [], directors: [], runtime: 130 }, ['short-runtime'])).toBe(false);
    expect(passesHardConstraints({ genres: [], directors: [], runtime: 90 }, ['short-runtime'])).toBe(true);
  });

  it('excludes short films when long-runtime is set', () => {
    expect(passesHardConstraints({ genres: [], directors: [], runtime: 100 }, ['long-runtime'])).toBe(false);
    expect(passesHardConstraints({ genres: [], directors: [], runtime: 150 }, ['long-runtime'])).toBe(true);
  });

  it('excludes horror when no-horror is set', () => {
    expect(passesHardConstraints({ genres: ['Horror'], directors: [] }, ['no-horror'])).toBe(false);
    expect(passesHardConstraints({ genres: ['Drama'], directors: [] }, ['no-horror'])).toBe(true);
  });

  it('excludes animation when no-animation is set', () => {
    expect(passesHardConstraints({ genres: ['Animation'], directors: [] }, ['no-animation'])).toBe(false);
  });

  it('classic excludes year >= 2000', () => {
    expect(passesHardConstraints({ genres: [], directors: [], year: 2005 }, ['classic'])).toBe(false);
    expect(passesHardConstraints({ genres: [], directors: [], year: 1995 }, ['classic'])).toBe(true);
  });

  it('modern excludes year < 2015', () => {
    expect(passesHardConstraints({ genres: [], directors: [], year: 2010 }, ['modern'])).toBe(false);
    expect(passesHardConstraints({ genres: [], directors: [], year: 2020 }, ['modern'])).toBe(true);
  });

  it('passes with no constraints', () => {
    expect(passesHardConstraints({ genres: ['Horror'], directors: [], runtime: 200, year: 1950 }, [])).toBe(true);
  });
});

describe('scoreCandidate', () => {
  it('returns excluded = true when hard constraints fail', () => {
    const profile = makeProfile({ genreAffinity: { Horror: 0.9 } });
    const result = scoreCandidate({
      attrs: { genres: ['Horror'], directors: [], runtime: 90 },
      profileA: profile,
      profileB: profile,
      filters: { mood: null, constraints: ['no-horror'] },
    });
    expect(result.excluded).toBe(true);
    expect(result.finalScore).toBe(0);
  });

  it('assigns shared ownership when affinities are close', () => {
    const profileA = makeProfile({ genreAffinity: { Drama: 0.8 } });
    const profileB = makeProfile({ genreAffinity: { Drama: 0.75 } });
    const result = scoreCandidate({
      attrs: { genres: ['Drama'], directors: [] },
      profileA,
      profileB,
      filters: { mood: null, constraints: [] },
    });
    expect(result.ownership).toBe('shared');
  });

  it('assigns userA/userB ownership when affinities differ', () => {
    const profileA = makeProfile({ genreAffinity: { Drama: 0.9 } });
    const profileB = makeProfile({ genreAffinity: {} });
    const result = scoreCandidate({
      attrs: { genres: ['Drama'], directors: [] },
      profileA,
      profileB,
      filters: { mood: null, constraints: [] },
    });
    expect(result.ownership).toBe('userA');
  });
});
