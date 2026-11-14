import { manifest, provider, tmdb, tmdbTitle, tmdbKey, saveTmdbKey } from "./live-api.js";

import { openPlayer, closePlayer } from "./player.js";

const main = document.querySelector("main");
const template = document.querySelector("#card");
const dialog = document.querySelector("#search-dialog");
const searchInput = document.querySelector("#query");
const defaults = { layout: "provider", installed: [], active: "", saved: [], theme: "violet" };
const state = load();
document.documentElement.dataset.theme = state.theme;
let revision = 0;

function load() {
  try {
    const value = JSON.parse(localStorage.getItem("k45-pages-live") ?? "{}");
    return { ...defaults, ...value, installed: Array.isArray(value.installed) ? value.installed.filter((id) => id !== "vega") : [],
      active: value.active === "vega" ? "" : value.active,
      saved: Array.isArray(value.saved) ? value.saved : [] };
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
function grid(items) {
  const list = element("ul", "", "cards");
  for (const title of items) {
    const card = template.content.cloneNode(true);
    card.querySelector("a").href = titleUrl(title);
    card.querySelector("img").src = asset(title.image);
    card.querySelector("strong").textContent = title.name;
    card.querySelector("small").textContent = title.year ?? "";
    list.append(card);
  }
  return list;
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
  catch (error) { root.replaceChildren(element("p", error instanceof Error ? error.message : "Request failed.", "notice"), action("Retry", () => void run(root, work))); }
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
  actions.append(link("▶  Explore title", titleUrl(entry), "button primary"), saveButton(entry));
  content.append(element("p", "In the spotlight", "eyebrow"),
    element("h2", entry.name), element("p", [entry.year, title].filter(Boolean).join("  •  "), "hero-meta"));
  if (entry.synopsis) content.append(element("p", entry.synopsis, "hero-synopsis"));
  content.append(actions);
  hero.append(content);
  return hero;
}

function shelfHeading(title, count) {
  const group = element("div", "", "shelf-heading");
  group.append(element("h2", title), element("small", count + (count === 1 ? " title" : " titles")));
  return group;
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
    img.src = asset(item.image);
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
  if (play) actions.append(action("▶  Play", play, "primary"));
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
      content.replaceChildren(...(items.length ? [featureRail(items, "TMDB Trending"), shelfHeading("Trending this week", items.length), grid(items)] : [element("p", "No trending titles.")]));
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
    const id = state.active;
    const categories = await provider("catalog", { id });
    content.replaceChildren();
    if (!categories.length) { note(content, "This provider has no catalog categories."); return; }
    const shelf = element("section");
    let request = 0;
    async function show(filter) {
      const call = ++request;
      const results = element("div");
      shelf.replaceChildren(results);
      busy(results);
      await run(results, async () => {
        let page = 1;
        const items = await provider("posts", { id, filter, page });
        if (request !== call) return;
        const cards = items.map((item) => post(id, item));
        const featured = cards.filter((item) => item.image);
        results.replaceChildren(...(cards.length ? [featureRail(featured.length ? featured : cards, id), shelfHeading(categories.find((item) => item.filter === filter)?.title ?? "Catalog", cards.length), grid(cards)] : [element("p", "No titles returned.")]));
        if (!items.length) return;
        const more = action("Load more", async () => {
          more.disabled = true;
          try {
            const next = await provider("posts", { id, filter, page: page + 1 });
            if (request !== call) return;
            page++;
            if (!next.length) { more.remove(); return; }
            results.insertBefore(grid(next.map((item) => post(id, item))), more);
          } catch (error) { note(results, error.message); }
          finally { more.disabled = false; }
        });
        results.append(more);
      });
    }
    const bar = element("div", "", "actions catalog-filters");
    bar.append(element("h1", "Discover"));
    select(bar, "Provider", state.installed.map((id) => ({ label: id, value: id })), (value) => {
      state.active = value; persist(); render();
    }, id);
    select(bar, "Category", categories.map((category) => ({ label: category.title, value: category.filter })), show);
    content.append(bar, shelf);
    await show(categories[0].filter);
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
        if (active) row.append(element("span", "Active"));
        else if (supported.includes(item.id)) row.append(action(installed ? "Activate" : "Install", async () => {
          const status = element("p", "Checking provider…");
          row.append(status);
          try {
            await provider("catalog", { id: item.id });
            if (!installed) state.installed.push(item.id);
            state.active = item.id;
            persist();
            draw();
          } catch (error) { status.textContent = error.message; }
        }));
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
    state.saved = state.saved.some((item) => titleUrl(item) === href)
      ? state.saved.filter((item) => titleUrl(item) !== href) : [entry, ...state.saved];
    persist();
    update();
  });
  function update() {
    const saved = state.saved.some((item) => titleUrl(item) === href);
    button.textContent = saved ? "✓  Watchlist" : "+  Watchlist";
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
  let firstPlay, firstOnline;
  const watchButton = groups.length ? () => {
    if (firstPlay && !isSeries) firstPlay.click();
    else watch.querySelector("button")?.focus();
  } : null;
  root.replaceChildren(detailHeader(entry, [isSeries ? "Series" : "Movie", id].join("  •  "), watchButton), watch);
  watch.append(element("p", "Playback", "eyebrow"), element("h2", "Watch"));
  if (!groups.length) { note(watch, "The provider has no playable options for this title."); return; }
  let generation = 0;

  async function streams(item, name, files) {
    const current = ++generation;
    const results = element("div");
    output.replaceChildren(results);
    busy(results, "Connecting to " + name + "…");
    await run(results, async () => {
      let sources;
      try {
        sources = await provider("sources", { id, link: item.link, series: isSeries || /series|tv/i.test(item.type ?? "") });
      } catch (error) {
        if (!files || error.needsAccess) throw error;
        if (current !== generation || !root.isConnected) return;
        results.replaceChildren(element("p", error.message, "notice"));
        if (firstOnline) results.append(action("Play online instead", () => firstOnline.click()));
        return;
      }
      if (current !== generation || !root.isConnected) return;
      results.replaceChildren();
      if (!sources.length) {
        results.append(element("p", name + " did not return a playable file. Try another option.", "notice"));
        if (files && firstOnline) results.append(action("Play online instead", () => firstOnline.click()));
        return;
      }
      closePlayer();
      openPlayer(isSeries ? detail.title + " · " + name : detail.title, sources.map((source) => ({
        ...source, server: source.server.replace(/\bdownload\b/i, "File"),
      })));
    });
  }

  function choices(list, entries, files) {
    list.replaceChildren();
    if (!entries.length) { note(list, "No episodes or sources returned."); return; }
    for (const entry of entries) {
      const name = entry.title.replace(/\bdownload\b/ig, "").trim() || "Source";
      const quality = files && name.match(/\b(?:\d{3,4}p|4k)\b/i)?.[0];
      const player = name.match(/^Player\s*:\s*(\d+)$/i)?.[1];
      const button = action("", () => void streams(entry, name, files), "play-option");
      const icon = element("span", "▶", "play-icon");
      icon.setAttribute("aria-hidden", "true");
      const copy = element("span");
      copy.append(element("strong", player ? "Play online" : "Play " + (quality || name)),
        element("small", player ? "Player " + player : quality ? name.replace(quality, "").trim() || "File source" : files ? "File source" : "Streaming source"));
      button.append(icon, copy);
      list.append(button);
      firstPlay ??= button;
      if (!files) firstOnline ??= button;
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

function titleMatch(name, candidate) {
  const normal = (value) => value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\b(?:19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const wanted = normal(name);
  const found = normal(candidate);
  return wanted && (found === wanted || found.startsWith(wanted + " "));
}

async function titlePage(root, query) {
  const section = element("section", "", "detail");
  root.append(link("←  Browse", "#browse", "button back-link"), section);
  busy(section);
  await run(section, async () => {
    const id = query.get("provider");
    if (id) { await providerDetails(section, id, query.get("link")); return; }
    const type = query.get("type");
    const number = query.get("id");
    if (!["movie", "tv"].includes(type) || !/^\d+$/.test(number ?? "")) throw new Error("Invalid title.");
    const raw = await tmdb(type + "/" + number);
    const entry = tmdbTitle(raw, type);
    section.replaceChildren(detailHeader(entry, [entry.type === "tv" ? "Series" : "Movie", entry.year].filter(Boolean).join(" · ")));
    const options = element("section", "", "watch-panel");
    section.append(options);
    options.append(element("h2", "Watch"), action("Find provider sources", async () => {
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
    }, "primary"));
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

function render() {
  const [route, query = ""] = (location.hash.slice(1) || "browse").split(/\/(.*)/s);
  if (route === "content") return;
  closePlayer();
  const token = ++revision;
  const root = element("div");
  main.replaceChildren(root);
  for (const anchor of document.querySelectorAll("nav a")) {
    if (anchor.hash === "#" + (route === "title" ? "browse" : route)) anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  }
  if (route === "providers") void providersPage(root);
  else if (route === "settings") settings(root);
  else if (route === "title") void titlePage(root, new URLSearchParams(query));
  else if (route === "search") void search(root, new URLSearchParams(query).get("q") ?? "");
  else if (route === "watchlist") {
    heading(root, "Watchlist");
    root.append(state.saved.length ? grid(state.saved) : element("p", "Your watchlist is empty."));
  } else void browse(root);
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
