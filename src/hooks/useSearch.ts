import { useQuery } from "@tanstack/react-query";
import { providerApi } from "../lib/providerApi";

export const useSearch = (searchQuery: string, providerIds?: string[]) => {
  return useQuery({
    queryKey: ["search", searchQuery, providerIds],
    queryFn: () => providerApi.search(searchQuery, providerIds),
    // Only fetch when searchQuery is explicitly set and has length > 2
    enabled: searchQuery.trim().length > 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
