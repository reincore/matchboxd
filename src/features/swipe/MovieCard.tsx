import { motion, type PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { Badge } from '../../components/Badge';
import { Poster } from '../../components/Poster';
import type { MovieCandidate, SwipeState } from '../../types';
import { confidenceLabel } from '../../utils/confidence';

interface MovieCardProps {
  candidate: MovieCandidate;
  onDecide: (state: SwipeState) => void;
  topOfStack: boolean;
}

const SWIPE_THRESHOLD = 110;

export function MovieCard({ candidate, onDecide, topOfStack }: MovieCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-14, 0, 14]);
  const yesOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -20], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onDecide('yes');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onDecide('no');
    }
  };

  return (
    <motion.div
      drag={topOfStack ? 'x' : false}
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={onDragEnd}
      style={{ x, rotate }}
      className="absolute inset-0 touch-none select-none"
      whileTap={{ cursor: 'grabbing' }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-card bg-ink-900 border border-ink-700/70">
        <Poster
          src={candidate.posterUrl}
          title={candidate.title}
          rounded="2xl"
          className="absolute inset-0 rounded-3xl h-full"
        />
        {/* Gradient for text legibility */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 p-4 flex items-start justify-between pointer-events-none">
          <Badge tone="accent">{categoryLabel(candidate.recommendationCategory)}</Badge>
          <Badge tone="neutral">{confidenceLabel(candidate.confidence)}</Badge>
        </div>

        {/* Swipe decision overlays */}
        <motion.div
          style={{ opacity: yesOpacity }}
          className="absolute top-6 left-6 rotate-[-12deg] border-4 border-emerald-400 text-emerald-300 text-2xl font-black tracking-widest px-3 py-1 rounded-lg pointer-events-none"
        >
          YES
        </motion.div>
        <motion.div
          style={{ opacity: noOpacity }}
          className="absolute top-6 right-6 rotate-[12deg] border-4 border-red-400 text-red-300 text-2xl font-black tracking-widest px-3 py-1 rounded-lg pointer-events-none"
        >
          NOPE
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-ink-100">
          <div className="flex items-baseline gap-2 mb-1.5">
            <h2 className="font-display text-2xl sm:text-3xl leading-tight">
              {candidate.title}
            </h2>
            {candidate.year && (
              <span className="text-ink-300 text-base">({candidate.year})</span>
            )}
          </div>
          <div className="text-xs text-ink-300 mb-2.5 space-x-2">
            {candidate.directors.length > 0 && (
              <span>{candidate.directors.slice(0, 2).join(', ')}</span>
            )}
            {candidate.runtime && (
              <>
                <span className="text-ink-600">·</span>
                <span>{candidate.runtime}m</span>
              </>
            )}
            {candidate.genres.length > 0 && (
              <>
                <span className="text-ink-600">·</span>
                <span>{candidate.genres.slice(0, 2).join(', ')}</span>
              </>
            )}
          </div>
          {candidate.synopsis && (
            <p className="text-sm text-ink-200 leading-snug mb-3 line-clamp-3">
              {candidate.synopsis}
            </p>
          )}
          {candidate.explanationReasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {candidate.explanationReasons.slice(0, 3).map((r, i) => (
                <Badge key={i} tone="accent">{r}</Badge>
              ))}
            </div>
          )}
          {candidate.providersTR && candidate.providersTR.length > 0 && (
            <div className="text-[11px] text-ink-400">
              <span className="text-ink-500">TR: </span>
              {candidate.providersTR
                .slice(0, 4)
                .map((p) => p.providerName)
                .join(' · ')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function categoryLabel(c: MovieCandidate['recommendationCategory']): string {
  switch (c) {
    case 'watchlist-overlap':
      return 'watchlist overlap';
    case 'rewatch':
      return 'shared rewatch';
    case 'taste-match':
      return 'taste match';
    case 'stretch-pick':
      return 'stretch pick';
  }
}
