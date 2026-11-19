import "./style.css";
import { SITE } from "./config.js";
import { loadData, esc } from "./data.js";
import { ICON } from "./icons.js";
import { parseHash } from "./router.js";
import { CHAPTERS, LEGACY_CHAPTER_ROUTES, chapterHref, chapterRoute, renderChapterIndex } from "./chapters.js";
import { renderChapter } from "./story/engine.js";
import * as home from "./pages/home.js";
import * as explore from "./pages/explore.js";
import * as trends from "./pages/trends.js";
import * as about from "./pages/methods.js";

const lazy = (load) => ({ render: async (root, D, params) => (await load()).render(root, D, params) });
const EXPLORE = [
  ["explore", "Semantic Map", "map", { ...explore }],
  ["explore/themes", "Theme Browser", "layers", lazy(() => import("./pages/themes.js"))],
  ["explore/topics", "Topic Lifecycles", "trend", lazy(() => import("./pages/topics.js"))],
  ["explore/journals", "Journal Comparison", "journal", lazy(() => import("./pages/journals.js"))],
  ["explore/citations", "Citation Flows", "branch", lazy(() => import("./pages/citations.js"))],
  ["explore/methods", "Methods Dashboard", "flask", lazy(() => import("./pages/methods-dashboard.js"))],
  ["about", "About", "info", about],
];
const ROUTES = {
  "": { page: home, title: "" },
  chapters: { page: { render: renderChapterIndex }, title: "Chapters" },
  "explore/trends": { page: trends, title: "Theme trends" },
  ...Object.fromEntries(EXPLORE.map(([k, label, , page]) => [k, { page, title: label }])),
  ...Object.fromEntries(CHAPTERS.map((c, i) => [chapterRoute(c.id), { page: { render: (root, D) => renderChapter(root, D, i) }, title: c.nav }])),
};

const app = document.getElementById("app");
app.innerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <aside class="sidebar" aria-label="Site navigation">
    <a class="brand" href="#/"><span class="brand-kicker">What is</span><span class="brand-name">Public Administration?</span></a>
    <nav class="nav-group" aria-label="Chapters">
      <h3><a class="nav-chapter-index" data-route="chapters" href="#/chapters">Chapters</a></h3>
      ${CHAPTERS.map((c, i) => `<a class="nav-item nav-chapter" data-route="${chapterRoute(c.id)}" href="${chapterHref(c.id)}"><span class="chapter-number" aria-hidden="true">${i + 1}</span><span>${c.nav}</span></a>`).join("")}
    </nav>
    <nav class="nav-group" aria-label="Explore"><h3>Explore</h3>
      ${EXPLORE.map(([k, label, icon]) => `<a class="nav-item" data-route="${k}" href="#/${k}">${ICON[icon]}<span>${label}</span></a>`).join("")}
    </nav>
    <div class="sidebar-foot" id="side-foot"></div>
  </aside>
  <nav class="tabbar" aria-label="Site navigation (mobile)">
    ${[["", "Home", "home"], ["chapters", "Chapters", "book"], ["explore", "Explore", "map"], ["about", "About", "info"]].map(([k, l, ic]) =>
      `<a data-tab-route="${k}" href="#/${k}">${ICON[ic]}<span>${l}</span></a>`).join("")}
  </nav>
  <div class="main" id="shell"><div id="banner"></div><main id="main" tabindex="-1"></main></div>`;

let cleanup = null, D = null, current = null;
const main = document.getElementById("main");
document.querySelector(".skip-link").addEventListener("click", (event) => { event.preventDefault(); main.focus(); });

async function render() {
  const { route, params } = parseHash();
  if (Object.hasOwn(LEGACY_CHAPTER_ROUTES, route)) {
    history.replaceState(null, "", `#/${LEGACY_CHAPTER_ROUTES[route]}${params.toString() ? "?" + params : ""}`);
    return render();
  }
  const r = Object.hasOwn(ROUTES, route) ? route : "";
  const tab = r.startsWith("chapters") ? "chapters" : r.startsWith("explore") ? "explore" : r;
  document.querySelectorAll("[data-route], [data-tab-route]").forEach((a) => {
    const isCurrent = a.dataset.route === r || a.dataset.tabRoute === tab;
    if (isCurrent) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (current === r && ROUTES[r].page.update) { ROUTES[r].page.update(params); return; }
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  main.innerHTML = "";
  current = r;
  document.title = ROUTES[r].title ? `${ROUTES[r].title} · ${SITE.title}` : SITE.title;
  try {
    D = D || await loadData();
    cleanup = await ROUTES[r].page.render(main, D, params) || null;
    if (!params.toString()) window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="container section"><h1 class="title">Something went wrong</h1><p class="muted">${esc(e.message)}</p></div>`;
  }
}

async function boot() {
  try {
    D = await loadData();
    if (D.isDemo) {
      document.getElementById("banner").innerHTML = `<div class="demo-banner" role="note"><strong>Demo data.</strong> Every record on this site is synthetic and exists only to test the website. Nothing here is a real paper or finding.</div>`;
      document.body.classList.add("has-banner");
    } else if (D.manifest.status === "pilot") {
      document.getElementById("banner").innerHTML = `<div class="demo-banner" role="note"><strong>Pilot data (${esc(D.manifest.data_version)}).</strong> Topic labels and figures are provisional.</div>`;
      document.body.classList.add("has-banner");
    }
    document.getElementById("side-foot").innerHTML = `Data ${esc(D.manifest.data_version)} · ${esc(D.manifest.generated_at)}`;
  } catch (e) { /* render() shows the error */ }
  window.addEventListener("hashchange", render);
  render();
}
boot();
