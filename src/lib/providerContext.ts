import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync } from "expo-crypto";

import { installRuntimeGlobals } from "../providers/runtimeGlobals";
import { solveWaf } from "../services/wafSolver";

// Provider bundles are plain browser CJS and expect Buffer/atob/TextEncoder to
// already exist. Installing here means requiring a bundle is always safe.
installRuntimeGlobals();

// Matches the User-Agent the WebView sandbox sends, so providers that cache
// WAF cookies keyed on UA see a consistent client across both engines.
export const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
};

const KV_PREFIX = "k45:";

export const kvStore = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await AsyncStorage.getItem(KV_PREFIX + key);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(KV_PREFIX + key, JSON.stringify(value));
  },
  async delete(key: string): Promise<boolean> {
    await AsyncStorage.removeItem(KV_PREFIX + key);
    return true;
  },
  async keys(): Promise<string[]> {
    const all = await AsyncStorage.getAllKeys();
    return all
      .filter((key) => key.startsWith(KV_PREFIX))
      .map((key) => key.slice(KV_PREFIX.length));
  },
  async clear(): Promise<void> {
    const scoped = (await kvStore.keys()).map((key) => KV_PREFIX + key);
    if (scoped.length > 0) await AsyncStorage.multiRemove(scoped);
  },
};

// Vega declares `Aes: null`, which makes primewire's signed search URL throw;
// the real digest is what actually unlocks it.
const Aes = {
  sha1: (value: string) =>
    digestStringAsync(CryptoDigestAlgorithm.SHA1, String(value), {
      encoding: CryptoEncoding.HEX,
    }),
};

export type ProviderRuntimeContext = {
  axios: typeof axios;
  cheerio: typeof cheerio;
  commonHeaders: Record<string, string>;
  kvStore: typeof kvStore;
  openWebView: typeof solveWaf;
  Aes: typeof Aes;
};

export const providerContext: ProviderRuntimeContext = {
  axios,
  cheerio,
  commonHeaders: COMMON_HEADERS,
  kvStore,
  openWebView: solveWaf,
  Aes,
};
