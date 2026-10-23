import { useQuery } from "@tanstack/react-query";
import { LocalProviderRunner } from "../services/LocalProviderRunner";
import { SandboxManager } from "../services/SandboxManager";
import { ProviderManager } from "../services/ProviderManager";

// Statically bundled providers run in the app's JS thread. Anything not in the
// registry — a provider installed at runtime from GitHub — still has the
// WebView sandbox to fall back on.
export const executeProvider = (
  providerId: string,
  module: string,
  method: string,
  args: Record<string, any>,
  signal?: AbortSignal,
) =>
  LocalProviderRunner.has(providerId)
    ? LocalProviderRunner.execute(providerId, module, method, args, signal)
    : SandboxManager.execute(providerId, module, method, args, signal);

export const useProviders = () => {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => ProviderManager.fetchAvailableProviders(),
  });
};

export const providerApi = {
  getCatalog: (providerId: string, signal?: AbortSignal) =>
    executeProvider(providerId, "catalog", "catalog", {}, signal),

  getPosts: (
    providerId: string,
    filter: string,
    page: number = 1,
    signal?: AbortSignal,
  ) =>
    executeProvider(
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
    executeProvider(
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
    executeProvider(
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
    executeProvider(
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
        executeProvider(
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
