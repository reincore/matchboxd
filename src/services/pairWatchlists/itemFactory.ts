import {
  getListPageMeta,
  upscalePoster,
  type LetterboxdFilmDetails,
} from '../letterboxdScrape';
import { slugToTitle } from '../../utils/slug';
import type {
  ItemSource,
  PairWatchlistItem,
} from './types';

export function buildStubItem(
  slug: string,
  source: ItemSource,
): PairWatchlistItem {
  const meta = getListPageMeta(slug);
  return {
    slug,
    title: meta?.title ?? slugToTitle(slug),
    year: meta?.year,
    posterUrl: meta?.posterUrl,
    genres: [],
    directors: [],
    letterboxdUrl: `https://letterboxd.com/film/${slug}/`,
    source,
    enriched: false,
  };
}

export function buildEnrichedItem(
  details: LetterboxdFilmDetails,
  source: ItemSource,
): PairWatchlistItem {
  return {
    slug: details.slug,
    title: details.title,
    year: details.year,
    posterUrl: upscalePoster(details.posterUrl, 460),
    synopsis: details.synopsis,
    runtime: details.runtime,
    genres: details.genres,
    directors: details.directors,
    lbRating: details.lbRating,
    lbRatingCount: details.lbRatingCount,
    letterboxdUrl: `https://letterboxd.com/film/${details.slug}/`,
    source,
    enriched: true,
  };
}
