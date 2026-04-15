import { memo } from 'react';
import { Poster } from '../../../components/Poster';
import type { PairWatchlistItem, ItemSource } from '../../../services/pairWatchlists';
import { buildJustWatchSearchUrl } from '../../../services/countryDetection';
import { cn } from '../../../utils/cn';
import { formatCount } from '../filters';
import { CountryPicker } from './CountryPicker';

function SourceBadge({ source, userA, userB }: { source: ItemSource; userA: string; userB: string }) {
  if (source === 'both') return null;
  const label = source === 'userA' ? `@${userA}` : `@${userB}`;
  const tone =
    source === 'userA'
      ? 'border-accent/30 bg-accent/10 text-accent-soft'
      : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
  return (
    <span className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 xl:px-2.5 xl:py-1 text-[10px] xl:text-[11px] font-medium',
      tone,
    )}>
      {label} only
    </span>
  );
}

function RatingPill({ rating, count }: { rating: number; count?: number }) {
  const stars = rating.toFixed(2);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-md bg-accent/10 border border-accent/30 text-[11px] xl:text-[12px] font-medium text-accent-soft">
      <span aria-hidden>★</span>
      {stars}
      {count && count > 0 && (
        <span className="text-ink-400 font-normal ml-0.5">
          · {formatCount(count)}
        </span>
      )}
    </span>
  );
}

function MetaPill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-md border text-[11px] xl:text-[12px]',
        muted
          ? 'border-ink-700 bg-ink-900/40 text-ink-400'
          : 'border-ink-700 bg-ink-900/60 text-ink-200',
      )}
    >
      {children}
    </span>
  );
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
  jwCountry: string;
  onCountryChange: (code: string | null) => void;
}

export const FilmRow = memo(function FilmRow({
  item, userA, userB, jwCountry, onCountryChange,
}: FilmRowProps) {
  const jwUrl = buildJustWatchSearchUrl(item.title, item.year);

  return (
    <div className="surface-card flex gap-3 xl:gap-4 p-3 xl:p-4">
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
          <CountryPicker country={jwCountry} onChange={onCountryChange} />
        </div>
      </div>
    </div>
  );
});
