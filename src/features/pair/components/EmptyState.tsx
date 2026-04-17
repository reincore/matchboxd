import { Button } from '../../../components/Button';
import { StatusPanel } from '../../../components/ui/StatusPanel';

export function EmptyState({
  hasAny,
  onClear,
}: {
  hasAny: boolean;
  onClear: () => void;
}) {
  return (
    <StatusPanel
      align="center"
      className="mt-8"
      title={hasAny ? 'Nothing matches those filters.' : 'No overlap yet.'}
      description={
        hasAny
          ? 'Loosen the filters to see more of your shared watchlist.'
          : "You don't currently have any films on both watchlists that you haven't already watched."
      }
      actions={
        hasAny ? (
          <Button variant="secondary" size="md" className="mx-auto" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}
