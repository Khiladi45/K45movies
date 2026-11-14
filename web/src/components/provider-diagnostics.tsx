"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { providers } from "@/lib/catalog-api";
import type { Episode, Source } from "@/lib/catalog-types";
import { checkSource } from "@/lib/player-actions";
import { parseCues } from "@/lib/video-cues";
import { QueryMessage } from "./catalog-ui";

const labels = ["Manifest", "Initialize and catalog", "Search", "Metadata", "Streams", "Subtitles"] as const;
type Result = { state: "pending" | "running" | "passed" | "failed" | "skipped"; message?: string; ms?: number };

export function ProviderDiagnostics() {
  const query = useQuery({ queryKey: ["manifest"], queryFn: ({ signal }) => providers.manifest(signal) });
  const [id, setId] = useState("vega");
  const selected = query.data?.some((provider) => provider.id === id) ? id : query.data?.[0]?.id;
  const [term, setTerm] = useState("Batman");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const controller = useRef<AbortController>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function stop() {
    controller.current?.abort();
    setRunning(false);
    setResults((list) => list.map((row) => row.state === "pending" || row.state === "running"
      ? { state: "skipped", message: "Canceled" } : row));
  }

  async function start() {
    if (!selected) return;
    controller.current?.abort();
    const run = new AbortController();
    controller.current = run;
    setRunning(true);
    setResults(labels.map(() => ({ state: "pending" })));
    const update = (index: number, result: Result) => {
      if (!run.signal.aborted) setResults((list) => list.map((entry, i) => i === index ? result : entry));
    };
    let stage = 0;
    async function step(check: (signal: AbortSignal) => Promise<string | undefined>) {
      const current = stage++;
      const start = performance.now();
      const signal = AbortSignal.any([run.signal, AbortSignal.timeout(28_000)]);
      update(current, { state: "running" });
      try {
        const message = await check(signal);
        update(current, { state: message === undefined ? "skipped" : "passed", message: message ?? "Unavailable for this title", ms: Math.round(performance.now() - start) });
      } catch (error) {
        update(current, { state: "failed", message: error instanceof Error ? error.message : "Check failed", ms: Math.round(performance.now() - start) });
        throw error;
      }
    }

    try {
      let ref = "";
      let candidates: Episode[] = [];
      let series = false;
      let sources: Source[] = [];
      await step(async (signal) => {
        const record = (await providers.manifest(signal)).find((entry) => entry.id === selected);
        if (!record) throw new Error("Provider missing from the manifest.");
        return [record.name, record.version].filter(Boolean).join(" · ");
      });
      await step(async (signal) => {
        const catalog = await providers.catalog(selected, signal);
        if (!catalog.length) throw new Error("Provider returned an empty catalog.");
        return catalog.length + " categories";
      });
      await step(async (signal) => {
        const posts = await providers.search(selected, term.trim(), signal);
        if (!posts.length) throw new Error("No search results. Try another title.");
        ref = posts[0].ref;
        return posts.length + " results";
      });
      await step(async (signal) => {
        const detail = await providers.title(selected, ref, signal);
        series = /series|tv|show/i.test(detail.type ?? "");
        const group = detail.groups.find((item) => item.directLinks.length || item.episodesRef);
        candidates = group?.episodesRef ? await providers.episodes(selected, group.episodesRef, signal) : group?.directLinks ?? [];
        return detail.title;
      });
      await step(async (signal) => {
        if (!candidates.length) return undefined;
        sources = await providers.sources(selected, candidates[0].ref, series ? "series" : "movie", signal);
        if (!sources.length) throw new Error("No streaming servers were returned.");
        const checked = await Promise.all(sources.slice(0, 3).map((source) => checkSource(source, signal)));
        if (checked.every((result) => result === "failed")) throw new Error("The checked servers did not respond.");
        return sources.length + " servers · " + checked.filter((result) => result === "available").length + " verified by HEAD";
      });
      await step(async (signal) => {
        const track = sources.flatMap((source) => source.subtitles)[0];
        if (!track) return undefined;
        const response = await fetch(track.url, { signal });
        if (!response.ok) throw new Error("Subtitle request failed.");
        const cues = parseCues(await response.text());
        if (!cues.length) throw new Error("No readable cues in the subtitle track.");
        return track.label + " · " + cues.length + " cues";
      });
    } catch {
      for (let i = stage; i < labels.length; i++) update(i, { state: "skipped", message: "Previous check failed" });
    } finally {
      if (!run.signal.aborted) setRunning(false);
    }
  }

  if (query.isError) return <QueryMessage retry={() => void query.refetch()}>{query.error.message}</QueryMessage>;
  if (query.isPending) return <p role="status">Loading providers…</p>;
  return <div className="max-w-2xl">
    <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void start(); }}>
      <label className="grid gap-1 text-sm">Provider
        <select className="field" value={selected ?? ""} disabled={running || !selected} onChange={(event) => setId(event.target.value)}>
          {query.data.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Search title
        <input className="field" value={term} minLength={2} maxLength={120} required disabled={running} onChange={(event) => setTerm(event.target.value)} />
      </label>
      {running ? <button type="button" className="secondary-button" onClick={stop}>Cancel</button> :
        <button type="submit" className="primary-button" disabled={!selected || term.trim().length < 2}>Run diagnostics</button>}
    </form>
    <ol className="grid gap-2" aria-live="polite">{labels.map((label, i) => {
      const result = results[i];
      return <li key={label} className="list-row flex-wrap justify-between">
        <span><strong className="block">{label}</strong>{result?.message && <span className="text-sm text-muted">{result.message}</span>}</span>
        <span className="chip capitalize">{result?.state ?? "Pending"}{result?.ms !== undefined && " · " + result.ms + " ms"}</span>
      </li>;
    })}</ol>
  </div>;
}
