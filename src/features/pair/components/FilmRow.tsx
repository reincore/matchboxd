import { memo } from 'react';
import { Poster } from '../../../components/Poster';
import { Pill } from '../../../components/ui/Pill';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import type { ItemSource, PairWatchlistItem } from '../../../services/pairWatchlists';
import { buildJustWatchSearchUrlForCountry } from '../../../services/countryDetection';
import { formatCount } from '../filters';

function SourceBadge({ source, userA, userB }: { source: ItemSource; userA: string; userB: string }) {
  if (source === 'both') return null;
  const label = source === 'userA' ? `@${userA}` : `@${userB}`;
  return (
    <Pill tone={source === 'userA' ? 'accent' : 'info'} className="font-medium">
      {label} only
    </Pill>
  );
}

function RatingPill({ rating, count }: { rating: number; count?: number }) {
  const stars = rating.toFixed(2);
  return (
    <Pill tone="accent" className="font-medium">
      <span aria-hidden>★</span>
      {stars}
      {count && count > 0 && (
        <span className="text-ink-400 font-normal ml-0.5">
          · {formatCount(count)}
        </span>
      )}
    </Pill>
  );
}

function MetaPill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Pill tone={muted ? 'muted' : 'neutral'}>{children}</Pill>;
}

function ArrowIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 17L17 7M10 7h7v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface FilmRowProps {
  item: PairWatchlistItem;
  userA: string;
  userB: string;
  country: string;
}

export const FilmRow = memo(function FilmRow({
  item, userA, userB, country,
}: FilmRowProps) {
  const jwUrl = buildJustWatchSearchUrlForCountry(item.title, item.year, country);

  return (
    <SurfaceCard padding="none" className="flex gap-3 p-3 xl:gap-4 xl:p-4">
      <a
        href={item.letterboxdUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-24 sm:w-28 xl:w-32 shrink-0 focus-ring rounded-xl"
      >
        <Poster src={item.posterUrl} title={item.title} rounded="lg" />
      </a>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="min-w-0">
          <a
            href={item.letterboxdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display text-lg xl:text-xl leading-tight hover:text-accent transition-colors line-clamp-2"
          >
            {item.title}
            {item.year && (
              <span className="text-ink-400 font-sans font-normal text-sm xl:text-base ml-1.5">
                {item.year}
              </span>
            )}
          </a>
          {item.directors.length > 0 && (
            <div className="text-[12px] xl:text-[13px] text-ink-400 mt-0.5 line-clamp-1">
              dir. {item.directors.slice(0, 2).join(', ')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {typeof item.lbRating === 'number' && (
            <RatingPill
              rating={item.lbRating}
              count={item.lbRatingCount}
            />
          )}
          {typeof item.runtime === 'number' && (
            <MetaPill>{item.runtime} min</MetaPill>
          )}
          {item.genres.map((g) => (
            <MetaPill key={g} muted>
              {g}
            </MetaPill>
          ))}
          <SourceBadge source={item.source} userA={userA} userB={userB} />
        </div>

        <div className="mt-auto pt-2 flex flex-wrap gap-2 items-center">
          <a
            href={jwUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] xl:text-[13px] font-medium text-accent-soft hover:text-accent transition-colors inline-flex items-center gap-1 focus-ring rounded"
          >
            Search JustWatch
            <ArrowIcon />
          </a>
          <Pill tone="muted">Region {country.toUpperCase()}</Pill>
        </div>
      </div>
    </SurfaceCard>
  );
});
