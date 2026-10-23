import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "@/store/useThemeStore";
import { useProviderStore } from "@/store/useProviderStore";
import {
  useProviders,
  providerApi,
  executeProvider,
} from "@/lib/providerApi";
import { ProviderManager } from "@/services/ProviderManager";
import {
  groupStreams,
  normalizeStreams,
  probeStream,
  StreamProbe,
} from "@/lib/streams";
import { prepareSubtitles } from "@/services/subtitleService";

type StageStatus = "pending" | "running" | "ok" | "warn" | "fail" | "skipped";

type StageId =
  | "manifest"
  | "init"
  | "search"
  | "metadata"
  | "stream"
  | "subtitles";

type StageResult = {
  id: StageId;
  label: string;
  description: string;
  status: StageStatus;
  durationMs?: number;
  summary?: string;
  details?: string[];
  error?: string;
};

type StageOutcome = {
  status: Exclude<StageStatus, "pending" | "running">;
  summary: string;
  details?: string[];
};

type DiagnosticsContext = {
  catalog?: any[];
  post?: any;
  meta?: any;
  rawStreams?: any[];
  searchResults?: any[];
};

const STAGES: Omit<StageResult, "status">[] = [
  {
    id: "manifest",
    label: "Manifest",
    description: "Provider is listed and its bundle is available",
  },
  {
    id: "init",
    label: "Initialize & catalog",
    description: "Load the sandbox bundle and read the catalog",
  },
  {
    id: "search",
    label: "Search",
    description: "Run a real search request through the provider",
  },
  {
    id: "metadata",
    label: "Metadata",
    description: "Open a real title and read its details",
  },
  {
    id: "stream",
    label: "Streams",
    description: "Resolve links and verify that servers respond",
  },
  {
    id: "subtitles",
    label: "Subtitles",
    description: "Download and parse the exposed subtitle tracks",
  },
];

const emptyStages = (): StageResult[] =>
  STAGES.map((stage) => ({ ...stage, status: "pending" }));

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const describeError = (error: any): string => {
  const text =
    error?.message ||
    error?.error?.message ||
    (typeof error === "string" ? error : JSON.stringify(error));
  const clean = String(text || "Unknown error");
  return clean.length > 400 ? `${clean.slice(0, 400)}…` : clean;
};

const formatDuration = (ms?: number): string => {
  if (ms == null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
};

const probeLabel = (probe?: StreamProbe): string => {
  if (!probe) return "not probed";
  if (probe.status === "ok") {
    return probe.httpStatus ? `reachable · HTTP ${probe.httpStatus}` : "reachable";
  }
  if (probe.status === "failed") {
    return `unreachable${probe.httpStatus ? ` · HTTP ${probe.httpStatus}` : ""}${
      probe.reason ? ` · ${probe.reason}` : ""
    }`;
  }
  return `unverified${probe.reason ? ` · ${probe.reason}` : ""}`;
};

const statusIcon = (
  status: StageStatus,
): { name: any; color: string } => {
  if (status === "ok") return { name: "checkmark-circle", color: "#22c55e" };
  if (status === "warn") return { name: "alert-circle", color: "#f59e0b" };
  if (status === "fail") return { name: "close-circle", color: "#ef4444" };
  if (status === "skipped")
    return { name: "remove-circle-outline", color: "#6b7280" };
  return { name: "ellipse-outline", color: "#555" };
};

export default function ProviderDiagnosticsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { primaryColor } = useThemeStore();
  const installedProviders = useProviderStore((s) => s.installedProviders);
  const activeProvider = useProviderStore((s) => s.activeProvider);
  const { data: manifest } = useProviders();

  const providers = useMemo(
    () => Array.from(new Set(installedProviders || [])),
    [installedProviders],
  );

  const [providerId, setProviderId] = useState(activeProvider);
  const [query, setQuery] = useState("");
  const [stages, setStages] = useState<StageResult[]>(emptyStages);
  const [running, setRunning] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const contextRef = useRef<DiagnosticsContext>({});

  useEffect(() => {
    if (providers.length === 0) return;
    if (!providers.includes(providerId)) {
      setProviderId(
        providers.includes(activeProvider) ? activeProvider : providers[0],
      );
    }
  }, [providers, providerId, activeProvider]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  const providerName = useMemo(() => {
    const match = (manifest || []).find(
      (entry: any) => entry.value === providerId,
    );
    return match?.display_name || match?.name || providerId;
  }, [manifest, providerId]);

  const setStage = (index: number, patch: Partial<StageResult>) => {
    setStages((current) =>
      current.map((stage, position) =>
        position === index ? { ...stage, ...patch } : stage,
      ),
    );
  };

  const loadFirstPost = async (
    context: DiagnosticsContext,
    signal: AbortSignal,
  ): Promise<any> => {
    if (context.post?.link) return context.post;
    const catalog =
      context.catalog || (await providerApi.getCatalog(providerId, signal));
    context.catalog = Array.isArray(catalog) ? catalog : [];
    const section = context.catalog.find(
      (item: any) => item && (item.filter || item.id),
    );
    if (!section) throw new Error("No fetchable category in the catalog");
    const posts = await providerApi.getPosts(
      providerId,
      section.filter || section.id,
      1,
      signal,
    );
    const post = Array.isArray(posts)
      ? posts.find((item: any) => item?.link)
      : null;
    if (!post) throw new Error("The first catalog category returned no titles");
    context.post = post;
    return post;
  };

  const runStage = async (
    index: number,
    context: DiagnosticsContext,
    signal: AbortSignal,
  ): Promise<StageOutcome> => {
    const stage = STAGES[index];

    if (stage.id === "manifest") {
      const available = await ProviderManager.fetchAvailableProviders();
      const entry = available.find(
        (item: any) => (item.value || item.id) === providerId,
      );
      if (!entry) {
        throw new Error(`Provider "${providerId}" is missing from manifest.json`);
      }
      const bundle = ProviderManager.getBundleFile(providerId);
      const installed = bundle.exists;
      return {
        status: installed ? "ok" : "warn",
        summary: `${entry.display_name || entry.name || providerId} · v${
          entry.version || "unknown"
        } · ${installed ? `bundle ${formatBytes(bundle.size)}` : "bundle not downloaded"}`,
        details: [
          `Manifest lists ${available.length} providers`,
          `Bundle: ${entry.bundleUrl || "default bundled path"}`,
          ...(installed
            ? []
            : ["The init stage downloads the bundle before testing it."]),
        ],
      };
    }

    if (stage.id === "init") {
      await ProviderManager.ensureProviderBundle(providerId);
      const catalog = await providerApi.getCatalog(providerId, signal);
      if (!Array.isArray(catalog)) {
        throw new Error("Provider catalog is not an array");
      }
      if (catalog.length === 0) {
        throw new Error("Provider returned an empty catalog");
      }
      context.catalog = catalog;
      const fetchable = catalog.filter(
        (section: any) => section && (section.filter || section.id),
      );
      const titles = catalog
        .slice(0, 8)
        .map(
          (section: any) =>
            `${section.title || section.id || "Untitled"}${
              section.filter ? ` · ${section.filter}` : ""
            }`,
        );
      return {
        status: fetchable.length > 0 ? "ok" : "warn",
        summary: `${catalog.length} categories · ${fetchable.length} fetchable`,
        details: [
          ...titles,
          ...(fetchable.length === 0
            ? ["No category exposes a filter or id, so posts cannot load."]
            : []),
        ],
      };
    }

    if (stage.id === "search") {
      const term = query.trim();
      if (!term) {
        return {
          status: "skipped",
          summary: "No search term entered",
          details: [
            "Type a title above and rerun from this stage to exercise search.",
          ],
        };
      }
      const results = await executeProvider(
        providerId,
        "posts",
        "getSearchPosts",
        {
          searchQuery: term,
          page: 1,
          providerValue: providerId,
        },
        signal,
      );
      if (!Array.isArray(results)) {
        throw new Error("Search did not return a list of posts");
      }
      context.searchResults = results;
      const first = results.find((item: any) => item?.link);
      if (first) {
        context.post = context.post || first;
      }
      return {
        status: results.length > 0 ? "ok" : "warn",
        summary:
          results.length > 0
            ? `${results.length} results for "${term}"`
            : `No results for "${term}"`,
        details: results
          .slice(0, 6)
          .map(
            (item: any) =>
              `${item.title || "Untitled"}${
                item.year ? ` (${item.year})` : ""
              } · ${item.type || "unknown"}`,
          ),
      };
    }

    if (stage.id === "metadata") {
      const post = await loadFirstPost(context, signal);
      const meta = await providerApi.getMeta(providerId, post.link, signal);
      if (!meta || typeof meta !== "object") {
        throw new Error("Metadata response was empty");
      }
      context.meta = meta;
      const linkList = Array.isArray(meta.linkList) ? meta.linkList : [];
      return {
        status: meta.title ? "ok" : "warn",
        summary: `${meta.title || post.title || "Untitled"} · ${
          meta.type || post.type || "unknown"
        }`,
        details: [
          `Source: ${post.link ? "catalog/search link" : "unknown"}`,
          meta.year ? `Year: ${meta.year}` : null,
          linkList.length > 0
            ? `Playback groups: ${linkList.length}`
            : "No linkList; a direct link will be used",
          ...(Array.isArray(meta.genre)
            ? [`Genres: ${meta.genre.slice(0, 4).join(", ")}`]
            : []),
        ].filter(Boolean) as string[],
      };
    }

    if (stage.id === "stream") {
      const post = await loadFirstPost(context, signal);
      let meta = context.meta;
      if (!meta) {
        meta = await providerApi.getMeta(providerId, post.link, signal);
        context.meta = meta;
      }
      if (!meta || typeof meta !== "object") {
        throw new Error("Metadata is unavailable, so streams cannot resolve");
      }

      let link = post.link || meta.link || "";
      let type = meta.type || post.type || "movie";
      let episodeCount = 0;
      const linkList = Array.isArray(meta.linkList) ? meta.linkList : [];
      const firstGroup = linkList[0];
      if (firstGroup) {
        const direct = Array.isArray(firstGroup.directLinks)
          ? firstGroup.directLinks.find((item: any) => item?.link)
          : null;
        if (direct) {
          link = direct.link;
          type = direct.type || type;
        } else if (firstGroup.episodesLink) {
          const episodes = await providerApi.getEpisodes(
            providerId,
            firstGroup.episodesLink,
            signal,
          );
          if (!Array.isArray(episodes) || episodes.length === 0) {
            throw new Error("The episodes list came back empty");
          }
          episodeCount = episodes.length;
          link = episodes[0].link;
          type = "series";
        }
      }
      if (!link) throw new Error("No playable link in the metadata");

      const raw = await providerApi.getStream(providerId, link, type, signal);
      const rawStreams = Array.isArray(raw) ? raw : [raw];
      const streams = normalizeStreams(rawStreams);
      if (streams.length === 0) {
        throw new Error("Provider returned no usable stream URLs");
      }
      context.rawStreams = rawStreams;

      const groups = groupStreams(streams);
      const probes = await Promise.all(
        streams
          .slice(0, 3)
          .map((stream) =>
            probeStream(stream, {
              timeoutMs: 5000,
              signal,
              force: true,
            }),
          ),
      );
      const reachable = probes.filter(
        (probe) => probe.status === "ok",
      ).length;

      return {
        status: reachable > 0 ? "ok" : "warn",
        summary: `${streams.length} streams · ${groups.length} servers · ${reachable}/${probes.length} reachable`,
        details: [
          `${episodeCount > 0 ? `${episodeCount} episodes · ` : ""}${type}`,
          ...streams.slice(0, 6).map((stream, position) => {
            const probe = probes[position];
            return `${stream.server} · ${stream.qualityLabel} · ${stream.formatLabel}${
              probe ? ` · ${probeLabel(probe)}` : ""
            }`;
          }),
          ...(reachable === 0
            ? ["Streams resolved but none answered the reachability probe."]
            : []),
        ],
      };
    }

    if (stage.id === "subtitles") {
      const rawStreams = context.rawStreams || [];
      const withSubtitles = rawStreams.filter(
        (item: any) => item && (item.subtitles || item.subtitle || item.captions),
      );
      if (withSubtitles.length === 0) {
        return {
          status: "skipped",
          summary: "No external subtitles exposed",
          details: [
            "Embedded subtitle tracks can only be detected during playback.",
          ],
        };
      }
      const source = withSubtitles[0];
      const rawList = source.subtitles || source.subtitle || source.captions;
      const result = await prepareSubtitles(
        rawList,
        source.link,
        source.headers,
      );
      const cueCount = result.tracks.reduce(
        (total, track) => total + track.cues.length,
        0,
      );
      if (result.tracks.length === 0) {
        return {
          status: result.failed > 0 ? "fail" : "warn",
          summary: `0 tracks parsed${
            result.failed > 0 ? ` · ${result.failed} failed` : ""
          }`,
          details: [
            "The provider exposed subtitle entries but none could be parsed as VTT or SRT.",
          ],
        };
      }
      return {
        status: "ok",
        summary: `${result.tracks.length} tracks · ${cueCount} cues${
          result.failed > 0 ? ` · ${result.failed} failed` : ""
        }`,
        details: result.tracks
          .slice(0, 8)
          .map(
            (track) =>
              `${track.label} · ${track.languageCode} · ${track.cues.length} cues`,
          ),
      };
    }

    throw new Error("Unknown diagnostic stage");
  };

  const runFrom = async (startIndex: number) => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setRunning(true);

    if (startIndex === 0) contextRef.current = {};
    const context = contextRef.current;

    setStages((current) =>
      current.map((stage, index) =>
        index >= startIndex
          ? { ...stage, status: "pending", summary: undefined, details: undefined, error: undefined, durationMs: undefined }
          : stage,
      ),
    );

    for (let index = startIndex; index < STAGES.length; index++) {
      if (runId !== runIdRef.current || controller.signal.aborted) break;
      setStage(index, {
        status: "running",
        summary: undefined,
        details: undefined,
        error: undefined,
        durationMs: undefined,
      });
      const started = Date.now();
      try {
        const outcome = await runStage(index, context, controller.signal);
        if (runId !== runIdRef.current) return;
        setStage(index, {
          ...outcome,
          durationMs: Date.now() - started,
        });
      } catch (error: any) {
        if (runId !== runIdRef.current) return;
        setStage(index, {
          status: "fail",
          error: describeError(error),
          durationMs: Date.now() - started,
        });
      }
    }

    if (runId === runIdRef.current) {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const cancelRun = () => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setStages((current) =>
      current.map((stage) =>
        stage.status === "running"
          ? { ...stage, status: "skipped", summary: "Cancelled" }
          : stage,
      ),
    );
  };

  const handleProviderChange = (id: string) => {
    if (running) return;
    setProviderId(id);
    setStages(emptyStages());
    contextRef.current = {};
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Provider diagnostics</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <Text style={styles.intro}>
          Runs real requests through the installed provider sandbox: manifest,
          initialization, search, metadata, streams and subtitles. Stream URLs
          and request headers are never shown.
        </Text>

        <Text style={styles.sectionTitle}>PROVIDER</Text>
        {providers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="extension-puzzle-outline" size={22} color="#777" />
            <Text style={styles.emptyText}>
              No providers are installed. Add one from the Providers screen
              first.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.providerRow}>
              {providers.map((id) => {
                const selected = id === providerId;
                const match = (manifest || []).find(
                  (entry: any) => entry.value === id,
                );
                return (
                  <TouchableOpacity
                    key={id}
                    disabled={running}
                    onPress={() => handleProviderChange(id)}
                    style={[
                      styles.providerChip,
                      selected && {
                        borderColor: `${primaryColor}88`,
                        backgroundColor: `${primaryColor}1F`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={id === activeProvider ? "star" : "extension-puzzle"}
                      size={14}
                      color={selected ? primaryColor : "#8a8a8a"}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.providerChipText,
                        selected && { color: primaryColor },
                      ]}
                    >
                      {match?.display_name || match?.name || id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.queryBox}>
              <Ionicons name="search" size={17} color="#777" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                editable={!running}
                placeholder="Search term for the search test (optional)"
                placeholderTextColor="#666"
                style={styles.queryInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.runButton,
                { backgroundColor: running ? "#2a2a2a" : primaryColor },
              ]}
              onPress={running ? cancelRun : () => runFrom(0)}
              activeOpacity={0.85}
            >
              {running ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.runButtonText}>Cancel diagnostics</Text>
                </>
              ) : (
                <>
                  <Ionicons name="pulse" size={18} color="#0b0b0f" />
                  <Text style={[styles.runButtonText, { color: "#0b0b0f" }]}>
                    Run diagnostics
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              {providerName} · Results come from the provider's live endpoints.
              Retry on a stage reruns that stage and every stage after it.
            </Text>
          </>
        )}

        <Text style={styles.sectionTitle}>STAGES</Text>
        <View style={styles.stageList}>
          {stages.map((stage, index) => {
            const icon = statusIcon(stage.status);
            return (
              <View key={stage.id} style={styles.stageCard}>
                <View style={styles.stageHeader}>
                  <View style={styles.stageIcon}>
                    {stage.status === "running" ? (
                      <ActivityIndicator size="small" color={primaryColor} />
                    ) : (
                      <Ionicons
                        name={icon.name}
                        size={21}
                        color={icon.color}
                      />
                    )}
                  </View>
                  <View style={styles.stageTitleWrap}>
                    <Text style={styles.stageTitle}>{stage.label}</Text>
                    <Text style={styles.stageDescription}>
                      {stage.description}
                    </Text>
                  </View>
                  <Text style={styles.stageDuration}>
                    {formatDuration(stage.durationMs)}
                  </Text>
                  <TouchableOpacity
                    disabled={running || providers.length === 0}
                    onPress={() => runFrom(index)}
                    style={[
                      styles.retryButton,
                      (running || providers.length === 0) && {
                        opacity: 0.35,
                      },
                    ]}
                    accessibilityLabel={`Retry from ${stage.label}`}
                  >
                    <Ionicons name="refresh" size={16} color="#ccc" />
                  </TouchableOpacity>
                </View>

                {stage.summary ? (
                  <Text style={styles.stageSummary}>{stage.summary}</Text>
                ) : null}
                {stage.error ? (
                  <Text style={styles.stageError}>{stage.error}</Text>
                ) : null}
                {stage.details && stage.details.length > 0 ? (
                  <View style={styles.detailList}>
                    {stage.details.map((detail, detailIndex) => (
                      <Text
                        key={`${stage.id}-${detailIndex}`}
                        style={styles.detailText}
                      >
                        {detail}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { padding: 4, width: 34 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  content: { paddingHorizontal: 16, paddingTop: 6 },
  intro: { color: "#8a8a8a", fontSize: 12.5, lineHeight: 18 },
  sectionTitle: {
    color: "#8a8a8a",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },

  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#0e0e0e",
  },
  emptyText: { flex: 1, color: "#8a8a8a", fontSize: 12.5, lineHeight: 18 },

  providerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  providerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#151515",
    maxWidth: "100%",
  },
  providerChipText: {
    color: "#9a9a9a",
    fontSize: 12.5,
    fontWeight: "700",
    maxWidth: 180,
  },

  queryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262626",
    backgroundColor: "#0e0e0e",
  },
  queryInput: {
    flex: 1,
    color: "#fff",
    fontSize: 13.5,
    paddingVertical: 11,
  },

  runButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
  },
  runButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  hint: {
    color: "#777",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 10,
  },

  stageList: { gap: 10 },
  stageCard: {
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1d1d1d",
    padding: 13,
  },
  stageHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  stageIcon: { width: 26, alignItems: "center" },
  stageTitleWrap: { flex: 1 },
  stageTitle: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  stageDescription: { color: "#777", fontSize: 11, marginTop: 2 },
  stageDuration: { color: "#777", fontSize: 11, fontVariant: ["tabular-nums"] },
  retryButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#1b1b1b",
    alignItems: "center",
    justifyContent: "center",
  },
  stageSummary: {
    color: "#d4d4d4",
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 10,
  },
  stageError: {
    color: "#f87171",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  detailList: {
    marginTop: 8,
    gap: 3,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  detailText: { color: "#7d7d7d", fontSize: 11.5, lineHeight: 16 },
});
