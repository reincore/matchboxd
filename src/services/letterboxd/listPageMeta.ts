export interface ListPageMeta {
  filmId?: string;
  title?: string;
  year?: number;
  posterUrl?: string;
}

const LIST_PAGE_META = new Map<string, ListPageMeta>();

export function getListPageMeta(slug: string): ListPageMeta | undefined {
  return LIST_PAGE_META.get(slug);
}

export function storeListPageMeta(slug: string, meta: ListPageMeta): void {
  LIST_PAGE_META.set(slug, meta);
}

export function clearListPageMeta(): void {
  LIST_PAGE_META.clear();
}
