import { Button } from '../../../components/Button';

export function EmptyState({
  hasAny,
  onClear,
}: {
  hasAny: boolean;
  onClear: () => void;
}) {
  return (
    <div className="surface-card p-8 xl:p-10 text-center mt-8">
      <div className="font-display text-xl xl:text-2xl mb-2">
        {hasAny ? 'Nothing matches those filters.' : 'No overlap yet.'}
      </div>
      <div className="text-ink-400 text-sm xl:text-base max-w-md xl:max-w-lg mx-auto">
        {hasAny
          ? 'Loosen the filters to see more of your shared watchlist.'
          : "You don't currently have any films on both watchlists that you haven't already watched."}
      </div>
      {hasAny && (
        <Button
          variant="secondary"
          size="md"
          className="mt-5"
          onClick={onClear}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
