import { useEffect, useMemo, useRef, useState } from "react";
import { useProviders } from "@/lib/providerApi";
import { useProviderStore } from "@/store/useProviderStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { NO_LANGUAGE } from "@/lib/languages";
import { sortQualitiesStrict } from "@/lib/audioLanguages";
import {
  MAX_LANGUAGE_PROBES,
  buildMovieOptions,
  enrichLanguages,
  matchProviders,
  resolveEpisodeOptions,
  type BridgeMedia,
  type ProviderState,
  type SourceOption,
} from "@/lib/titleBridge";

export type ProviderStatus = {
  providerId: string;
  name: string;
  status: "searching" | "resolving" | "found" | "none" | "error";
  count: number;
};

const unique = (codes: string[]) => Array.from(new Set(codes));

/** Provider id → display name, falling back to a capitalised id. */
function useProviderNames() {
  const { data } = useProviders();
  return (providerId: string): string => {
    const hit = (data as any[] | undefined)?.find(
      (provider) => provider.value === providerId,
    );
    return (
      hit?.display_name ||
      providerId.charAt(0).toUpperCase() + providerId.slice(1)
    );
  };
}

/**
 * Searches every installed provider for the title, one result at a time as
 * each provider answers.
 */
export function useProviderMatches(media: BridgeMedia | null) {
  const installed = useProviderStore((s) => s.installedProviders);
  const [states, setStates] = useState<Record<string, ProviderState>>({});
  const key = media
    ? `${media.mediaType}|${media.title}|${media.year}|${installed.join(",")}`
    : "";

  useEffect(() => {
    if (!media || installed.length === 0) {
      setStates({});
      return;
    }
    const controller = new AbortController();
    setStates(
      Object.fromEntries(
        installed.map((providerId) => [
          providerId,
          { providerId, status: "searching" } as ProviderState,
        ]),
      ),
    );
    void matchProviders(
      media,
      installed,
      (next) => {
        if (controller.signal.aborted) return;
        setStates((prev) => ({ ...prev, [next.providerId]: next }));
      },
      controller.signal,
    );
    return () => controller.abort();
    // `key` captures everything the search depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { states, installed };
}

/**
 * Adds language-awareness to a stream of rows: probes unknown rows (bounded)
 * and sorts rows whose audio matches the preferred language to the top.
 */
function useLanguageAwareOptions(
  raw: SourceOption[],
  resetKey: string,
  ready: boolean,
) {
  const preferred = useLayoutStore((s) => s.preferredLanguage);
  const preferredCode = preferred && preferred !== NO_LANGUAGE ? preferred : null;
  const [resolved, setResolved] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(0);
  // Bumped when a probe was interrupted by playback starting, so it is queued
  // again (it waits for the player to close before running).
  const [retryTick, setRetryTick] = useState(0);
  const probed = useRef(new Set<string>());
  const budget = useRef(MAX_LANGUAGE_PROBES);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    controller.current = new AbortController();
    probed.current = new Set();
    budget.current = MAX_LANGUAGE_PROBES;
    setResolved({});
    setPending(0);
    return () => controller.current?.abort();
  }, [resetKey, preferredCode]);

  useEffect(() => {
    if (!preferredCode || !ready || budget.current <= 0) return;
    const signal = controller.current?.signal;
    if (!signal) return;
    const targets = raw
      .filter(
        (option) =>
          !probed.current.has(option.id) &&
          !option.languages.includes(preferredCode) &&
          (option.languages.length === 0 || option.multiAudio),
      )
      .slice(0, budget.current);
    if (targets.length === 0) return;
    targets.forEach((option) => probed.current.add(option.id));
    budget.current -= targets.length;
    setPending((count) => count + targets.length);
    void enrichLanguages(
      targets,
      (id, codes) => {
        if (signal.aborted) return;
        setResolved((prev) => ({ ...prev, [id]: codes }));
      },
      signal,
      (id) => {
        if (signal.aborted) return;
        probed.current.delete(id);
        budget.current += 1;
        setRetryTick((tick) => tick + 1);
      },
    ).finally(() => {
      if (!signal.aborted) setPending((count) => Math.max(0, count - targets.length));
    });
  }, [raw, preferredCode, ready, retryTick]);

  const options = useMemo(() => {
    const merged = raw.map((option) =>
      option.id in resolved
        ? {
            ...option,
            languages: unique([...option.languages, ...resolved[option.id]]),
            languageChecked: true,
          }
        : option,
    );
    // Strict order: preferred language, then multi-audio, then the rest.
    return sortQualitiesStrict(merged, preferredCode);
  }, [raw, resolved, preferredCode]);

  return { options, preferredCode, checkingAudio: pending > 0 };
}

/** Movie sources: every quality row of every matched provider. */
export function useMovieSources(media: BridgeMedia | null) {
  const { states, installed } = useProviderMatches(media);
  const nameOf = useProviderNames();

  const raw = useMemo(
    () =>
      installed.flatMap((providerId) => {
        const state = states[providerId];
        return state?.status === "done"
          ? state.matches.flatMap(buildMovieOptions)
          : [];
      }),
    [states, installed],
  );

  const settled = installed.every(
    (id) => states[id] && states[id].status !== "searching",
  );
  const resetKey = media ? `${media.mediaType}|${media.title}|${media.year}` : "";
  const { options, preferredCode, checkingAudio } = useLanguageAwareOptions(
    raw,
    resetKey,
    raw.length > 0,
  );

  const providers: ProviderStatus[] = installed.map((providerId) => {
    const state = states[providerId];
    const count = raw.filter((option) => option.providerId === providerId).length;
    return {
      providerId,
      name: nameOf(providerId),
      status:
        !state || state.status === "searching"
          ? "searching"
          : state.status === "done"
            ? "found"
            : state.status === "error"
              ? "error"
              : "none",
      count,
    };
  });

  return {
    options,
    providers,
    loading: !settled,
    checkingAudio,
    preferredCode,
    noProviders: installed.length === 0,
  };
}

/** Series sources: the qualities of one episode across matched providers. */
export function useEpisodeSources(
  media: BridgeMedia | null,
  season: number | null,
  episode: number | null,
) {
  const { states, installed } = useProviderMatches(media);
  const nameOf = useProviderNames();
  const [byProvider, setByProvider] = useState<Record<string, SourceOption[]>>({});
  const [resolving, setResolving] = useState<string[]>([]);
  const started = useRef(new Set<string>());
  const controller = useRef<AbortController | null>(null);
  const selectionKey = `${media?.title}|${season}|${episode}`;

  // New episode (or season): drop old rows and abort in-flight lookups.
  useEffect(() => {
    controller.current?.abort();
    controller.current = new AbortController();
    started.current = new Set();
    setByProvider({});
    setResolving([]);
    return () => controller.current?.abort();
  }, [selectionKey]);

  // Resolve each provider's episode as soon as its match arrives.
  useEffect(() => {
    if (!media || season == null || episode == null) return;
    const signal = controller.current?.signal;
    if (!signal) return;
    Object.values(states).forEach((state) => {
      if (state.status !== "done") return;
      const key = `${state.providerId}|${season}|${episode}`;
      if (started.current.has(key)) return;
      started.current.add(key);
      setResolving((prev) => [...prev, state.providerId]);
      void resolveEpisodeOptions(
        media,
        state.matches,
        season,
        episode,
        (providerId, options) => {
          if (signal.aborted) return;
          setByProvider((prev) => {
            const existing = prev[providerId] || [];
            const fresh = options.filter(
              (option) => !existing.some((known) => known.id === option.id),
            );
            return fresh.length === 0
              ? prev
              : { ...prev, [providerId]: [...existing, ...fresh] };
          });
        },
        signal,
      ).finally(() => {
        if (!signal.aborted) {
          setResolving((prev) => prev.filter((id) => id !== state.providerId));
        }
      });
    });
  }, [states, media, season, episode, selectionKey]);

  const raw = useMemo(
    () => installed.flatMap((providerId) => byProvider[providerId] || []),
    [byProvider, installed],
  );

  const settled =
    installed.every((id) => states[id] && states[id].status !== "searching") &&
    resolving.length === 0;

  const { options, preferredCode, checkingAudio } = useLanguageAwareOptions(
    raw,
    selectionKey,
    raw.length > 0,
  );

  const providers: ProviderStatus[] = installed.map((providerId) => {
    const state = states[providerId];
    const count = (byProvider[providerId] || []).length;
    let status: ProviderStatus["status"];
    if (!state || state.status === "searching") status = "searching";
    else if (state.status === "error") status = "error";
    else if (state.status === "empty") status = "none";
    else if (resolving.includes(providerId)) status = "resolving";
    else status = count > 0 ? "found" : "none";
    return { providerId, name: nameOf(providerId), status, count };
  });

  return {
    options,
    providers,
    loading: !settled,
    checkingAudio,
    preferredCode,
    noProviders: installed.length === 0,
  };
}
