// Provider post helpers shared by the TV Provider Based screens (no
// react-native imports; unit-tested). Same rules as the phone CategoryScreen.

export type ProviderPost = {
  title: string;
  link: string;
  image?: string;
  type?: string;
  providerId?: string;
};

/** Posts from a getPosts payload: an array, or {posts}, or {data}. */
export const extractPosts = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.posts)) return payload.posts;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const postKey = (item: any): string => item?.link || item?.title || "";

/**
 * Appends a page: drops empty and duplicate posts (by link, else title) and
 * tags each with the provider. `added` = how many new posts came in.
 */
export function mergePostsPage(
  previous: ProviderPost[],
  payload: any,
  providerId: string,
): { items: ProviderPost[]; added: number; incoming: number } {
  const incoming = extractPosts(payload).filter((item) => item && postKey(item));
  const seen = new Set(previous.map(postKey));
  const items = [...previous];
  for (const item of incoming) {
    const key = postKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ...item, providerId: item.providerId || providerId });
  }
  return { items, added: items.length - previous.length, incoming: incoming.length };
}

/** Catalogs that can actually load posts (same filter as the phone Home). */
export const validCatalogs = (catalogs: any): any[] =>
  (Array.isArray(catalogs) ? catalogs : []).filter((c) => c && (c.filter || c.id));

/** How many home rows may load at once: the first 3, then 2 past the focus. */
export const rowsToLoad = (focusedRow: number) => Math.max(3, focusedRow + 3);
