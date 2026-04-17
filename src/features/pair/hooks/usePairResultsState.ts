import { useCallback, useMemo, useState } from 'react';
import {
  getCountryOverride,
  getDetectedCountry,
  setCountryOverride,
} from '../../../services/countryDetection';
import {
  DEFAULT_PAIR_RESULTS_FILTERS,
  filterPairItems,
  sortPairItems,
  type MoodFilter,
  type PairResultsFilters,
  type SortOption,
  type SourceFilter,
} from '../filters';
import type { PairWatchlistItem } from '../../../services/pairWatchlists';

export function usePairResultsState(items: PairWatchlistItem[]) {
  const [filters, setFilters] = useState<PairResultsFilters>(DEFAULT_PAIR_RESULTS_FILTERS);
  const [country, setCountry] = useState(getDetectedCountry);
  const [hasCountryOverride, setHasCountryOverride] = useState(
    () => getCountryOverride() !== null,
  );

  const setMood = useCallback((mood: MoodFilter) => {
    setFilters((current) => ({ ...current, mood }));
  }, []);

  const setSourceFilter = useCallback((sourceFilter: SourceFilter) => {
    setFilters((current) => ({ ...current, sourceFilter }));
  }, []);

  const setUnderOneHundred = useCallback((underOneHundred: boolean) => {
    setFilters((current) => ({ ...current, underOneHundred }));
  }, []);

  const setHighRatedOnly = useCallback((highRatedOnly: boolean) => {
    setFilters((current) => ({ ...current, highRatedOnly }));
  }, []);

  const setSort = useCallback((sort: SortOption) => {
    setFilters((current) => ({ ...current, sort }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_PAIR_RESULTS_FILTERS);
  }, []);

  const updateCountry = useCallback((code: string | null) => {
    setCountryOverride(code);
    setCountry(getDetectedCountry());
    setHasCountryOverride(getCountryOverride() !== null);
  }, []);

  const filteredItems = useMemo(
    () => sortPairItems(filterPairItems(items, filters), filters.sort),
    [filters, items],
  );

  return {
    filters,
    filteredItems,
    country,
    hasCountryOverride,
    setMood,
    setSourceFilter,
    setUnderOneHundred,
    setHighRatedOnly,
    setSort,
    clearFilters,
    updateCountry,
  };
}
