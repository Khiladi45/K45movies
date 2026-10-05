import { Directory, File, Paths } from "expo-file-system";

// Replace with your provider repo (must expose /manifest.json and /bundled/{id}.js).
const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/{YOUR_USERNAME}/{YOUR_REPO}/main";

export type ProviderMetadata = {
  id: string;
  value?: string;
  name?: string;
  display_name?: string;
  version?: string;
  author?: string;
  description?: string;
  icon?: string;
  type?: string;
};

export const ProviderManager = {
  async fetchAvailableProviders(): Promise<any[]> {
    const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : data.providers || [];
  },

  getProviderDir(providerId: string): Directory {
    return new Directory(Paths.document, "providers", providerId);
  },

  getBundleFile(providerId: string): File {
    return new File(this.getProviderDir(providerId), "bundle.js");
  },

  isProviderInstalled(providerId: string): boolean {
    return this.getBundleFile(providerId).exists;
  },

  async installProvider(
    providerId: string,
    metadata: ProviderMetadata,
  ): Promise<any> {
    const providerDir = this.getProviderDir(providerId);
    providerDir.create({ intermediates: true, idempotent: true });

    const bundleFile = this.getBundleFile(providerId);
    await File.downloadFileAsync(
      `${GITHUB_RAW_BASE}/bundled/${providerId}.js`,
      bundleFile,
      { idempotent: true },
    );

    if (!bundleFile.exists) {
      throw new Error(`Failed to download provider bundle: ${providerId}`);
    }

    return {
      id: providerId,
      name: metadata.name || metadata.display_name || providerId,
      version: metadata.version || "1.0.0",
      author: metadata.author || "Unknown",
      description: metadata.description || "",
      icon: metadata.icon,
      installedAt: Date.now(),
      isActive: false,
    };
  },

  async uninstallProviderFiles(providerId: string): Promise<void> {
    const providerDir = this.getProviderDir(providerId);
    if (providerDir.exists) {
      providerDir.delete();
    }
  },
};
