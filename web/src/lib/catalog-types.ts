export type Provider = { id: string; name: string; version?: string; description?: string; type?: string; icon?: string };
export type Category = { title: string; filter: string };
export type Post = { title: string; ref: string; image?: string; type?: string; tag?: string };
export type Episode = { title: string; ref: string; type?: string; description?: string; image?: string };
export type LinkGroup = { title: string; quality?: string; episodesRef?: string; directLinks: Episode[] };
export type ProviderDetail = Post & { synopsis?: string; poster?: string; rating?: string; tags: string[]; cast: string[]; groups: LinkGroup[] };
export type SubtitleTrack = { url: string; language: string; label: string };
export type Source = { url: string; hls: boolean; subtitles: SubtitleTrack[]; server: string; quality?: string; type?: string; label?: string; languages: string[] };
export type MediaType = "movie" | "tv";
export type Title = {
  id: number; mediaType: MediaType; title: string; originalTitle: string; year: string;
  image?: string; backdrop?: string; synopsis?: string; rating?: number;
};
export type TitleDetail = Title & {
  genres: string[]; cast: { name: string; character: string; image?: string }[];
  seasons: { number: number; name: string }[]; similar: Title[]; trailer?: string;
  runtime?: number; certification?: string; tagline?: string;
};
export type TitleEpisode = { number: number; name: string; overview: string; image?: string };
