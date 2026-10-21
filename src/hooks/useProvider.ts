import { useQuery } from "@tanstack/react-query";
import { providerApi } from "../lib/providerApi";

export const useCatalog = (providerId: string) => {
  return useQuery({
    queryKey: ["catalog", providerId],
    queryFn: ({ signal }) => providerApi.getCatalog(providerId, signal),
    enabled: !!providerId,
  });
};

export const usePosts = (providerId: string, filter: string) => {
  return useQuery({
    queryKey: ["posts", providerId, filter],
    queryFn: ({ signal }) => providerApi.getPosts(providerId, filter, 1, signal),
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
