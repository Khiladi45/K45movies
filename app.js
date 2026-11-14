import { manifest, provider, tmdb, tmdbTitle, tmdbKey, saveTmdbKey } from "./live-api.js";

import { openPlayer, closePlayer } from "./player.js";
import { firstAvailable, sameMovie, titleIdentity } from "./recovery.js";

const main = document.querySelector("main");
const template = document.querySelector("#card");
const dialog = document.querySelector("#search-dialog");
const searchInput = document.querySelector("#query");
const defaults = { layout: "provider", installed: [], active: "", saved: [], theme: "violet", profiles: [], profile: "", progress: {} };
const state = load();
document.documentElement.dataset.theme = state.theme;
let revision = 0;

function load() {
  try {
    const value = JSON.parse(localStorage.getItem("k45-pages-live") ?? "{}");
    return { ...defaults, ...value, installed: Array.isArray(value.installed) ? value.installed.filter((id) => id !== "vega") : [],
      active: value.active === "vega" ? "" : value.active,
      saved: Array.isArray(value.saved) ? value.saved : [],
      profiles: Array.isArray(value.profiles) ? value.profiles.filter((profile) => profile?.id && typeof profile.name === "string" && Array.isArray(profile.saved)) : [],
      progress: value.progress && typeof value.progress === "object" ? value.progress : {} };
  } catch { return { ...defaults }; }
}

function persist() { localStorage.setItem("k45-pages-live", JSON.stringify(state)); }
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(name, href, className) {
  const node = element("a", name, className);
  node.href = href;
  if (href.startsWith("#title/")) node.onclick = (event) => {
    if (!titleOverlay || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    location.replace(href);
  };
  return node;
}
function action(name, callback, style = "button") {
  const node = element("button", name, style);
  node.type = "button";
  node.onclick = callback;
  return node;
}
function asset(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.href;
  } catch { /* Some providers return no artwork. */ }
  return "./brand.png";
}
function titleUrl(entry) {
  const query = entry.kind === "tmdb" ? { type: entry.type, id: entry.id } : { provider: entry.id, link: entry.link };
  return "#title/" + new URLSearchParams(query);
}
const post = (id, item) => ({ kind: "provider", id, link: item.link, name: item.title, image: item.image });
const previews = new Map();
function remember(entry) {
  const url = titleUrl(entry);
  if (previews.size >= 300 && !previews.has(url)) previews.delete(previews.keys().next().value);
  previews.set(url, entry);
  return url;
}
function grid(items) {
  const list = element("ul", "", "cards");
  for (const title of items) {
    const card = template.content.cloneNode(true);
    const anchor = card.querySelector("a");
    anchor.href = remember(title);
    anchor.onclick = link("", anchor.hash).onclick;
    card.querySelector("img").src = asset(title.image);
    card.querySelector("img").onerror = ({ currentTarget: img }) => { if (!img.src.endsWith("/brand.png")) img.src = "./brand.png"; };
    card.querySelector("strong").textContent = title.name;
    card.querySelector("small").textContent = title.year ?? "";
    list.append(card);
  }
  return list;
}
function rail(title, items, style = "") {
  const section = element("section", "", "title-rail " + style);
  const row = grid(items);
  section.append(element("h2", title), row,
    action("‹", () => row.scrollBy({ left: -row.clientWidth * .82, behavior: "smooth" }), "rail-arrow previous"),
    action("›", () => row.scrollBy({ left: row.clientWidth * .82, behavior: "smooth" }), "rail-arrow next"));
  section.querySelector(".previous").setAttribute("aria-label", "Previous " + title);
  section.querySelector(".next").setAttribute("aria-label", "Next " + title);
  return section;
}
function progressStore() { return state.progress[state.profile || "default"] ??= {}; }
function playbackProgress(entry, episode, fromBeginning = false) {
  const key = titleUrl(entry) + (episode ? "|" + episode.link : "");
  const store = progressStore();
  return {
    resume: fromBeginning ? 0 : store[key]?.time,
    onProgress(time, duration) {
      if (duration - time <= 15) delete store[key];
      else store[key] = { entry, time, duration, updated: Date.now() };
      const keys = Object.keys(store).sort((a, b) => store[b].updated - store[a].updated);
      keys.slice(35).forEach((key) => delete store[key]);
      persist();
    },
  };
}
function resumeRail() {
  const seen = new Set();
  const resume = Object.values(progressStore()).sort((a, b) => b.updated - a.updated).map(({ entry }) => entry)
    .filter((entry) => !seen.has(titleUrl(entry)) && seen.add(titleUrl(entry)));
  return resume.length ? rail("Continue watching", resume, "landscape resume-rail") : null;
}
function homeRows(items, title, ranked = false) {
  const resume = resumeRail();
  return [...(resume ? [resume] : []),
    rail(title, items), ...(ranked && items.length >= 10 ? [rail("Top 10 trending", items.slice(0, 10), "ranked")] : [])];
}
function heading(root, title, description) {
  const block = element("div", "", "page-heading");
  block.append(element("p", "K45movies", "eyebrow"), element("h1", title));
  if (description) note(block, description);
  root.append(block);
}
function note(root, message) { root.append(element("p", message)); }
function setup(root) {
  const box = element("section", "", "panel");
  box.append(element("h2", "Browser Bridge"), element("p", "Load Browser Bridge in Brave, Chrome or Edge, then use its toolbar icon to allow provider access once."),
    link("Install browser extension", "./k45movies-bridge.zip", "button primary"), " ",
    link("Installation instructions", "#settings", "button"));
  root.append(box);
}
function busy(root, label = "Loading…") {
  const node = element("p", label, "loading");
  node.setAttribute("role", "status");
  root.replaceChildren(node);
}
async function run(root, work) {
  try { await work(); }
  catch (error) {
    const message = /The provider could not complete this request/.test(error.message) ? "This provider did not respond. Try again or switch providers." : error.message;
    root.replaceChildren(element("p", message || "Something went wrong.", "notice"), action("Retry", () => {
      busy(root, "Trying again…"); void run(root, work);
    }));
  }
}
function select(root, label, items, onChange, current) {
  const caption = element("label", "", "filter");
  const input = element("select");
  for (const item of items) {
    const option = element("option", item.label);
    option.value = item.value;
    if (String(item.value) === String(current)) option.selected = true;
    input.append(option);
  }
  input.onchange = () => onChange(input.value);
  caption.append(element("span", label), input);
  root.append(caption);
  return input;
}

function artwork(hero, entry) {
  if (entry.backdrop) setBackdrop(hero, entry.backdrop);
  else if (entry.kind === "provider" && tmdbKey()) void providerBackdrop(entry).then((url) => {
    if (url && hero.isConnected) setBackdrop(hero, url);
  }).catch(() => {});
  const art = element("img", "", "hero-poster");
  art.src = asset(entry.poster ?? entry.image);
  art.alt = "";
  art.onerror = () => { if (!art.src.endsWith("/brand.png")) art.src = "./brand.png"; };
  hero.append(art);
  if (!entry.backdrop && entry.image) {
    const wash = element("img", "", "poster-wash");
    wash.src = asset(entry.image);
    wash.alt = "";
    hero.prepend(wash);
  }
}

function setBackdrop(hero, url) {
  const backdrop = element("img", "", "hero-backdrop");
  backdrop.alt = "";
  backdrop.src = asset(url);
  backdrop.onload = () => hero.classList.add("has-backdrop");
  backdrop.onerror = () => backdrop.remove();
  hero.prepend(backdrop);
}

const backdropCache = new Map();
function providerBackdrop(entry) {
  const year = entry.name.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const query = entry.name.split(/\s*\((?:19|20)\d{2}\)/)[0].trim();
  if (!year || query.length < 2) return Promise.resolve();
  const key = query + " " + year;
  if (!backdropCache.has(key)) {
    if (backdropCache.size >= 30) backdropCache.delete(backdropCache.keys().next().value);
    const exact = (value) => typeof value === "string" && value.toLowerCase().trim() === query.toLowerCase();
    const request = tmdb("search/multi", { query }).then(({ results }) => {
      const match = results.find((item) => (item.media_type === "movie" || item.media_type === "tv") && item.backdrop_path &&
        (item.release_date ?? item.first_air_date ?? "").startsWith(year) && [item.title, item.original_title, item.name, item.original_name].some(exact));
      return match ? tmdbTitle(match)?.backdrop : undefined;
    }).catch(() => { backdropCache.delete(key); });
    backdropCache.set(key, request);
  }
  return backdropCache.get(key);
}

function feature(entry, title) {
  const hero = element("section", "", "hero");
  artwork(hero, entry);
  const content = element("div", "", "hero-copy");
  const actions = element("div", "", "actions");
  actions.append(link("▶  Watch now", remember(entry), "button primary watch-cta"), saveButton(entry));
  content.append(element("p", "In the spotlight", "eyebrow"),
    element("h2", entry.name), element("p", [entry.year, title].filter(Boolean).join("  •  "), "hero-meta"));
  const synopsis = element("p", entry.synopsis, "hero-synopsis");
  synopsis.hidden = !entry.synopsis;
  content.append(synopsis);
  if (!entry.synopsis && entry.kind === "provider") void provider("title", { id: entry.id, link: entry.link }).then((detail) => {
    if (!hero.isConnected || !detail.synopsis) return;
    synopsis.textContent = detail.synopsis;
    synopsis.hidden = false;
  }).catch(() => {});
  content.append(actions);
  hero.append(content);
  return hero;
}

function featureRail(items, label) {
  const rail = element("div", "", "feature-rail");
  const stage = element("div");
  const bar = element("div", "", "feature-picker");
  const candidates = items.slice(0, 5);
  function show(index) {
    stage.replaceChildren(feature(candidates[index], label));
    for (const [i, button] of [...bar.children].entries()) button.setAttribute("aria-pressed", String(i === index));
  }
  for (const [index, item] of candidates.entries()) {
    const button = action("", () => show(index), "poster-picker");
    button.setAttribute("aria-label", "Feature " + item.name);
    const img = element("img");
    img.src = asset(item.backdrop || item.image);
    img.alt = "";
    button.append(img);
    bar.append(button);
  }
  rail.append(stage);
  if (candidates.length > 1) rail.append(bar);
  show(0);
  return rail;
}

function detailHeader(entry, subtitle, play) {
  const hero = element("section", "", "detail-hero");
  artwork(hero, entry);
  const content = element("div", "", "hero-copy");
  const actions = element("div", "", "actions");
  if (play) actions.append(action(playbackProgress(entry).resume ? "▶  Resume" : "▶  Watch now", play, "primary watch-cta"));
  actions.append(saveButton(entry));
  content.append(element("p", "Title details", "eyebrow"), element("h1", entry.name), element("p", subtitle, "hero-meta"));
  if (entry.synopsis) content.append(element("p", entry.synopsis, "hero-synopsis"));
  content.append(actions);
  hero.append(content);
  return hero;
}

async function browse(root) {
  const content = element("section");
  root.append(content);
  busy(content);
  await run(content, async () => {
    if (state.layout === "movie") {
      const data = await tmdb("trending/all/week");
      const items = data.results.map((item) => tmdbTitle(item)).filter(Boolean);
      content.replaceChildren(...(items.length ? [featureRail(items, "TMDB Trending"), ...homeRows(items, "Trending this week", true)] : [element("p", "No trending titles.")]));
      return;
    }
    if (!state.active) {
      content.replaceChildren(link("Choose a provider", "#providers", "button primary"));
      const intro = element("div");
      heading(intro, "Find your next watch", "Choose a provider to browse its live catalog.");
      content.prepend(intro);
      setup(content);
      return;
    }
    const selectedId = state.active;
    const catalog = await firstAvailable([selectedId, ...state.installed.filter((id) => id !== selectedId)].slice(0, 5), async (id) => {
      const categories = await provider("catalog", { id });
      if (!categories.length) return [];
      const first = await provider("posts", { id, filter: categories[0].filter, page: 1 });
      return first.length || id === selectedId && state.installed.length === 1 ? [{ categories, first }] : [];
    });
    content.replaceChildren();
    if (!catalog) {
      content.append(element("p", "Your installed providers did not return a catalog right now.", "notice"),
        action("Try again", render), link("Manage providers", "#providers", "button"));
      return;
    }
    const { item: id, value: [{ categories, first }] } = catalog;
    const shelf = element("section");
    let request = 0;
    async function show(filter, initial) {
      const call = ++request;
      const results = element("div");
      shelf.replaceChildren(results);
      busy(results);
      await run(results, async () => {
        let page = 1;
        const items = initial ?? await provider("posts", { id, filter, page });
        if (request !== call) return;
        const cards = items.map((item) => post(id, item));
        const featured = cards.filter((item) => item.image);
        results.replaceChildren(...(cards.length ? [featureRail(featured.length ? featured : cards, id), ...homeRows(cards, categories.find((item) => item.filter === filter)?.title ?? "Catalog")] : [element("p", "No titles returned.")]));
        if (!items.length) return;
        const more = action("Load more", async () => {
          more.disabled = true;
          try {
            const next = await provider("posts", { id, filter, page: page + 1 });
            if (request !== call) return;
            page++;
            if (!next.length) { more.remove(); return; }
            const row = results.querySelector(".title-rail:last-of-type .cards");
            row?.append(...grid(next.map((item) => post(id, item))).children);
          } catch (error) { note(results, error.message); }
          finally { more.disabled = false; }
        });
        results.append(more);
      });
    }
    const bar = element("div", "", "actions catalog-filters");
    bar.append(element("h1", "Discover", "sr-only"));
    select(bar, "Provider", state.installed.map((id) => ({ label: id, value: id })), (value) => {
      state.active = value; persist(); render();
    }, id);
    select(bar, "Category", categories.map((category) => ({ label: category.title, value: category.filter })), show);
    content.className = "provider-home";
    content.append(shelf, bar);
    await show(categories[0].filter, first);
  });
}

async function providersPage(root) {
  heading(root, "Providers", "Choose the catalogs you want to browse.");
  const body = element("section");
  root.append(body);
  busy(body);
  await run(body, async () => {
    const registry = await manifest();
    const supported = await provider("ping").catch(() => []);
    body.replaceChildren();
    if (!supported.length) setup(body);
    const filter = element("input");
    filter.type = "search";
    filter.placeholder = "Filter providers";
    filter.setAttribute("aria-label", "Filter providers");
    const list = element("div", "", "provider-list");
    filter.className = "provider-filter";
    body.append(filter, list);
    function draw() {
      list.replaceChildren();
      for (const item of registry.filter(({ name }) => (name ?? "").toLowerCase().includes(filter.value.toLowerCase()))) {
        const row = element("div", "", "panel bar");
        const installed = state.installed.includes(item.id);
        const active = state.active === item.id;
        row.append(element("strong", item.name ?? item.id));
        if (active) row.append(element("span", "Active", "provider-status"));
        else if (supported.includes(item.id)) {
          const activate = action(installed ? "Activate" : "Install", async () => {
          activate.disabled = true;
          row.querySelector("p")?.remove();
          const status = element("p", "Checking provider…");
          row.append(status);
          try {
            const categories = await provider("catalog", { id: item.id });
            if (!categories.length || !(await provider("posts", { id: item.id, filter: categories[0].filter, page: 1 })).length) {
              throw new Error("This provider didn’t return any titles.");
            }
            if (!installed) state.installed.push(item.id);
            state.active = item.id;
            persist();
            draw();
          } catch (error) {
            status.textContent = error.needsAccess || error.bridgeMissing ? error.message : "This provider’s catalog is unavailable right now.";
            activate.textContent = "Retry";
            activate.disabled = false;
          }
          });
          row.append(activate);
        }
        else row.append(element("span", "Bridge required"));
        if (installed) row.append(action("Remove", () => {
          state.installed = state.installed.filter((value) => value !== item.id);
        if (active) state.active = state.installed[0] ?? "";
          persist(); draw();
        }));
        list.append(row);
      }
    }
    filter.oninput = draw;
    draw();
  });
}

function saveButton(entry) {
  const href = titleUrl(entry);
  const button = action("", () => {
    const saved = currentWatchlist();
    const index = saved.findIndex((item) => titleUrl(item) === href);
    if (index < 0) saved.unshift(entry);
    else saved.splice(index, 1);
    persist();
    update();
  });
  function update() {
    const saved = currentWatchlist().some((item) => titleUrl(item) === href);
    button.textContent = saved ? "✓" : "+";
    button.classList.add("save-icon");
    button.title = saved ? "Remove from watchlist" : "Add to watchlist";
    button.setAttribute("aria-label", saved ? "Remove from watchlist" : "Add to watchlist");
    button.setAttribute("aria-pressed", String(saved));
  }
  update();
  return button;
}

async function providerDetails(root, id, ref, metadata) {
  let detail = metadata;
  if (!detail) detail = await provider("title", { id, link: ref });
  if (!detail.title) throw new Error("Provider returned no title details.");
  const entry = { id, link: ref, kind: "provider", name: detail.title, image: detail.image, synopsis: detail.synopsis };
  const isSeries = /series|tv/i.test(detail.type ?? "");
  const watch = element("section", "", "watch-panel");
  const output = element("div", "", "play-result");
  output.setAttribute("aria-live", "polite");
  const groups = detail.groups.filter((group) => group.entries.length || group.episodesLink);
  const candidates = groups.flatMap((group) => group.entries.map((item) => ({ item, files: /download/i.test(group.title), id })));
  candidates.sort((a, b) => Number(a.files) - Number(b.files));
  const watchButton = !isSeries ? () => void streams(candidates[0], "Watch now") : () => watch.querySelector("button")?.focus();
  root.replaceChildren(detailHeader(entry, [isSeries ? "Series" : "Movie", id].join("  •  "), watchButton), watch);
  watch.append(element("p", "Playback", "eyebrow"), element("h2", "Watch"));
  if (!groups.length) note(watch, "No sources were listed. Watch Now checks your other installed providers.");
  let generation = 0;

  async function streams(selected, name, fromBeginning = false) {
    const current = ++generation;
    const results = element("div");
    output.replaceChildren(results);
    busy(results, "Finding a playable source…");
    const queue = selected ? [selected, ...(!isSeries ? candidates.filter((candidate) => candidate.item.link !== selected.item.link) : [])] : [...candidates];
    await run(results, async () => {
      const tried = new Set();
      const urls = new Set();
      let searched = false;
      const alive = () => current === generation && root.isConnected;
      const load = async ({ item, id: sourceId }) => {
        if (!alive() || tried.has(sourceId + item.link)) return [];
        tried.add(sourceId + item.link);
        const sources = await provider("sources", { id: sourceId, link: item.link, series: isSeries });
        return sources.filter((source) => {
          if (urls.has(source.url)) return false;
          urls.add(source.url);
          return true;
        }).map((source) => ({ ...source, server: source.server.replace(/\bdownload\b/i, "File") }));
      };
      let cursor = 0;
      async function nextSources() {
        while (alive()) {
          const next = queue[cursor++];
          if (next) {
            const result = await firstAvailable([next], load);
            if (result) return result.value;
            continue;
          }
          if (searched || isSeries) return [];
          searched = true;
          cursor--;
          queue.push(...await alternateMovieChoices(entry, id));
        }
        return [];
      }
      const sources = await nextSources();
      if (!alive()) return;
      results.replaceChildren();
      if (!sources.length) {
        results.append(element("p", "No playable source is available for this title right now.", "notice"),
          action("Try again", () => void streams(selected, name, fromBeginning)));
        return;
      }
      openPlayer(isSeries ? detail.title + " · " + name : detail.title, sources, 0,
        { ...playbackProgress(entry, isSeries ? selected?.item : undefined, fromBeginning), nextSources });
    });
  }
  if (!isSeries && playbackProgress(entry).resume) {
    watch.append(action("Watch from beginning", () => void streams(candidates[0], "Watch now", true)));
  }

  function choices(list, entries, files) {
    list.replaceChildren();
    if (!entries.length) { note(list, "No episodes or sources returned."); return; }
    for (const entry of entries) {
      const name = entry.title.replace(/\bdownload\b/ig, "").trim() || "Source";
      const quality = files && name.match(/\b(?:\d{3,4}p|4k)\b/i)?.[0];
      const player = name.match(/^Player\s*:\s*(\d+)$/i)?.[1];
      const button = action("", () => void streams({ item: entry, id, files }, name), "play-option");
      const icon = element("span", "▶", "play-icon");
      icon.setAttribute("aria-hidden", "true");
      const copy = element("span");
      copy.append(element("strong", player ? "Play online" : "Play " + (quality || name)),
        element("small", player ? "Player " + player : quality ? name.replace(quality, "").trim() || "File source" : files ? "File source" : "Streaming source"));
      button.append(icon, copy);
      list.append(button);
    }
  }
  for (const group of groups) {
    const files = /download/i.test(group.title);
    const section = element("section", "", "source-group");
    section.append(element("h3", files ? "File qualities" : group.title));
    const list = element("div", "", "play-options");
    section.append(list);
    watch.append(section);
    if (!group.episodesLink) choices(list, group.entries, files);
    else list.append(action("Show episodes", () => {
      busy(list, "Loading episodes…");
      void run(list, async () => choices(list, await provider("episodes", { id, link: group.episodesLink }), files));
    }));
  }
  watch.append(output);
}

async function alternateMovieChoices(entry, exclude) {
  const { name, year } = titleIdentity(entry.name);
  if (!name || !(entry.year || year)) return [];
  const query = entry.name.split(/\b(?:19|20)\d{2}\b/)[0].trim().replace(/\($/, "").trim().slice(0, 120);
  if (query.length < 2) return [];
  const batches = await Promise.allSettled(state.installed.filter((id) => id !== exclude).slice(0, 4).map(async (id) => {
    const matches = await provider("search", { id, q: query });
    const match = matches.find((item) => sameMovie(entry, item.title));
    if (!match) return [];
    const detail = await provider("title", { id, link: match.link });
    if (/series|tv/i.test(detail.type ?? "")) return [];
    return detail.groups.flatMap((group) => group.entries.slice(0, 2).map((item) => ({ id, item, files: /download/i.test(group.title) }))).slice(0, 4);
  }));
  return batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []).sort((a, b) => Number(a.files) - Number(b.files));
}

function titleMatch(name, candidate) {
  const normal = (value) => value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\b(?:19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const wanted = normal(name);
  const found = normal(candidate);
  return wanted && (found === wanted || found.startsWith(wanted + " "));
}

async function titlePage(root, query) {
  const section = element("section", "", "detail");
  root.append(section);
  busy(section);
  await run(section, async () => {
    const id = query.get("provider");
    if (id) {
      const ref = query.get("link");
      try { await providerDetails(section, id, ref); }
      catch (error) {
        const preview = previews.get(location.hash);
        if (!preview || error.needsAccess || error.bridgeMissing) throw error;
        const resolved = await firstAvailable(await alternateMovieChoices(preview, id), async (choice) =>
          provider("sources", { id: choice.id, link: choice.item.link, series: false }));
        if (!section.isConnected) return;
        section.replaceChildren(detailHeader(preview, "Movie", resolved ? () =>
          openPlayer(preview.name, resolved.value, 0, playbackProgress(preview)) : null));
        if (!resolved) note(section, "No installed provider could open this title right now.");
      }
      return;
    }
    const type = query.get("type");
    const number = query.get("id");
    if (!["movie", "tv"].includes(type) || !/^\d+$/.test(number ?? "")) throw new Error("Invalid title.");
    const raw = await tmdb(type + "/" + number);
    const entry = tmdbTitle(raw, type);
    const options = element("section", "", "watch-panel");
    const play = async () => {
      busy(options, "Finding a playable source…");
      await run(options, async () => {
        const choices = entry.type === "movie" ? await alternateMovieChoices(entry) : [];
        const resolved = await firstAvailable(choices, (choice) => provider("sources", { id: choice.id, link: choice.item.link, series: false }));
        if (!options.isConnected) return;
        if (resolved) {
          options.replaceChildren();
          const remaining = choices.slice(choices.indexOf(resolved.item) + 1);
          openPlayer(entry.name, resolved.value, 0, { ...playbackProgress(entry), nextSources: async () => {
            const next = await firstAvailable(remaining, (choice) => provider("sources", { id: choice.id, link: choice.item.link, series: false }));
            if (!next) return [];
            remaining.splice(0, remaining.indexOf(next.item) + 1);
            return next.value;
          } });
        } else {
          options.replaceChildren(element("p", "No matching playable movie found. Check provider matches below.", "notice"), find);
        }
      });
    };
    section.replaceChildren(detailHeader(entry, [entry.type === "tv" ? "Series" : "Movie", entry.year].filter(Boolean).join(" · "), entry.type === "movie" ? play : null));
    section.append(options);
    const find = action("Find provider sources", async () => {
      busy(options, "Searching installed providers…");
      await run(options, async () => {
        if (!state.installed.length) throw new Error("Install a provider from Providers first.");
        const matches = await Promise.allSettled(state.installed.map(async (id) => ({
          id, items: (await provider("search", { id, q: entry.name.slice(0, 120) }))
            .filter((post) => titleMatch(entry.name, post.title) || (entry.original && titleMatch(entry.original, post.title))),
        })));
        options.replaceChildren();
        for (const matched of matches) {
          if (matched.status !== "fulfilled") continue;
          for (const item of matched.value.items.slice(0, 5)) {
            options.append(link(matched.value.id + " · " + item.title, titleUrl(post(matched.value.id, item)), "button"));
          }
        }
        if (!options.children.length) note(options, matches.every((result) => result.status === "rejected")
          ? matches[0].reason?.message ?? "Provider search failed." : "No matching provider titles.");
      });
    });
    options.append(element("h2", "Watch"), find);
    const related = await tmdb(type + "/" + number + "/recommendations").catch(() => null);
    const relatedItems = related?.results.map((item) => tmdbTitle(item, type)).filter(Boolean);
    if (section.isConnected && relatedItems?.length) section.append(rail("More like this", relatedItems));
  });
}

async function search(root, query) {
  heading(root, "Search");
  note(root, query ? "Results for “" + query + "”" : "Enter a title to search.");
  if (query.length < 2) return;
  const content = element("section");
  root.append(content);
  busy(content);
  await run(content, async () => {
    let items = [];
    if (state.layout === "movie") {
      const data = await tmdb("search/multi", { query });
      items = data.results.map((item) => tmdbTitle(item)).filter(Boolean);
    } else {
      if (!state.installed.length) throw new Error("Install a provider from Providers first.");
      const results = await Promise.allSettled(state.installed.map(async (id) =>
        (await provider("search", { id, q: query })).map((item) => post(id, item))));
      if (results.every((result) => result.status === "rejected")) throw results[0].reason;
      items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    }
    content.replaceChildren(items.length ? grid(items) : element("p", "No matching titles."));
  });
}

function settings(root) {
  heading(root, "Settings", "Make K45movies yours.");
  const group = element("fieldset");
  group.append(element("legend", "Browse by"));
  for (const [value, name] of [["provider", "Provider Based"], ["movie", "Movie Based"]]) {
    const label = element("label");
    const input = element("input");
    Object.assign(input, { type: "radio", name: "layout", value, checked: state.layout === value });
    input.onchange = () => { state.layout = value; persist(); };
    label.append(input, " " + name);
    group.append(label);
  }
  const form = element("form", "", "panel");
  const key = element("input");
  key.type = "password";
  key.autocomplete = "off";
  key.id = "tmdb-key";
  key.value = tmdbKey();
  const label = element("label", "TMDB v3 API key");
  label.htmlFor = key.id;
  const status = element("p", "");
  status.setAttribute("role", "status");
  const save = element("button", "Save key", "primary");
  form.append(element("h2", "Movie Based"), label, key, save, status);
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      saveTmdbKey(key.value.trim());
      if (!key.value.trim()) { status.textContent = "Key removed."; return; }
      await tmdb("configuration");
      status.textContent = "TMDB connected.";
    } catch (error) { status.textContent = error.message; }
  };
  const hint = element("p", "Your key is saved only in this browser and used to request TMDB data.");
  form.append(hint);
  const attribution = element("p");
  attribution.append("This product uses the TMDB API but is not endorsed or certified by TMDB. ", link("TMDB", "https://www.themoviedb.org/"));
  const appearance = element("fieldset");
  appearance.append(element("legend", "Appearance"));
  select(appearance, "Theme", [{label:"Violet",value:"violet"},{label:"Ember",value:"ember"},{label:"Ocean",value:"ocean"}], (theme) => {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    persist();
  }, state.theme);
  root.append(group, appearance, form, attribution);
  setup(root);
  note(root, "Extract the ZIP. Open brave://extensions, chrome://extensions or edge://extensions, enable Developer mode, then choose Load unpacked and select the extracted folder. For an update, replace the files in that folder and click Reload on the extension.");
}

let titleOverlay, titleBase, titleOpener, lastRoute;
const avatarColors = ["#2846a0", "#7b2459", "#17665d", "#664e16", "#513b89"];
function profilePage(root) {
  const top = element("div", "", "profile-banner");
  top.append(element("h1", "My space"), link("Settings", "#settings", "button"));
  const profiles = element("div", "", "profile-list");
  const entries = [{ id: "", name: "Default" }, ...state.profiles];
  for (const [index, profile] of entries.entries()) {
    const tile = action("", () => { state.profile = profile.id; persist(); render(); }, "profile-tile");
    tile.setAttribute("aria-pressed", String(state.profile === profile.id));
    const face = element("span", profile.name.slice(0, 1).toUpperCase(), "avatar");
    face.style.backgroundColor = avatarColors[index % avatarColors.length];
    tile.append(face, element("strong", profile.name));
    profiles.append(tile);
  }
  if (entries.length < 6) {
    const add = action("", () => {
      add.hidden = true;
      const form = element("form", "", "profile-form");
      const field = element("input");
      Object.assign(field, { type: "search", placeholder: "Profile name", maxLength: 24, required: true });
      field.setAttribute("aria-label", "Profile name");
      form.append(field, element("button", "Create", "primary"), action("Cancel", () => { form.remove(); add.hidden = false; add.focus(); }));
      form.onsubmit = (event) => {
        event.preventDefault();
        const name = field.value.trim();
        if (!name) return;
        state.profile = crypto.randomUUID();
        state.profiles.push({ id: state.profile, name, saved: [] });
        persist(); render();
      };
      profiles.append(form);
      field.focus();
    }, "profile-tile");
    add.append(element("span", "+", "avatar"), element("strong", "Add profile"));
    profiles.append(add);
  }
  const saved = currentWatchlist();
  root.append(top, element("h2", "Profiles"), profiles,
    saved.length ? rail("Watchlist", saved) : element("p", "Your watchlist is empty."));
}

function currentWatchlist() { return state.profiles.find((profile) => profile.id === state.profile)?.saved ?? state.saved; }

function render() {
  const [route, query = ""] = (location.hash.slice(1) || "browse").split(/\/(.*)/s);
  if (route === "content") return;
  closePlayer();
  if (route === "title") {
    if (!titleOverlay) {
      titleBase = lastRoute;
      titleOpener = document.activeElement;
      titleOverlay = element("dialog", "", "title-overlay");
      titleOverlay.setAttribute("aria-label", "Title details");
      document.body.append(titleOverlay);
      if (!lastRoute) {
        const background = element("div");
        main.replaceChildren(background);
        void browse(background);
      }
      titleOverlay.showModal();
    }
    const close = () => {
      if (titleBase) history.back();
      else location.hash = "browse";
    };
    titleOverlay.oncancel = (event) => { event.preventDefault(); close(); };
    const x = action("×", close, "overlay-close");
    x.setAttribute("aria-label", "Close title details");
    const detail = element("div");
    titleOverlay.replaceChildren(x, detail);
    titleOverlay.scrollTop = 0;
    void titlePage(detail, new URLSearchParams(query));
    return;
  }
  if (titleOverlay) {
    titleOverlay.close();
    titleOverlay.remove();
    titleOverlay = null;
    if ((location.hash || "#browse") === titleBase) {
      if (titleBase === "#browse") {
        const feature = main.querySelector(".feature-rail");
        if (feature) {
          main.querySelector(".resume-rail")?.remove();
          const resume = resumeRail();
          if (resume) feature.after(resume);
        }
      }
      titleOpener?.focus({ preventScroll: true });
      return;
    }
  }
  lastRoute = location.hash || "#browse";
  const token = ++revision;
  const root = element("div");
  main.replaceChildren(root);
  for (const anchor of document.querySelectorAll("nav a")) {
    if (anchor.hash === "#" + (route === "title" ? "browse" : route)) anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  }
  if (route === "providers") void providersPage(root);
  else if (route === "settings") settings(root);
  else if (route === "search") void search(root, new URLSearchParams(query).get("q") ?? "");
  else if (route === "watchlist") profilePage(root);
  else void browse(root);
  if (token > 1) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
}

function openSearch() {
  if (!dialog.open) dialog.showModal();
  searchInput.focus();
}
document.querySelector("#search-open").onclick = openSearch;
document.querySelector("#search-close").onclick = () => dialog.close();
document.querySelector("#search-form").onsubmit = (event) => {
  event.preventDefault();
  dialog.close();
  location.hash = "search/" + new URLSearchParams({ q: searchInput.value.trim() });
};
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
});
window.addEventListener("hashchange", render);
render();
