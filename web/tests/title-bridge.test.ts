import assert from "node:assert/strict";
import { test } from "node:test";
import { choicesFor, detectAudio, episodeNumber, matchProvider, streamLanguages, type Match } from "../src/lib/title-bridge";
import type { TitleDetail } from "../src/lib/catalog-types";

test("keeps the requested season and episode and carries the complete episode list", async () => {
  const matches: Match[] = [{
    post: { title: "Example", ref: "show.ref" },
    detail: { title: "Example", ref: "show.ref", tags: [], cast: [], groups: [
      { title: "Season 1", directLinks: [{ title: "E02", ref: "wrong.ref" }] },
      { title: "Season 2 [Tam-Hin] 720p", directLinks: [{ title: "S02E01", ref: "first.ref" }, { title: "S02E02", ref: "correct.ref" }] },
      { title: "Season 2 1080p", directLinks: [{ title: "E03", ref: "missing.ref" }] },
    ] },
  }];
  const choices = await choicesFor("vega", matches, 2, 2, 2, new AbortController().signal);
  assert.deepEqual(choices.map(({ episode }) => episode.ref), ["correct.ref"]);
  assert.deepEqual(choices[0].episodes.map(({ ref }) => ref), ["first.ref", "correct.ref"]);
  assert.deepEqual(choices[0].languages, ["ta", "hi"]);
  assert.equal(episodeNumber("S02E02"), 2);
});

test("recognizes language metadata and ignores subtitle language labels", () => {
  assert.deepEqual(detectAudio("Tamil 1080p English Subs"), ["ta"]);
  assert.deepEqual(streamLanguages(["tam", "Tamil", "Hindi audio"]), ["ta", "hi"]);
});

test("filters same-name remakes by year and checks metadata type", async (context) => {
  const expected: TitleDetail = {
    id: 1, mediaType: "movie", title: "Example Feature", originalTitle: "Example Feature",
    year: "2024", genres: [], cast: [], seasons: [], similar: [],
  };
  const requested: string[] = [];
  context.mock.method(globalThis, "fetch", async (input: string) => {
    const query = new URL(input, "https://example.test").searchParams;
    if (query.get("op") === "search") return Response.json([
      { title: "Example Feature (1960)", ref: "old.ref" },
      { title: "Example Feature (2024) 1080p", ref: "film.ref" },
      { title: "Example Feature (2024)", ref: "series.ref" },
    ]);
    const ref = query.get("ref")!;
    requested.push(ref);
    return Response.json({ title: expected.title, ref, type: ref === "film.ref" ? "movie" : "series",
      groups: [{ title: "1080p", directLinks: [{ title: "Play", ref: "stream.ref" }] }] });
  });
  const matches = await matchProvider("vega", expected, new AbortController().signal);
  assert.deepEqual(matches.map(({ post }) => post.ref), ["film.ref"]);
  assert.ok(!requested.includes("old.ref"));
});
