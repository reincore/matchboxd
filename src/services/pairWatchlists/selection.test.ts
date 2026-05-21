import { describe, expect, it } from 'vitest';
import { selectPairCandidates } from './selection';

describe('selectPairCandidates', () => {
  it('keeps shared films first and alternates near misses from each user', () => {
    const result = selectPairCandidates(
      ['shared-a', 'only-a-1', 'only-a-2', 'shared-b'],
      ['only-b-1', 'shared-a', 'only-b-2', 'shared-b'],
      10,
      4,
    );

    expect(result.candidates).toEqual([
      { slug: 'shared-a', source: 'both' },
      { slug: 'shared-b', source: 'both' },
      { slug: 'only-a-1', source: 'userA' },
      { slug: 'only-b-1', source: 'userB' },
      { slug: 'only-a-2', source: 'userA' },
      { slug: 'only-b-2', source: 'userB' },
    ]);
    expect(result.counts).toEqual({
      watchlistA: 4,
      watchlistB: 4,
      overlap: 2,
      filtered: 6,
      enriched: 0,
    });
  });

  it('applies overlap and near-miss caps independently', () => {
    const result = selectPairCandidates(
      ['shared-a', 'shared-b', 'only-a-1', 'only-a-2'],
      ['shared-a', 'shared-b', 'only-b-1', 'only-b-2'],
      1,
      2,
    );

    expect(result.candidates).toEqual([
      { slug: 'shared-a', source: 'both' },
      { slug: 'only-a-1', source: 'userA' },
      { slug: 'only-b-1', source: 'userB' },
    ]);
    expect(result.counts).toMatchObject({
      overlap: 2,
      filtered: 3,
      enriched: 0,
    });
  });
});
