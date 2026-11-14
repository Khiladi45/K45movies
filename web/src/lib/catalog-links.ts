import type { Title } from "./catalog-types";

export function providerLink(id: string, ref: string) {
  return "/provider/" + encodeURIComponent(id) + "/title/" + encodeURIComponent(ref);
}

export function categoryLink(id: string, filter: string) {
  return "/provider/" + encodeURIComponent(id) + "/category?" + new URLSearchParams({ filter });
}

export function titleLink(title: Title) {
  return "/title/" + title.mediaType + "/" + title.id;
}
