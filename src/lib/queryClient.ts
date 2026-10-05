import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      retry: 2, // Retry failed requests twice
      refetchOnWindowFocus: false, // Don't refetch when user switches apps
    },
  },
});
