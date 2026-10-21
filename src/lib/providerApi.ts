import { useQuery } from "@tanstack/react-query";
import { SandboxManager } from "../services/SandboxManager";
import { ProviderManager } from "../services/ProviderManager";

export const useProviders = () => {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => ProviderManager.fetchAvailableProviders(),
  });
};

export const providerApi = {
  getCatalog: (providerId: string, signal?: AbortSignal) =>
    SandboxManager.execute(providerId, "catalog", "catalog", {}, signal),

  getPosts: (
    providerId: string,
    filter: string,
    page: number = 1,
    signal?: AbortSignal,
  ) =>
    SandboxManager.execute(
      providerId,
      "posts",
      "getPosts",
      {
        filter,
        page,
        providerValue: providerId,
      },
      signal,
    ),

  getMeta: (providerId: string, link: string, signal?: AbortSignal) =>
    SandboxManager.execute(
      providerId,
      "meta",
      "getMeta",
      {
        link,
        provider: providerId,
      },
      signal,
    ),

  getEpisodes: (providerId: string, url: string, signal?: AbortSignal) =>
    SandboxManager.execute(
      providerId,
      "episodes",
      "getEpisodes",
      {
        url,
        provider: providerId,
      },
      signal,
    ),

  getStream: (
    providerId: string,
    link: string,
    type: string = "movie",
    signal?: AbortSignal,
  ) =>
    SandboxManager.execute(
      providerId,
      "stream",
      "getStream",
      {
        link,
        type,
        provider: providerId,
      },
      signal,
    ),

  // Searches every given provider in parallel and merges the results,
  // tagging each item with the provider it came from.
  search: async (
    query: string,
    providerIds?: string[],
    signal?: AbortSignal,
  ) => {
    const ids = providerIds?.filter(Boolean) ?? [];
    if (ids.length === 0) return [];

    const settled = await Promise.allSettled(
      ids.map((id) =>
        SandboxManager.execute(
          id,
          "posts",
          "getSearchPosts",
          {
            searchQuery: query,
            page: 1,
            providerValue: id,
          },
          signal,
        ),
      ),
    );

    return settled.flatMap((result, index) => {
      if (result.status !== "fulfilled" || !Array.isArray(result.value)) {
        return [];
      }
      const providerId = ids[index];
      return result.value.map((item: any) => ({
        ...item,
        providerId: item.providerId || providerId,
      }));
    });
  },
};
