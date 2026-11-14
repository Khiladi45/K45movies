import { useQuery, useQueryClient } from "@tanstack/react-query";
import { providerApi } from "../lib/providerApi";
import { fillMissingPosters } from "../lib/tmdbPosters";

export const useCatalog = (providerId: string) => {
  return useQuery({
    queryKey: ["catalog", providerId],
    queryFn: ({ signal }) => providerApi.getCatalog(providerId, signal),
    enabled: !!providerId,
  });
};

export const usePosts = (providerId: string, filter: string) => {
  const queryClient = useQueryClient();
  const queryKey = ["posts", providerId, filter];
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const posts = await providerApi.getPosts(providerId, filter, 1, signal);
      // Render rows immediately; poster backfill streams in when it resolves.
      return fillMissingPosters(posts, signal, {
        onUpdate: (next) => queryClient.setQueryData(queryKey, next),
      });
    },
    enabled: !!providerId && !!filter,
  });
};

export const useMeta = (providerId: string, link: string) => {
  return useQuery({
    queryKey: ["meta", providerId, link],
    queryFn: ({ signal }) => providerApi.getMeta(providerId, link, signal),
    enabled: !!providerId && !!link,
    retry: 1,
  });
};

export const useEpisodes = (providerId: string, url: string) => {
  return useQuery({
    queryKey: ["episodes", providerId, url],
    queryFn: ({ signal }) => providerApi.getEpisodes(providerId, url, signal),
    enabled: !!providerId && !!url,
    retry: 1,
  });
};

export const useStream = (providerId: string, link: string, type: string) => {
  return useQuery({
    queryKey: ["stream", providerId, link, type],
    // Always refetch when the user presses play: provider links are usually
    // signed and expire, so a cached URL can be dead within minutes.
    queryFn: ({ signal }) =>
      providerApi.getStream(providerId, link, type, signal),
    enabled: false,
    retry: 1,
    staleTime: 0,
    gcTime: 30_000,
  });
};
