import { useQuery, useQueryClient } from "@tanstack/react-query";
import { providerApi } from "../lib/providerApi";
import { fillMissingPosters } from "../lib/tmdbPosters";

export const useSearch = (searchQuery: string, providerIds?: string[]) => {
  const queryClient = useQueryClient();
  const queryKey = ["search", searchQuery, providerIds];
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const posts = await providerApi.search(searchQuery, providerIds, signal);
      // Never hold search results on poster lookups.
      return fillMissingPosters(posts, signal, {
        onUpdate: (next) => queryClient.setQueryData(queryKey, next),
      });
    },
    // Only fetch when searchQuery is explicitly set and has length > 2
    enabled: searchQuery.trim().length > 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
