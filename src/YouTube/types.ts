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
};
