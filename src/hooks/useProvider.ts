import { useQuery } from "@tanstack/react-query";
import { providerApi } from "../lib/providerApi";

export const useCatalog = (providerId: string) => {
  return useQuery({
    queryKey: ["catalog", providerId],
    queryFn: () => providerApi.getCatalog(providerId),
    enabled: !!providerId,
  });
};

export const usePosts = (providerId: string, filter: string) => {
  return useQuery({
    queryKey: ["posts", providerId, filter],
    queryFn: () => providerApi.getPosts(providerId, filter),
    enabled: !!providerId && !!filter,
  });
};

export const useMeta = (providerId: string, link: string) => {
  return useQuery({
    queryKey: ["meta", providerId, link],
    queryFn: () => providerApi.getMeta(providerId, link),
    enabled: !!providerId && !!link,
  });
};

export const useEpisodes = (providerId: string, url: string) => {
  return useQuery({
    queryKey: ["episodes", providerId, url],
    queryFn: () => providerApi.getEpisodes(providerId, url),
    enabled: !!providerId && !!url,
  });
};

export const useStream = (providerId: string, link: string, type: string) => {
  return useQuery({
    queryKey: ["stream", providerId, link, type],
    queryFn: () => providerApi.getStream(providerId, link, type),
    enabled: false, // Triggered manually on Play button click
  });
};
