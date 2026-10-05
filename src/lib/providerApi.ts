import { useQuery } from "@tanstack/react-query";
const BASE_URL = "http://192.168.1.4:3002";

const fetchBridge = async (
  endpoint: string,
  params?: Record<string, string>,
) => {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key]),
    );
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.statusText}`);
  }
  return response.json();
};

const PROVIDERS_ENDPOINT = `${BASE_URL}/api/providers`;
export const useProviders = () => {
  return useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const response = await fetch(PROVIDERS_ENDPOINT);
      if (!response.ok) {
        throw new Error("Failed to fetch providers from backend");
      }
      const data = await response.json();

      // If your backend returns an object like { providers: [...] }, adjust this to `data.providers`
      // Assuming it returns an array directly based on your manifest.json example:
      return Array.isArray(data) ? data : data.providers || [];
    },
  });
};

export const providerApi = {
  getCatalog: (providerId: string) =>
    fetchBridge("/api/catalog", { provider: providerId }),

  getPosts: (providerId: string, filter: string, page: number = 1) =>
    fetchBridge("/api/posts", {
      provider: providerId,
      filter,
      page: page.toString(),
    }),

  getMeta: (providerId: string, link: string) =>
    fetchBridge("/api/meta", { provider: providerId, link }),

  getEpisodes: (providerId: string, url: string) =>
    fetchBridge("/api/episodes", { provider: providerId, url }),

  getStream: (providerId: string, link: string, type: string = "movie") =>
    fetchBridge("/api/stream", { provider: providerId, link, type }),

  search: (query: string, providerIds?: string[]) => {
    const params: Record<string, string> = { query };
    if (providerIds && providerIds.length > 0) {
      params.providers = providerIds.join(","); // 👈 Send as comma-separated string
    }
    return fetchBridge("/api/search", params);
  },
};
