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
function heading(root, title) { root.append(element("h1", title)); }
function note(root, message) { root.append(element("p", message)); }
function setup(root) {
  const box = element("section", "", "panel");
  box.append(element("h2", "Browser Bridge"), element("p", "Load Browser Bridge in Brave, Chrome or Edge, then use its toolbar icon to allow provider access once."),
    link("Install browser extension", "./k45movies-bridge.zip", "button primary"), " ",
    link("Installation instructions", "#settings", "button"));
  root.append(box);
}
function busy(root, label = "Loading…") {
  const node = element("p", label);
  node.setAttribute("role", "status");
  root.replaceChildren(node);
}
async function run(root, work) {
  try { await work(); }
  catch (error) { root.replaceChildren(element("p", error instanceof Error ? error.message : "Request failed.", "notice"), action("Retry", () => void run(root, work))); }
}
function select(root, label, items, onChange, current) {
  const caption = element("label", label + " ");
  const input = element("select");
  for (const item of items) {
    const option = element("option", item.label);
    option.value = item.value;
    if (String(item.value) === String(current)) option.selected = true;
    input.append(option);
  }
  input.onchange = () => onChange(input.value);
  caption.append(input);
  root.append(caption);
  return input;
}

function feature(entry, title, cta = "View details") {
  const hero = element("section", "", "hero");
  const art = element("img");
  art.src = asset(entry.image);
  art.alt = "";
  art.fetchPriority = "high";
  const content = element("div");
  content.append(element("span", title, "tag"), element("h2", entry.name), link(cta, titleUrl(entry), "button primary"));
  hero.append(art, content);
  return hero;
}

function detailHeader(entry, subtitle) {
  const hero = element("section", "", "detail-hero");
  const art = element("img");
  art.src = asset(entry.image);
  art.alt = "";
  const content = element("div");
  content.append(element("span", subtitle, "tag"), element("h1", entry.name));
  if (entry.synopsis) content.append(element("p", entry.synopsis));
  content.append(saveButton(entry));
  hero.append(art, content);
  return hero;
}

async function browse(root) {
  heading(root, "Browse");
  const content = element("section");
  root.append(content);
  busy(content);
  await run(content, async () => {
    if (state.layout === "movie") {
      const data = await tmdb("trending/all/week");
      const items = data.results.map((item) => tmdbTitle(item)).filter(Boolean);
      content.replaceChildren(...(items.length ? [feature(items[0], "Trending"), element("h2", "Trending this week"), grid(items)] : [element("p", "No trending titles.")]));
      return;
    }
    if (!state.active) {
      content.replaceChildren(link("Choose a provider", "#providers", "button primary"));
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
        const featured = cards.find((item) => item.image) ?? cards[0];
        results.replaceChildren(...(featured ? [feature(featured, id), element("h2", "Catalog"), grid(cards)] : [element("p", "No titles returned.")]));
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
    const bar = element("div", "", "actions");
    select(bar, "Provider", state.installed.map((id) => ({ label: id, value: id })), (value) => {
      state.active = value; persist(); render();
    }, id);
    select(bar, "Category", categories.map((category) => ({ label: category.title, value: category.filter })), show);
    content.append(bar, shelf);
    await show(categories[0].filter);
  });
}

async function providersPage(root) {
  heading(root, "Providers");
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
    button.textContent = saved ? "Remove from watchlist" : "Add to watchlist";
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
  root.replaceChildren(detailHeader(entry, id));
  if (!detail.groups.length) { note(root, "No source groups returned."); return; }
  const actions = element("div", "", "actions");
  const groupButtons = element("div", "", "actions");
  const output = element("section");
  root.append(element("h2", "Watch"), actions, groupButtons, output);
  let generation = 0;

  async function streams(item) {
    const current = ++generation;
    const results = element("div", "", "actions");
    output.replaceChildren(results);
    busy(results, "Resolving streams…");
    await run(results, async () => {
      const sources = await provider("sources", { id, link: item.link, series: /series|tv/i.test(detail.type ?? item.type ?? "") });
      if (current !== generation) return;
      results.replaceChildren();
      if (!sources.length) note(results, "No compatible sources were returned.");
      if (sources.length) results.append(action("Play", () => openPlayer(detail.title, sources), "primary"));
      for (const [index, source] of sources.entries()) {
        results.append(action([source.server, source.quality].filter(Boolean).join(" · "), () => openPlayer(detail.title, sources, index)));
      }
    });
  }

  async function show(index) {
    ++generation;
    output.replaceChildren();
    const group = detail.groups[Number(index)];
    const list = element("div", "", "actions");
    groupButtons.replaceChildren(list);
    await run(list, async () => {
      const entries = group.episodesLink ? await provider("episodes", { id, link: group.episodesLink }) : group.entries;
      if (!entries.length) { note(list, "No episodes or sources returned."); return; }
      for (const entry of entries) list.append(action(entry.title, () => void streams(entry)));
    });
  }
  select(actions, "Season or quality", detail.groups.map((item, index) => ({ label: item.title, value: index })), show);
  await show(0);
}

function titleMatch(name, candidate) {
  const normal = (value) => value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\b(?:19|20)\d{2}\b/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const wanted = normal(name);
  const found = normal(candidate);
  return wanted && (found === wanted || found.startsWith(wanted + " "));
}

async function titlePage(root, query) {
  const section = element("section", "", "detail");
  root.append(link("← Browse", "#browse", "button"), section);
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
    const options = element("section");
    section.append(options);
    options.append(action("Find provider sources", async () => {
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
  heading(root, "Settings");
  const group = element("fieldset");
  group.append(element("legend", "Choose layout"));
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
  note(root, "Extract the ZIP. Open chrome://extensions or edge://extensions, enable Developer mode, choose Load unpacked, and select the extracted folder. Reload this site.");
}

function render() {
  const [route, query = ""] = (location.hash.slice(1) || "browse").split(/\/(.*)/s);
  if (route === "content") return;
  closePlayer();
  const token = ++revision;
  const root = element("div");
  main.replaceChildren(root);
  for (const anchor of document.querySelectorAll("nav a")) {
    if (anchor.hash === "#" + route) anchor.setAttribute("aria-current", "page");
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
  if (token > 1) main.focus();
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
