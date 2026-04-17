import { scrapeFilm } from '../letterboxdScrape';
import { buildEnrichedItem } from './itemFactory';
import { createDetailProgressReporter } from './progress';
import type {
  PairWatchlistCandidate,
  PairWatchlistItem,
  PairWatchlistProgress,
} from './types';

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function enrichPairCandidates(
  candidates: PairWatchlistCandidate[],
  detailConcurrency: number,
  onItem: ((item: PairWatchlistItem) => void) | undefined,
  onProgress: ((progress: PairWatchlistProgress) => void) | undefined,
): Promise<PairWatchlistItem[]> {
  if (candidates.length === 0) return [];

  const markProgress = createDetailProgressReporter(candidates.length, onProgress);
  const details = await runWithConcurrency(
    candidates,
    detailConcurrency,
    async ({ slug, source }) => {
      try {
        const details = await scrapeFilm(slug);
        const item = buildEnrichedItem(details, source);
        onItem?.(item);
        return item;
      } catch {
        return null;
      } finally {
        markProgress();
      }
    },
  );

  return details.filter((item): item is PairWatchlistItem => item !== null);
}
