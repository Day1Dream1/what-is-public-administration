import { SITE } from "../config.js";
import { esc, fmt, pct } from "../data.js";
import { createMap } from "../map.js";

export function render(root, D) {
  const m = D.manifest, n = D.papers.length;
  const years = m.window[1] - m.window[0] + 1;
  const absShare = D.papers.filter((p) => p.hasAbstract).length / n;
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner">
    <p class="kicker">An empirical field map · ${m.window[0]}–${m.window[1]}</p>
    <h1 class="title">What is Public Administration?</h1>
    <p class="dek">An empirical map of ${fmt(n)} papers across ${m.journals.length} public administration journals and ${years} years of scholarship.</p>
    <div class="stats">
      <div class="stat"><b class="num">${fmt(n)}</b><span>papers</span></div>
      <div class="stat"><b class="num">${m.journals.length}</b><span>journals</span></div>
      <div class="stat"><b class="num">${D.topics.macro.length}</b><span>themes</span></div>
      <div class="stat"><b class="num">${years}</b><span>years</span></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:28px">
      <a class="btn" href="#/findings">Read the findings</a>
      <a class="btn btn-ghost" href="#/explore">Explore the map</a>
    </div>
  </div></section>

  <section class="section"><div class="container" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:40px;align-items:center" id="intro-grid">
    <div class="prose">
      <p class="kicker-sm">What this site does</p>
      <p>Which questions has public administration research asked, and how has that changed? The map brings together eligible research articles and scholarly reviews identified in
      ${m.journals.map((j) => `<em>${esc(j.name)}</em>`).join(", ").replace(/, ([^,]*)$/, ", and $1")} on a single map.
      Papers about similar things sit close together.</p>
      <p>The map is built from each paper's title and, where one is available, its abstract (${pct(absShare, 0)} of papers have one).
      Every chart shows how many papers it is based on, so you can judge for yourself how much weight a trend can bear.</p>
    </div>
    <a href="#/explore" aria-label="Open the interactive map" style="display:block;position:relative;height:380px;border:1px solid var(--border);border-radius:16px;overflow:hidden" id="preview"></a>
  </div></section>

  <section class="section"><div class="container">
    <h2 class="section-title">Four ways in</h2>
    <p class="section-sub">Read the findings, or explore the data and check how it was built.</p>
    <div class="cards">
      ${card("#/findings", "Read", "Findings", "How research priorities shifted across five journals, told one step at a time with the evidence beside the text.")}
      ${card("#/explore", "Explore", "The map", "Find papers by journal, year, theme, title, author or DOI, and share a link to any paper.")}
      ${card("#/trends", "Explore", "Trends", "How each theme grew or shrank, and how the five journals compare since 2001.")}
      ${card("#/methods", "About", "Data & Methods", "Which papers are in, how themes were made, coverage by journal and year, and limitations.")}
    </div>
  </div></section>
  <footer class="site">Created by ${SITE.authorUrl ? `<a href="${esc(SITE.authorUrl)}">${esc(SITE.author)}</a>` : esc(SITE.author)}${SITE.affiliation ? `, ${esc(SITE.affiliation)}` : ""} · Data ${esc(m.data_version)} · <a href="#/methods">Data &amp; Methods</a></footer>`;

  const grid = root.querySelector("#intro-grid");
  const mq = matchMedia("(max-width: 900px)");
  const apply = () => (grid.style.gridTemplateColumns = mq.matches ? "1fr" : "minmax(0,1fr) minmax(0,1.1fr)");
  apply(); mq.addEventListener("change", apply);
  const map = createMap(root.querySelector("#preview"), D, { interactive: false, pointRadius: 1.6 });
  return () => { map.destroy(); mq.removeEventListener("change", apply); };
}

const card = (href, kick, title, text) =>
  `<a class="card" href="${href}"><span class="kicker-sm">${kick}</span><h3>${title}</h3><p>${text}</p></a>`;
