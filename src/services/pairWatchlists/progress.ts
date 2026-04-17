import type { PageProgress } from '../letterboxdScrape';
import type { PairWatchlistProgress } from './types';

type ProgressHandler = ((progress: PairWatchlistProgress) => void) | undefined;

export function reportWatchlistStart(
  onProgress: ProgressHandler,
  userA: string,
  userB: string,
): void {
  onProgress?.({
    stage: 'watchlists',
    message: `Fetching @${userA} and @${userB}'s watchlists…`,
  });
}

export function createWatchlistProgressReporter(onProgress: ProgressHandler): {
  reportUserA: (progress: PageProgress) => void;
  reportUserB: (progress: PageProgress) => void;
} {
  const progress = {
    userA: { done: 0, total: 0 },
    userB: { done: 0, total: 0 },
  };

  const emit = () => {
    const done = progress.userA.done + progress.userB.done;
    const total = progress.userA.total + progress.userB.total;
    onProgress?.({
      stage: 'watchlists',
      message: total
        ? `Fetching watchlists… page ${done}/${total}`
        : `Fetching watchlists… ${done} pages so far`,
      pageLoaded: done,
      pageTotal: total,
    });
  };

  return {
    reportUserA: (pageProgress) => {
      progress.userA.done = pageProgress.page;
      progress.userA.total = pageProgress.total;
      emit();
    },
    reportUserB: (pageProgress) => {
      progress.userB.done = pageProgress.page;
      progress.userB.total = pageProgress.total;
      emit();
    },
  };
}

export function reportIntersection(
  onProgress: ProgressHandler,
  overlapCount: number,
): void {
  onProgress?.({
    stage: 'intersection',
    message: `Found ${overlapCount} shared film${overlapCount === 1 ? '' : 's'} — loading details…`,
  });
}

export function createDetailProgressReporter(
  total: number,
  onProgress: ProgressHandler,
): () => void {
  let loaded = 0;

  onProgress?.({
    stage: 'details',
    message: `Loading ${total} film${total === 1 ? '' : 's'}…`,
    detailsLoaded: 0,
    detailsTotal: total,
  });

  return () => {
    loaded += 1;
    onProgress?.({
      stage: 'details',
      message: `Loading films… ${loaded}/${total}`,
      detailsLoaded: loaded,
      detailsTotal: total,
    });
  };
}

export function reportDone(onProgress: ProgressHandler): void {
  onProgress?.({ stage: 'done', message: 'Done!' });
}
