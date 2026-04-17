import type {
  PairWatchlistCandidate,
  PairWatchlistCounts,
} from './types';

export function selectPairCandidates(
  listA: string[],
  listB: string[],
  maxOverlap: number,
  maxNearMisses: number,
): {
  candidates: PairWatchlistCandidate[];
  counts: PairWatchlistCounts;
} {
  const setA = new Set(listA);
  const setB = new Set(listB);
  const overlap = listA.filter((slug) => setB.has(slug));
  const onlyA = listA.filter((slug) => !setB.has(slug));
  const onlyB = listB.filter((slug) => !setA.has(slug));

  const halfCap = Math.ceil(maxNearMisses / 2);
  const nearMisses: PairWatchlistCandidate[] = [];
  const cappedA = onlyA.slice(0, halfCap);
  const cappedB = onlyB.slice(0, halfCap);

  for (let index = 0; index < Math.max(cappedA.length, cappedB.length); index += 1) {
    if (index < cappedA.length) {
      nearMisses.push({ slug: cappedA[index], source: 'userA' });
    }
    if (index < cappedB.length) {
      nearMisses.push({ slug: cappedB[index], source: 'userB' });
    }
    if (nearMisses.length >= maxNearMisses) break;
  }

  const overlapToEnrich = overlap.slice(0, maxOverlap);
  const candidates = [
    ...overlapToEnrich.map((slug) => ({ slug, source: 'both' as const })),
    ...nearMisses,
  ];

  return {
    candidates,
    counts: {
      watchlistA: listA.length,
      watchlistB: listB.length,
      overlap: overlap.length,
      filtered: candidates.length,
      enriched: 0,
    },
  };
}
