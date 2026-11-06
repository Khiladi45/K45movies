export type YtVideo = {
  id: string;
  title: string;
  link: string;
  image: string;
  channelName: string;
  channelAvatar?: string;
  views: string;
  publishedTime: string;
  duration: string;
  /** 16/9 for normal videos, 9/16 for Shorts. */
  aspectRatio: number;
  isShort: boolean;
  isLive: boolean;
};

export type YtWatch = {
  video: YtVideo;
  description: string;
  likes: string;
  related: YtVideo[];
};

export type YtHomeTab = {
  key: string;
  label: string;
  /** Query sent to the YouTube provider's getPosts(). */
  filter: string;
  /** Query used for this tab's Shorts shelf. */
  shortsFilter: string;
  /** When set, the tab mixes these topics into one endless feed. */
  topics?: string[];
};

export type YtComment = {
  id: string;
  author: string;
  authorAvatar?: string;
  text: string;
  publishedTime: string;
  likes: string;
  replyCount: string;
  /** Token that loads this comment's replies. */
  replyToken?: string;
};

export type YtCommentsPage = {
  comments: YtComment[];
  count: string;
  /** Token for the next page; undefined when there are no more comments. */
  continuation?: string;
};

/** One rendition offered in the gear menu or the download sheet. */
export type YtQuality = {
  /** Vertical resolution, e.g. 1080. 0 means "Auto". */
  height: number;
  label: string;
  /** True when this rendition carries audio too (safe to download). */
  muxed: boolean;
};

/** One row of the download sheet. */
export type YtDownloadOption = {
  height: number;
  /** "2160p · 4K" */
  label: string;
  /** "AV1 · 1.2 GB" */
  detail: string;
  /** Single file (audio + video), or the video-only half of a merged pair. */
  video: any;
  /** Audio-only half; present when the two files are joined after download. */
  audio?: any;
};
