// Given swiped candidates, bucket them into the result categories and pick
// a best mutual fit / safest pick / adventure pick / zone picks.

import type { MovieCandidate, ResultBundle } from '../types';

export function buildResults(candidates: MovieCandidate[]): ResultBundle {
  const mutuals = candidates.filter(
    (c) =>
      (c.userAState === 'yes' || c.userAState === 'super') &&
      (c.userBState === 'yes' || c.userBState === 'super'),
  );

  // Rank mutuals by final score plus a small super-like bonus.
  const ranked = [...mutuals].sort((a, b) => {
    const boostA =
      (a.userAState === 'super' ? 0.05 : 0) + (a.userBState === 'super' ? 0.05 : 0);
    const boostB =
      (b.userAState === 'super' ? 0.05 : 0) + (b.userBState === 'super' ? 0.05 : 0);
    return b.finalScore + boostB - (a.finalScore + boostA);
  });

  const bestMutualFit = ranked[0];

  // Safest pick: highest-scored among deterministic categories OR highest
  // confidence OR shared-affinity candidate (the least risky yes).
  const safestPool = ranked.filter(
    (c) =>
      c.recommendationKind === 'deterministic' ||
      c.confidence === 'high' ||
      (c.recommendationCategory === 'taste-match' && !c.ownership),
  );
  const safestPick = (safestPool[0] ?? ranked[1]) as MovieCandidate | undefined;

  // Adventure pick: a candidate with weirder/stretchier profile. Prefer
  // stretch picks; otherwise pick the highest-scored candidate with genres
  // like Mystery/Sci-Fi/Fantasy/Horror/Weird tags.
  const weirdGenres = new Set([
    'Mystery',
    'Science Fiction',
    'Fantasy',
    'Horror',
    'War',
  ]);
  const adventurePool = ranked.filter(
    (c) =>
      c.recommendationCategory === 'stretch-pick' ||
      c.genres.some((g) => weirdGenres.has(g)),
  );
  const adventurePick = (adventurePool[0] ?? ranked[2]) as MovieCandidate | undefined;

  // Zone picks: surfaces the best "userA-owned" and "userB-owned" candidate
  // even if not mutual — helpful when they couldn't agree, to see bridges.
  const inYourZone = candidates
    .filter((c) => c.ownership === 'userA' && c.userBState !== 'no')
    .sort((a, b) => b.finalScore - a.finalScore)[0];
  const inTheirZone = candidates
    .filter((c) => c.ownership === 'userB' && c.userAState !== 'no')
    .sort((a, b) => b.finalScore - a.finalScore)[0];

  // True overlap: watchlist or rewatch that was a mutual yes.
  const trueOverlap = ranked.find(
    (c) =>
      c.recommendationCategory === 'watchlist-overlap' ||
      c.recommendationCategory === 'rewatch',
  );

  // Dedupe: avoid pointing at the same title twice.
  const used = new Set<string>();
  const takeUnique = (c: MovieCandidate | undefined) => {
    if (!c) return undefined;
    if (used.has(c.id)) return undefined;
    used.add(c.id);
    return c;
  };

  return {
    bestMutualFit: takeUnique(bestMutualFit),
    safestPick: takeUnique(safestPick),
    adventurePick: takeUnique(adventurePick),
    inYourZone: takeUnique(inYourZone),
    inTheirZone: takeUnique(inTheirZone),
    trueOverlap: takeUnique(trueOverlap),
    allMutuals: ranked,
  };
}

export function pickTiebreaker(
  a: MovieCandidate,
  b: MovieCandidate,
): MovieCandidate {
  // Super-likes win decisively.
  const aSuper =
    (a.userAState === 'super' ? 1 : 0) + (a.userBState === 'super' ? 1 : 0);
  const bSuper =
    (b.userAState === 'super' ? 1 : 0) + (b.userBState === 'super' ? 1 : 0);
  if (aSuper !== bSuper) return aSuper > bSuper ? a : b;
  return a.finalScore >= b.finalScore ? a : b;
}
