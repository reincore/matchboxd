// Pure scoring utilities. All logic here is inspectable and deterministic.
// No ML, no external services — just transparent heuristics.

import type {
  Constraint,
  FilterSelection,
  Mood,
  MovieCandidate,
  TasteProfile,
} from '../types';

/** Cosine-ish similarity over a sparse named affinity map. */
export function mapSimilarity(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (keys.size === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** How well does a candidate's attributes match a user's affinity maps? */
export interface CandidateAttrs {
  genres: string[];
  directors: string[];
  year?: number;
  runtime?: number;
}

export function candidateAffinityFor(
  candidate: CandidateAttrs,
  profile: TasteProfile,
): number {
  const genreScore = averageTopK(
    candidate.genres.map((g) => profile.genreAffinity[g] ?? 0),
    3,
  );
  const directorScore = averageTopK(
    candidate.directors.map((d) => profile.directorAffinity[d] ?? 0),
    2,
  );
  const decadeScore = candidate.year
    ? (profile.decadeAffinity[String(Math.floor(candidate.year / 10) * 10)] ?? 0)
    : 0;

  // Weighted blend; genre does the most work because everyone has genre data,
  // decade is a mild nudge, directors only when data is rich.
  const raw = 0.58 * genreScore + 0.27 * decadeScore + 0.15 * directorScore;
  return clamp01(raw);
}

function averageTopK(values: number[], k: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => b - a).slice(0, k);
  return sorted.reduce((s, v) => s + v, 0) / sorted.length;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// -------- Mood fit --------

/** Returns 0..1 describing how well candidate vibes match the requested mood. */
export function moodFitScore(
  attrs: CandidateAttrs,
  mood: Mood | null,
): number {
  if (!mood) return 0.6; // neutral baseline

  const g = new Set(attrs.genres.map((x) => x.toLowerCase()));
  const runtime = attrs.runtime ?? 110;

  switch (mood) {
    case 'easy':
      return clamp01(
        0.4 +
          (g.has('comedy') ? 0.3 : 0) +
          (g.has('family') ? 0.15 : 0) +
          (g.has('adventure') ? 0.1 : 0) +
          (runtime <= 110 ? 0.1 : -0.1) -
          (g.has('horror') ? 0.4 : 0) -
          (g.has('war') ? 0.2 : 0),
      );
    case 'intense':
      return clamp01(
        0.35 +
          (g.has('thriller') ? 0.3 : 0) +
          (g.has('crime') ? 0.2 : 0) +
          (g.has('action') ? 0.15 : 0) +
          (g.has('horror') ? 0.15 : 0) +
          (g.has('mystery') ? 0.1 : 0) -
          (g.has('family') ? 0.3 : 0) -
          (g.has('comedy') && !g.has('drama') ? 0.15 : 0),
      );
    case 'emotional':
      return clamp01(
        0.4 +
          (g.has('drama') ? 0.3 : 0) +
          (g.has('romance') ? 0.2 : 0) +
          (g.has('music') ? 0.1 : 0) -
          (g.has('action') ? 0.2 : 0) -
          (g.has('horror') ? 0.2 : 0),
      );
    case 'weird':
      return clamp01(
        0.35 +
          (g.has('science fiction') ? 0.2 : 0) +
          (g.has('fantasy') ? 0.2 : 0) +
          (g.has('mystery') ? 0.15 : 0) +
          (g.has('animation') ? 0.1 : 0) +
          (g.has('horror') ? 0.1 : 0) -
          (g.has('family') ? 0.1 : 0),
      );
    case 'cozy':
      return clamp01(
        0.45 +
          (g.has('romance') ? 0.2 : 0) +
          (g.has('comedy') ? 0.2 : 0) +
          (g.has('family') ? 0.2 : 0) +
          (runtime <= 115 ? 0.1 : -0.05) -
          (g.has('horror') ? 0.4 : 0) -
          (g.has('war') ? 0.3 : 0) -
          (g.has('thriller') ? 0.2 : 0),
      );
  }
}

// -------- Hard constraints --------

/** Returns:
 *   true  -> passes
 *   false -> hard-excluded (returns 0 availability/fit score)
 */
export function passesHardConstraints(
  attrs: CandidateAttrs & { hasTrProvider?: boolean },
  constraints: Constraint[],
): boolean {
  const g = new Set(attrs.genres.map((x) => x.toLowerCase()));
  const runtime = attrs.runtime ?? 110;
  const year = attrs.year ?? 0;

  for (const c of constraints) {
    switch (c) {
      case 'short-runtime':
        if (runtime > 105) return false;
        break;
      case 'long-runtime':
        if (runtime < 130) return false;
        break;
      case 'classic':
        if (year >= 2000 || year === 0) return false;
        break;
      case 'modern':
        if (year > 0 && year < 2015) return false;
        break;
      case 'no-horror':
        if (g.has('horror')) return false;
        break;
      case 'no-animation':
        if (g.has('animation')) return false;
        break;
      case 'no-subtitles':
        // Soft heuristic: we can't easily know original language here.
        // We approximate by excluding nothing hard — it becomes a tiebreaker later.
        break;
      case 'available-tr':
        // Treat as soft here; scoring applies it as availabilityFit.
        break;
    }
  }
  return true;
}

// -------- Final scoring --------

export interface ScoreInputs {
  attrs: CandidateAttrs & { hasTrProvider?: boolean };
  profileA: TasteProfile;
  profileB: TasteProfile;
  filters: FilterSelection;
}

export interface ScoreResult {
  finalScore: number;
  moodFit: number;
  availabilityFit: number;
  affinityA: number;
  affinityB: number;
  excluded: boolean;
  ownership: 'userA' | 'userB' | 'shared';
}

/** Compute all score components for a candidate. */
export function scoreCandidate(inputs: ScoreInputs): ScoreResult {
  const { attrs, profileA, profileB, filters } = inputs;

  const excluded = !passesHardConstraints(attrs, filters.constraints);
  const affinityA = candidateAffinityFor(attrs, profileA);
  const affinityB = candidateAffinityFor(attrs, profileB);
  const mood = moodFitScore(attrs, filters.mood);

  // Availability fit is a soft score: if "available-tr" is set, candidates with
  // a TR provider get full credit, others get partial credit. If the constraint
  // is not set, availability doesn't affect score.
  let availabilityFit = 1;
  if (filters.constraints.includes('available-tr')) {
    availabilityFit = attrs.hasTrProvider ? 1 : 0.35;
  }
  // Soft "no-subtitles" nudges toward English-language candidates — we don't
  // know language reliably here, so we leave it as a zero-impact marker.

  // Balance affinity: reward candidates that don't leave either person out.
  const minAff = Math.min(affinityA, affinityB);
  const avgAff = (affinityA + affinityB) / 2;
  const balanced = 0.55 * minAff + 0.45 * avgAff;

  // Blend components. Mood is dominant once a mood is picked.
  let finalScore =
    0.5 * balanced + (filters.mood ? 0.35 : 0.25) * mood + 0.15 * availabilityFit;

  if (excluded) finalScore = 0;

  const diff = affinityA - affinityB;
  const ownership: ScoreResult['ownership'] =
    Math.abs(diff) < 0.12 ? 'shared' : diff > 0 ? 'userA' : 'userB';

  return {
    finalScore: clamp01(finalScore),
    moodFit: mood,
    availabilityFit,
    affinityA,
    affinityB,
    excluded,
    ownership,
  };
}

// -------- Explanation reasons --------

export function buildReasons(
  attrs: CandidateAttrs,
  profileA: TasteProfile,
  profileB: TasteProfile,
  score: ScoreResult,
  filters: FilterSelection,
): string[] {
  const reasons: string[] = [];
  const g = attrs.genres;

  // Shared top-genre overlap.
  const topA = topKeys(profileA.genreAffinity, 3);
  const topB = topKeys(profileB.genreAffinity, 3);
  const sharedTopGenres = g.filter(
    (x) => topA.includes(x) && topB.includes(x),
  );
  if (sharedTopGenres.length) {
    reasons.push(`shared love of ${sharedTopGenres[0].toLowerCase()}`);
  } else {
    const oneSided = g.find((x) => topA.includes(x) || topB.includes(x));
    if (oneSided) {
      const who = topA.includes(oneSided) ? profileA.username : profileB.username;
      reasons.push(`fits ${who}'s ${oneSided.toLowerCase()} zone`);
    }
  }

  // Director overlap.
  const sharedDir = attrs.directors.find(
    (d) => profileA.directorAffinity[d] && profileB.directorAffinity[d],
  );
  if (sharedDir) reasons.push(`both into ${sharedDir}`);

  // Decade overlap.
  if (attrs.year) {
    const dec = String(Math.floor(attrs.year / 10) * 10);
    if (profileA.decadeAffinity[dec] > 0.4 && profileB.decadeAffinity[dec] > 0.4) {
      reasons.push(`strong ${dec}s overlap`);
    }
  }

  // Mood.
  if (filters.mood && score.moodFit >= 0.65) {
    reasons.push(`fits your ${filters.mood} mood tonight`);
  } else if (filters.mood && score.moodFit <= 0.35) {
    reasons.push(`stretches past your ${filters.mood} mood`);
  }

  // Ownership.
  if (score.ownership === 'userA') {
    reasons.push(`closer to ${profileA.username}'s taste zone`);
  } else if (score.ownership === 'userB') {
    reasons.push(`closer to ${profileB.username}'s taste zone`);
  }

  // Runtime.
  if (attrs.runtime) {
    if (attrs.runtime <= 95) reasons.push('short and tight');
    else if (attrs.runtime >= 150) reasons.push('a commitment, but worth it');
  }

  // Dedup + cap.
  return Array.from(new Set(reasons)).slice(0, 4);
}

function topKeys(rec: Record<string, number>, k: number): string[] {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([name]) => name);
}

export function confidenceForCandidate(
  candidate: Pick<MovieCandidate, 'recommendationKind'>,
  profileA: TasteProfile,
  profileB: TasteProfile,
): 'high' | 'moderate' | 'exploratory' {
  if (candidate.recommendationKind === 'deterministic') return 'high';
  if (profileA.confidence === 'high' && profileB.confidence === 'high')
    return 'high';
  if (profileA.confidence === 'exploratory' || profileB.confidence === 'exploratory')
    return 'exploratory';
  return 'moderate';
}
