export function seedHome({ mode, origin }) {
  if (window.top !== window || location.origin !== origin) return;
  if (!localStorage.getItem("k45-web-appearance")) {
    localStorage.setItem("k45-web-appearance", JSON.stringify({ version: 0, state: { layout: mode } }));
  }
  if (!localStorage.getItem("k45-web-library")) {
    localStorage.setItem("k45-web-library", JSON.stringify({ version: 0, state: {
      installed: ["vega"], activeProvider: "vega", providersInitialized: true,
    } }));
  }
}

export function homeResponse(fixture, url) {
  const p = url.searchParams;
  const id = p.get("id");
  if (url.pathname === "/api/proxy/tmdb") {
    if (p.get("op") === "row") return fixture[p.get("type")] ?? fixture.movie;
    return;
  }
  switch (p.get("op")) {
    case "manifest": return fixture.manifest;
    case "health": return {};
    case "catalog": return fixture[id];
    case "posts": return fixture.rows[id]?.[p.get("filter")];
  }
}
