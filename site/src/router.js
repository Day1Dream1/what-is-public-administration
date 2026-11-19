// Hash routing keeps every view (and every single-paper link) working on static hosts
// such as GitHub Pages, where a refresh on a deep path would otherwise 404.
export function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { route: path || "", params: new URLSearchParams(qs || "") };
}

export function setParams(params) {
  const { route } = parseHash();
  const qs = params.toString();
  history.replaceState(null, "", `#/${route}${qs ? "?" + qs : ""}`);
}

export function paperLink(id) {
  return `${location.origin}${location.pathname}#/explore?paper=${encodeURIComponent(id)}`;
}
