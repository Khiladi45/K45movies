const media = "https://media.w3.org/2010/05/";
const titles = [
  {
    id: "sintel", name: "Sintel", year: "2010", genre: "Fantasy", provider: "Blender Open Movies",
    description: "A young traveler crosses a dangerous world in search of her dragon companion.",
    image: media + "sintel/poster.png", video: media + "sintel/trailer.mp4",
    credit: "Blender Foundation · Creative Commons Attribution 3.0", source: "https://durian.blender.org/about/",
  },
  {
    id: "big-buck-bunny", name: "Big Buck Bunny", year: "2008", genre: "Animation", provider: "Blender Open Movies",
    description: "A gentle rabbit stands up to a trio of forest bullies.",
    image: media + "bunny/poster.png", video: media + "bunny/trailer.mp4",
    credit: "Blender Foundation · Creative Commons Attribution 3.0", source: "https://peach.blender.org/about/",
  },
  {
    id: "flowers", name: "Flowers", year: "Sample clip", genre: "Nature", provider: "MDN Samples",
    description: "A short nature clip for trying the video controls.",
    image: "https://media.w3.org/2010/05/video/poster.png",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    credit: "MDN media example · CC0", source: "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video",
  },
];

const main = document.querySelector("main");
const template = document.querySelector("#card");
const dialog = document.querySelector("#search-dialog");
const searchInput = document.querySelector("#query");
const nav = Array.from(document.querySelectorAll("nav a"));
const storageKey = "k45-pages-demo";
const defaults = { layout: "provider", saved: [], provider: "all" };
const state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return {
      layout: saved?.layout === "movie" ? "movie" : "provider",
      provider: typeof saved?.provider === "string" ? saved.provider : "all",
      saved: Array.isArray(saved?.saved) ? saved.saved.filter((id) => titles.some((title) => title.id === id)) : [],
    };
  } catch {
    return { ...defaults };
  }
}

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { /* The demo remains usable for the current page. */ }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(label, href, className) {
  const node = element("a", label, className);
  node.href = href;
  return node;
}

function button(label, className) {
  const node = element("button", label, className);
  node.type = "button";
  return node;
}

function titleUrl(title) {
  return "#title/" + title.id;
}

function grid(items) {
  const list = element("ul", "", "cards");
  for (const title of items) {
    const card = template.content.cloneNode(true);
    card.querySelector("a").href = titleUrl(title);
    card.querySelector("img").src = title.image;
    card.querySelector("strong").textContent = title.name;
    card.querySelector("small").textContent = title.genre + " · " + title.year;
    list.append(card);
  }
  return list;
}

function browse() {
  const featured = titles[0];
  main.append(element("h1", "Browse"));
  const hero = element("section", "", "hero");
  hero.style.backgroundImage = "linear-gradient(90deg, #141414 0%, #14141430 100%), url(" + featured.image + ")";
  const content = element("div");
  content.append(element("h2", featured.name), element("p", featured.description),
    link("View details", titleUrl(featured), "button primary"));
  hero.append(content);
  main.append(hero);
  if (state.layout === "movie") {
    main.append(element("h2", "Movies by title"), grid([...titles].sort((a, b) => a.name.localeCompare(b.name))));
    return;
  }

  const label = element("label", "Provider ");
  const select = element("select");
  for (const name of ["all", ...new Set(titles.map((title) => title.provider))]) {
    const option = element("option", name === "all" ? "All providers" : name);
    option.value = name;
    select.append(option);
  }
  select.value = state.provider;
  const shelf = element("section");
  function updateShelf() {
    const items = titles.filter(({ provider }) => state.provider === "all" || state.provider === provider);
    shelf.replaceChildren(element("h2", "Sample titles"), grid(items));
  }
  select.addEventListener("change", () => { state.provider = select.value; persist(); updateShelf(); });
  label.append(select);
  main.append(label, shelf);
  updateShelf();
}

function detail(title) {
  const article = element("article", "", "detail");
  const back = link("← Browse", "#browse", "button");
  const returnPath = history.state?.returnPath;
  if (returnPath) {
    back.href = returnPath;
    back.textContent = "← Back";
  }
  const saved = button("", "button");
  function refreshLabel() {
    const active = state.saved.includes(title.id);
    saved.textContent = active ? "Remove from watchlist" : "Add to watchlist";
  }
  refreshLabel();
  saved.addEventListener("click", () => {
    state.saved = state.saved.includes(title.id) ? state.saved.filter((id) => id !== title.id) : [title.id, ...state.saved];
    persist();
    refreshLabel();
  });
  const player = element("video");
  player.controls = true;
  player.playsInline = true;
  player.preload = "none";
  player.poster = title.image;
  player.src = title.video;
  player.setAttribute("aria-label", title.name + " sample video");
  const credit = element("p");
  credit.append(link(title.credit, title.source));
  article.append(back, element("h1", title.name), element("p", title.genre + " · " + title.year),
    element("p", title.description), saved, player, credit);
  main.append(article);
}

function settings() {
  const group = element("fieldset");
  group.append(element("legend", "Choose layout"));
  for (const [value, label] of [["provider", "Provider Based"], ["movie", "Movie Based"]]) {
    const line = element("label");
    const field = element("input");
    field.type = "radio";
    field.name = "layout";
    field.value = value;
    field.checked = state.layout === value;
    field.addEventListener("change", () => { if (field.checked) { state.layout = value; persist(); } });
    line.append(field, " " + label);
    group.append(line);
  }
  main.append(element("h1", "Settings"), group);
}

function render(focus = false) {
  const [route, ...parts] = (location.hash.slice(1) || "browse").split("/");
  main.replaceChildren();
  for (const item of nav) {
    if (item.hash === "#" + route) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  if (route === "title") {
    const title = titles.find(({ id }) => id === parts[0]);
    if (title) detail(title);
    else main.append(element("h1", "Title unavailable"), link("Browse titles", "#browse", "button"));
  } else if (route === "search") {
    const query = new URLSearchParams(parts.join("/")).get("q")?.trim() ?? "";
    const items = titles.filter(({ name, genre }) => (name + " " + genre).toLowerCase().includes(query.toLowerCase()));
    main.append(element("h1", "Search"), element("p", query ? "Results for “" + query + "”" : "All sample titles"),
      items.length ? grid(items) : element("p", "No matching titles."));
  } else if (route === "watchlist") {
    const items = state.saved.map((id) => titles.find((title) => title.id === id));
    main.append(element("h1", "Watchlist"), items.length ? grid(items) : element("p", "Your watchlist is empty."));
  } else if (route === "settings") settings();
  else browse();
  if (focus) main.focus();
}

function openSearch() {
  if (!dialog.open) dialog.showModal();
  searchInput.focus();
}

document.querySelector("#search-open").addEventListener("click", openSearch);
document.querySelector("#search-close").addEventListener("click", () => dialog.close());
document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  dialog.close();
  location.hash = "search/" + new URLSearchParams({ q: query });
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
});
main.addEventListener("click", (event) => {
  const card = event.target.closest('a[href^="#title/"]');
  if (!card || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState({ returnPath: location.hash || "#browse" }, "", card.hash);
  render(true);
});
window.addEventListener("hashchange", () => { if (location.hash !== "#content") render(true); });
render();
