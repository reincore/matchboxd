import type { ConfidenceLevel } from '../types';

/**
 * Map a rough signal count to a confidence bucket.
 * Signals = rated entries + watchlist items + reviews, roughly.
 */
export function confidenceFromSignals(signalCount: number): ConfidenceLevel {
  if (signalCount >= 40) return 'high';
  if (signalCount >= 12) return 'moderate';
  return 'exploratory';
}

export function combineConfidence(
  a: ConfidenceLevel,
  b: ConfidenceLevel,
): ConfidenceLevel {
  const order: ConfidenceLevel[] = ['exploratory', 'moderate', 'high'];
  const min = Math.min(order.indexOf(a), order.indexOf(b));
  return order[min];
}

export function confidenceLabel(c: ConfidenceLevel): string {
  switch (c) {
    case 'high':
      return 'high confidence';
    case 'moderate':
      return 'moderate confidence';
    case 'exploratory':
      return 'exploratory pick';
  }
}
