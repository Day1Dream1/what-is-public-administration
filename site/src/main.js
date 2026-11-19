import "./style.css";
import { SITE } from "./config.js";
import { loadData, esc } from "./data.js";
import { ICON } from "./icons.js";
import { parseHash } from "./router.js";
import * as home from "./pages/home.js";
import * as explore from "./pages/explore.js";
import * as trends from "./pages/trends.js";
import * as findings from "./pages/findings.js";
import * as methods from "./pages/methods.js";

const ROUTES = {
  "": { page: home, label: "Home", icon: "home", title: "" },
  explore: { page: explore, label: "Explore", icon: "map", title: "Explore" },
  trends: { page: trends, label: "Trends", icon: "trend", title: "Trends" },
  findings: { page: findings, label: "Findings", icon: "book", title: "Findings" },
  methods: { page: methods, label: "Data & Methods", short: "Methods", icon: "info", title: "Data & Methods" },
};
const GROUPS = [["Read", ["", "findings"]], ["Explore", ["explore", "trends"]], ["About", ["methods"]]];


const app = document.getElementById("app");
app.innerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <aside class="sidebar" aria-label="Site navigation">
    <a class="brand" href="#/"><span class="brand-kicker">What is</span><span class="brand-name">Public Administration?</span></a>
    ${GROUPS.map(([g, keys]) => `<nav class="nav-group" aria-label="${g}"><h3>${g}</h3>${keys.map((k) =>
      `<a class="nav-item" data-route="${k}" href="#/${k}">${ICON[ROUTES[k].icon]}<span>${ROUTES[k].label}</span></a>`).join("")}</nav>`).join("")}
    <div class="sidebar-foot" id="side-foot"></div>
  </aside>
  <nav class="tabbar" aria-label="Site navigation (mobile)">
    ${["", "explore", "trends", "findings", "methods"].map((k) =>
      `<a data-route="${k}" href="#/${k}">${ICON[ROUTES[k].icon]}<span>${ROUTES[k].short || ROUTES[k].label}</span></a>`).join("")}
  </nav>
  <div class="main" id="shell"><div id="banner"></div><main id="main" tabindex="-1"></main></div>`;

let cleanup = null, D = null, current = null;
const main = document.getElementById("main");
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
});

async function render() {
  const { route, params } = parseHash();
  const r = Object.hasOwn(ROUTES, route) ? route : "";
  document.querySelectorAll("[data-route]").forEach((a) => (a.dataset.route === r ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if (current === r && ROUTES[r].page.update) {
    ROUTES[r].page.update(params);
    return;
  }
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
