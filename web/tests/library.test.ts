import assert from "node:assert/strict";
import { test } from "node:test";
import type { SavedTitle } from "../src/lib/library";

Object.defineProperty(globalThis, "localStorage", {
  value: (() => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
  })(),
  configurable: true,
});

test("library persists profile, provider, watchlist, progress, and search changes", async () => {
  const { useLibrary } = await import("../src/lib/library");
  const initial = useLibrary.getState();
  const entry: SavedTitle = { href: "/title/movie/42", title: "Example", layout: "movie" };
  initial.saveProfile({ name: "Alex", avatar: "Violet" });
  const alex = useLibrary.getState().activeProfile!;
  initial.saveProfile({ name: "Sam", avatar: "Gold" });
  const sam = useLibrary.getState().profiles[1].id;
  initial.selectProfile(sam);
  initial.removeProfile(sam);
  assert.equal(useLibrary.getState().activeProfile, alex);
  initial.activate("castle");
  initial.removeProvider("castle");
  assert.equal(useLibrary.getState().activeProvider, "vega");
  initial.toggleSaved(entry);
  initial.addSearch("Example");
  initial.addSearch("example");
  assert.deepEqual(useLibrary.getState().history, ["example"]);
  initial.saveProgress({ ...entry, position: 8, duration: 100, updatedAt: 1 });
  assert.equal(useLibrary.getState().progress.length, 0);
  initial.saveProgress({ ...entry, position: 20, duration: 100, updatedAt: 2 });
  assert.equal(useLibrary.getState().progress[0].position, 20);
  initial.saveProgress({ ...entry, position: 90, duration: 100, updatedAt: 3 });
  assert.equal(useLibrary.getState().progress.length, 0);
  initial.dismissProgress(entry.href);
  initial.saveProgress({ ...entry, position: 30, duration: 100, updatedAt: 4 });
  assert.equal(useLibrary.getState().progress.length, 0);
  const persisted = localStorage.getItem("k45-web-library")!;
  useLibrary.setState({ watchlist: [], profiles: [], history: [], activeProfile: null });
  localStorage.setItem("k45-web-library", persisted);
  await useLibrary.persist.rehydrate();
  assert.deepEqual(useLibrary.getState().watchlist, [entry]);
  assert.equal(useLibrary.getState().activeProfile, alex);
  assert.deepEqual(useLibrary.getState().history, ["example"]);
});

test("preferences migrate older caption shadows and validate persisted values", async () => {
  const { usePlayerPreferences } = await import("../src/lib/player-preferences");
  localStorage.setItem("k45-web-player-preferences", JSON.stringify({
    state: { captions: { shadow: true, size: 300, color: "invalid" }, autoplay: true, controlsTimeout: 7 },
    version: 0,
  }));
  await usePlayerPreferences.persist.rehydrate();
  const state = usePlayerPreferences.getState();
  assert.equal(state.captions.shadow, 2);
  assert.equal(state.captions.size, 42);
  assert.equal(state.captions.color, "#ffffff");
  assert.equal(state.autoplay, true);
  assert.equal(state.controlsTimeout, 5);
  state.resetAll();
  assert.equal(usePlayerPreferences.getState().autoplay, false);
});
