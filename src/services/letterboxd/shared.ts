export const LETTERBOXD_BASE = 'https://letterboxd.com';
export const POSTER_WIDTH = 460;
export const FETCH_TIMEOUT_MS = 15_000;

export class LetterboxdScrapeError extends Error {
  constructor(
    message: string,
    public code: 'not-found' | 'private' | 'unknown' = 'unknown',
    public cause?: unknown,
  ) {
    super(message);
    this.name = 'LetterboxdScrapeError';
  }
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
