export type ProviderStage = "request" | "registry" | "rate-limit" | "bundle" | "runtime" | "upstream" | "normalize" | "verification" | "probe";
export type ProviderIssue = { provider?: string; operation: string; stage: ProviderStage; upstreamStatus?: number; message: string };
export type ProviderHealth = { state: "healthy" | "degraded" | "needs verification"; checkedAt: number; issue?: ProviderIssue };
export type Provider = { id: string; name: string; version?: string; description?: string; type?: string; icon?: string; bundleSource?: "vendored" | "api"; searchUnavailable?: string };
export type Category = { title: string; filter: string };
export type Post = { title: string; ref: string; image?: string; type?: string; tag?: string; videoId?: string };
export type Episode = { title: string; ref: string; type?: string; description?: string; image?: string };
export type LinkGroup = { title: string; quality?: string; episodesRef?: string; directLinks: Episode[] };
export type ProviderDetail = Post & { synopsis?: string; poster?: string; rating?: string; tags: string[]; cast: string[]; groups: LinkGroup[] };
export type SubtitleTrack = { url: string; language: string; label: string };
export type QualityPreference = "auto" | "highest" | "lowest";
export type StreamFormat = "mp4" | "hls" | "dash" | "mkv" | "webm" | "avi" | "other";
export type StreamProbe = { status: "ok" | "failed" | "unknown"; httpStatus?: number; reason?: string; contentType?: string; format?: StreamFormat;
  codecs?: string[]; videoCodec?: "hevc" | "h264"; audioCodec?: "ac3" | "eac3" };
export type Source = { url: string; hls: boolean; subtitles: SubtitleTrack[]; server: string; quality?: string; type?: string; label?: string; languages: string[]; serverKey?: string; format?: StreamFormat; probe?: StreamProbe; compatibilityUrl?: string };
export type SourceAttempt = { server: string; quality?: string; probe: StreamProbe };
export type SourceReport = { sources: Source[]; attempts: SourceAttempt[]; issue?: ProviderIssue };
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
