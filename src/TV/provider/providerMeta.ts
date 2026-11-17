// Provider Based TV detail: the same link list and PlayerMeta the phone
// DetailScreen builds (DetailScreen.tsx: filteredLinkList + buildMetaRef), so
// the player's quality / episode / next-episode panels behave the same.
// Pure (unit-tested).
import { episodeLabel, toPlayerEpisodes } from "@/lib/episodes";
import type { PlayerMeta } from "@/store/usePlayerStore";

export type TvLinkItem = {
  title?: string;
  quality?: string;
  episodesLink?: string;
  directLinks?: { link: string; title?: string; type?: string }[];
};

/** Which list entry and row were played (phone DetailScreen's PlayCtx). */
export type TvPlayCtx = {
  qualityIndex: number;
  itemIndex: number;
  items: { link: string; title?: string; type?: string }[];
};

export const isSeriesInfo = (info: any, post: any) =>
  (info?.type || post?.type) === "series";

/** The link list, or a single "Default" entry playing the post itself. */
export function linkListOf(info: any, post: { link: string; title?: string; type?: string }): TvLinkItem[] {
  const list = Array.isArray(info?.linkList) ? info.linkList : [];
  if (list.length > 0) return list;
  return [
    {
      title: "Default",
      directLinks: [{ link: post.link, title: info?.title || "Play", type: info?.type || "movie" }],
    },
  ];
}

export const entryLabel = (entry: TvLinkItem, index: number) =>
  entry.title || entry.quality || `Option ${index + 1}`;

export function buildProviderPlayerMeta({
  info,
  post,
  providerId,
  link,
  type,
  ctx,
}: {
  info: any;
  post: { link: string; title?: string; image?: string; type?: string };
  providerId: string;
  link: string;
  type: string;
  ctx?: TvPlayCtx | null;
}): NonNullable<PlayerMeta> {
  const isSeries = isSeriesInfo(info, post);
  const items = toPlayerEpisodes(ctx?.items);
  const current = items.find((item) => item.link === link);
  const itemIndex = ctx ? Math.max(0, ctx.itemIndex) : 0;
  return {
    title: info?.title || post.title || "",
    link,
    providerId,
    type,
    image: info?.poster || info?.image || post.image,
    isSeries,
    qualities: linkListOf(info, post).map((entry) => ({
      label: entry.title || entry.quality || "Quality",
      episodesLink: entry.episodesLink,
      directLinks: toPlayerEpisodes(entry.directLinks),
    })),
    qualityIndex: ctx?.qualityIndex ?? 0,
    episodes: items,
    episodeNumber: isSeries ? (current?.number ?? null) : null,
    linkIndex: isSeries ? undefined : itemIndex,
    // Movies show just the title; series show "Episode N".
    episode: isSeries ? episodeLabel(current, itemIndex) : undefined,
  };
}
