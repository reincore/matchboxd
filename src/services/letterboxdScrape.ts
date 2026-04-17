export { LetterboxdScrapeError } from './letterboxd/shared';
export {
  getListPageMeta,
  type ListPageMeta,
} from './letterboxd/listPageMeta';
export {
  resetProxyClientState,
  fetchHtml,
} from './letterboxd/proxyClient';
export {
  scrapeWatchlist,
  scrapeWatched,
  type PageProgress,
} from './letterboxd/watchlistScrape';
export {
  scrapeFilm,
  resetFilmDetailsCache,
  upscalePoster,
  type LetterboxdFilmDetails,
} from './letterboxd/filmScrape';
