import { Directory, File, Paths } from "expo-file-system";
import { useProviderStore } from "../store/useProviderStore";

// Replace with your provider repo (must expose /manifest.json and /bundled/{id}.js).
const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/Khiladi45/K45movies-api/main";

const MANIFEST_TTL_MS = 5 * 60 * 1000;

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
  bundleUrl?: string;
};

class ProviderManagerClass {
  private manifestCache: { at: number; data: ProviderMetadata[] } | null = null;
  private pendingManifest: Promise<ProviderMetadata[]> | null = null;
  private pendingInstalls: Map<string, Promise<void>> = new Map();

  async fetchAvailableProviders(): Promise<any[]> {
    if (
      this.manifestCache &&
      Date.now() - this.manifestCache.at < MANIFEST_TTL_MS
    ) {
      return this.manifestCache.data;
    }
    if (!this.pendingManifest) {
      this.pendingManifest = (async () => {
        const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch manifest: HTTP ${response.status}`);
        }
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.providers || [];
        // The UI reads value/display_name; your manifest uses id/name — normalize.
        const normalized: ProviderMetadata[] = list
          .filter((entry: any) => entry && (entry.id || entry.value))
          .map((entry: any) => ({
            ...entry,
            value: entry.value ?? entry.id,
            display_name: entry.display_name ?? entry.name ?? entry.id,
          }));
        this.manifestCache = { at: Date.now(), data: normalized };
        return normalized;
      })().finally(() => {
        this.pendingManifest = null;
      });
    }
    return this.pendingManifest;
  }

  getProviderDir(providerId: string): Directory {
    return new Directory(Paths.document, "providers", providerId);
  }

  getBundleFile(providerId: string): File {
    return new File(this.getProviderDir(providerId), "bundle.js");
  }

  isProviderInstalled(providerId: string): boolean {
    return this.getBundleFile(providerId).exists;
  }

  async installProvider(
    providerId: string,
    metadata: ProviderMetadata,
  ): Promise<any> {
    const providerDir = this.getProviderDir(providerId);
    providerDir.create({ intermediates: true, idempotent: true });

    const bundleFile = this.getBundleFile(providerId);
    const bundleUrl = metadata.bundleUrl
      ? metadata.bundleUrl.startsWith("http")
        ? metadata.bundleUrl
        : `${GITHUB_RAW_BASE}/${metadata.bundleUrl}`
      : `${GITHUB_RAW_BASE}/bundled/${providerId}.js`;
    await File.downloadFileAsync(bundleUrl, bundleFile, {
      idempotent: true,
    });

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
  }

  // The store can claim a provider is installed while its bundle is missing
  // on disk (fresh install, cleared app files). This guarantees the bundle
  // exists before the sandbox tries to run it. Concurrent callers for the
  // same provider share a single download.
  async ensureProviderBundle(providerId: string): Promise<void> {
    if (this.isProviderInstalled(providerId)) return;

    if (!this.pendingInstalls.has(providerId)) {
      const task = (async () => {
        const providers = await this.fetchAvailableProviders();
        const metadata = providers.find((p: any) => p.value === providerId);
        if (!metadata) {
          throw new Error(
            `Provider "${providerId}" is no longer in the provider list.`,
          );
        }
        await this.installProvider(providerId, metadata);

        const { installedProviders, toggleInstall } =
          useProviderStore.getState();
        if (!installedProviders.includes(providerId)) {
          toggleInstall(providerId);
        }
      })().finally(() => {
        this.pendingInstalls.delete(providerId);
      });
      this.pendingInstalls.set(providerId, task);
    }
    return this.pendingInstalls.get(providerId)!;
  }

  // App-startup sync between the persisted store and the file system:
  // drop phantom "installed" entries, re-download the active provider's
  // bundle, and if the active provider is gone upstream, fall back to the
  // first provider that can still be installed.
  async reconcileProviderStore(): Promise<void> {
    const { installedProviders, activeProvider, toggleInstall } =
      useProviderStore.getState();

    installedProviders.forEach((id) => {
      if (!this.isProviderInstalled(id)) {
        toggleInstall(id);
      }
    });

    if (this.isProviderInstalled(activeProvider)) return;

    try {
      await this.ensureProviderBundle(activeProvider);
    } catch {
      try {
        const providers = await this.fetchAvailableProviders();
        const fallback = providers.find(
          (p: any) => p.value && p.value !== activeProvider,
        );
        if (fallback?.value) {
          await this.ensureProviderBundle(fallback.value);
          useProviderStore.getState().setActiveProvider(fallback.value);
        }
      } catch {
        // Offline — the execute path surfaces a proper error when queries fire.
      }
    }
  }

  async uninstallProviderFiles(providerId: string): Promise<void> {
    const providerDir = this.getProviderDir(providerId);
    if (providerDir.exists) {
      providerDir.delete();
    }
  }
}

export const ProviderManager = new ProviderManagerClass();
