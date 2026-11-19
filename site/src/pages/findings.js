import { esc, fmt, pct } from "../data.js";
import { createMap } from "../map.js";
import { CHAPTERS, chapterHref } from "../chapters.js";
import { SIGNALS, chapterEvidence, chapterFigure } from "../chapter-evidence.js";

function summarise(papers, [start, end]) {
  const counts = new Map();
  let total = 0;
  for (const paper of papers) {
    if (paper.year < start || paper.year > end) continue;
    counts.set(paper.macro, (counts.get(paper.macro) || 0) + 1);
    total++;
  }
  return { start, end, counts, total };
}

const span = ({ start, end }) => `${start}–${end}`;
const shortSpan = ({ start, end }) => `${start}–${String(end).slice(-2)}`;
const signed = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}`;

export function render(root, D, chapterId = "field-map") {
  const chapterIndex = CHAPTERS.findIndex(({ id }) => id === chapterId);
  const isFirst = chapterId === "field-map";
  const source = isFirst ? D.findings : D.chapterContent;
  const F = isFirst ? source : source?.chapters?.find(({ id }) => id === chapterId);
  if (D.manifest.status !== "release" || source?.status !== "final" ||
      source.data_version !== D.manifest.data_version || !F?.steps?.length || (isFirst && !F.periods)) {
    root.innerHTML = `<section class="section"><div class="container prose">
      <h1 class="title">Findings</h1>
      <p>The narrative findings for this data version are in review.</p>
      <p><a class="btn" href="#/trends">Explore trends</a> <a class="btn btn-ghost" href="#/methods">Data &amp; Methods</a></p>
    </div></section>`;
    return;
  }

  const steps = F.steps;
  const early = F.periods && summarise(D.papers, F.periods.early);
  const recent = F.periods && summarise(D.papers, F.periods.recent);
  const periods = { early, recent };
  const topics = new Set(steps.flatMap((step) => step.compare?.macros || []));
  const maxShare = Math.max(0, ...[early, recent].filter(Boolean).flatMap((period) =>
    [...topics].map((id) => (period.counts.get(id) || 0) / period.total)));
  const shareScale = Math.max(0.30, Math.ceil(maxShare * 10) / 10);
  const evidence = isFirst ? null : chapterEvidence(D);
  const scaleSignals = [...new Set(steps.filter((step) => step.figure === "signals").flatMap((step) => step.signals))];
  const nextChapter = CHAPTERS[chapterIndex + 1];
  const priorChapter = CHAPTERS[chapterIndex - 1];
  const needsMap = steps.some((step) => step.figure === "map");

  const paperLink = (id) => {
    const paper = D.byId.get(id);
    return !paper ? "" : `<p class="chapter-source"><a href="#/explore?paper=${encodeURIComponent(paper.id)}">${esc(paper.title)}</a>
      <span>${paper.year} · ${esc(paper.journal)}</span></p>`;
  };
  const stepLink = (link) => link?.href?.startsWith("#/")
    ? `<p class="chapter-source"><a href="${esc(link.href)}">${esc(link.label)}</a></p>` : "";

  root.innerHTML = `
    <header class="scroll-chapter-header">
      <p class="kicker"><a href="#/chapters">Chapters</a> · ${chapterIndex + 1} of ${CHAPTERS.length}</p>
      <h1 class="title">${esc(F.title)}</h1>
      <p class="dek">${esc(F.dek)}</p>
      <button type="button" class="btn btn-ghost" id="story-start">${steps[0].figure === "map" ? "Start with the map" : "Start reading"}</button>
    </header>
    <article class="scroll-story" aria-label="Chapter evidence">
      <div class="scroll-stage">
        <header class="stage-header">
          <h2 id="stage-title"></h2>
          <p id="stage-context"></p>
        </header>
        <div class="stage-figure" aria-labelledby="stage-title">
          <div class="stage-map"></div>
          <div class="stage-overlay" hidden></div>
        </div>
        <nav class="scroll-nav" aria-label="Chapter steps">
          <button type="button" class="scroll-nav-btn" id="nav-prev">Previous</button>
          <span class="scroll-nav-label" id="nav-label"></span>
          <button type="button" class="scroll-nav-btn" id="nav-next">Next</button>
        </nav>
      </div>
      <div class="scroll-article">
        ${steps.map((step, i) => `
          <section class="scroll-step" aria-labelledby="step-heading-${i}" id="step-${esc(step.id)}">
            <div class="scroll-step-inner">
              <h2 class="scroll-heading" id="step-heading-${i}">${esc(step.heading)}</h2>
              <p class="scroll-body">${esc(step.text)}</p>
              ${paperLink(step.paperId)}${stepLink(step.link)}
            </div>
          </section>`).join("")}
      </div>
    </article>
    <section class="scroll-end">
      <p class="kicker-sm">${nextChapter ? `Chapter ${chapterIndex + 2} of ${CHAPTERS.length}` : "Explore the evidence"}</p>
      <h2>${esc(nextChapter?.label || "Follow a topic to the papers behind it")}</h2>
      <div class="scroll-end-links">
        ${priorChapter ? `<a class="btn btn-ghost" href="${chapterHref(priorChapter.id)}">Previous chapter</a>` : ""}
        ${nextChapter ? `<a class="btn" href="${chapterHref(nextChapter.id)}">Continue to Chapter ${chapterIndex + 2}</a>` :
          '<a class="btn" href="#/explore">Explore the papers</a><a class="btn btn-ghost" href="#/methods">Data &amp; Methods</a>'}
      </div>
    </section>`;

  const story = root.querySelector(".scroll-story");
  const stage = story.querySelector(".scroll-stage");
  const mapContainer = stage.querySelector(".stage-map");
  const overlay = stage.querySelector(".stage-overlay");
  const stageTitle = stage.querySelector("#stage-title");
  const stageContext = stage.querySelector("#stage-context");
  const status = stage.querySelector("#nav-label");
  const previous = stage.querySelector("#nav-prev");
  const next = stage.querySelector("#nav-next");
  const sections = Array.from(story.querySelectorAll(".scroll-step"));
  const passages = sections.map((section) => section.querySelector(".scroll-step-inner"));
  const map = needsMap ? createMap(mapContainer, D, { interactive: false, labels: false, pointRadius: 1.6 }) : null;

  function showMap(step) {
    const period = periods[step.filter?.period];
    mapContainer.hidden = false;
    overlay.hidden = true;
    overlay.replaceChildren();
    if (evidence) {
      const filter = step.filter || {};
      const selection = evidence.select(filter);
      map.setStory({ paperIds: new Set(selection.map((p) => p.id)) });
      stageTitle.textContent = filter.journal ? D.journalName[filter.journal] :
        filter.signal ? SIGNALS[filter.signal][0] : "Five journals on one map";
      stageContext.textContent = `${fmt(selection.length)} highlighted papers · ${evidence.start}–${evidence.end}`;
      return;
    }
    map.setStory(period ? { cohortMin: period.start, cohortMax: period.end } : null);
    stageTitle.textContent = period ? `Papers from ${span(period)}` : "The research map";
    stageContext.textContent = period ? `${fmt(period.total)} highlighted papers` :
      `${fmt(D.papers.length)} papers · ${D.topics.macro.length} themes`;
  }

  function barLine(period, id, color) {
    const n = period.counts.get(id) || 0;
    const share = n / period.total;
    return `<div class="bar-track${period === early ? " bar-track--early" : ""}">
      <span class="bar-era">${shortSpan(period)}</span>
      <span class="bar-measure" aria-hidden="true"><span class="bar-fill" style="width:${(share / shareScale * 100).toFixed(2)}%;background:${esc(color)}"></span></span>
      <span class="bar-val"><strong>${pct(share, 1)}</strong> <span>${fmt(n)} / ${fmt(period.total)}</span></span>
    </div>`;
  }

  function showComparison({ compare }) {
    stageTitle.textContent = "Share of papers by theme";
    stageContext.textContent = `Five journals · common scale 0–${pct(shareScale, 0)}`;
    overlay.innerHTML = `<div class="bar-figure">${compare.macros.map((id) => {
      const topic = D.macroById.get(id);
      const color = topic?.color || "#888";
      const delta = ((recent.counts.get(id) || 0) / recent.total - (early.counts.get(id) || 0) / early.total) * 100;
      return `<div class="bar-row${id === compare.focus ? " bar-row--new" : ""}">
        <div class="bar-row-heading">
          <h3 class="bar-label"><span class="story-dot" aria-hidden="true" style="background:${esc(color)}"></span>${esc(topic?.label || "Unknown theme")}</h3>
          <span class="bar-delta ${delta > 0 ? "sens-up" : "sens-down"}">${signed(delta)} pp</span>
        </div>
        ${barLine(early, id, color)}
        ${barLine(recent, id, color)}
      </div>`;
    }).join("")}</div>`;
  }

  function showSensitivity({ sensitivity }) {
    stageTitle.textContent = "Testing the direction of change";
    stageContext.textContent = "Difference in percentage points";
    overlay.innerHTML = `<div class="table-figure">
      <table class="sens-table" aria-label="Percentage-point changes under three checks">
        <thead><tr><th scope="col">Theme</th><th scope="col">Full corpus</th>
          <th scope="col">Titles only</th><th scope="col">With abstract</th></tr></thead>
        <tbody>${sensitivity.rows.map((row) => `
          <tr><th scope="row">${esc(row.label)}</th>
            ${[row.main, row.title_only, row.with_abstract].map((v) =>
              `<td class="${v > 0 ? "sens-up" : "sens-down"}">${signed(v)}</td>`
            ).join("")}
          </tr>`).join("")}</tbody>
      </table>
      <p class="sens-note">The direction of each shift holds across all three checks.</p>
    </div>`;
  }

  let current = -1;
  function activate(index) {
    if (index === current) return;
    const entering = current === -1;
    current = index;
    const step = steps[index];
    sections.forEach((section, i) => {
      section.classList.toggle("scroll-step--active", i === index);
      if (i === index) section.setAttribute("aria-current", "step");
      else section.removeAttribute("aria-current");
    });
    if (step.figure === "map") {
      showMap(step);
    } else {
      mapContainer.hidden = true;
      overlay.hidden = false;
      if (step.figure === "bar") showComparison(step);
      else if (step.figure === "table") showSensitivity(step);
      else {
        const figure = chapterFigure(D, evidence, step, scaleSignals);
        stageTitle.textContent = figure.title;
        stageContext.textContent = figure.context;
        overlay.innerHTML = figure.html;
      }
    }
    status.textContent = `${index + 1} / ${steps.length}`;
    if (!entering && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const changed = step.figure === "map" ? mapContainer : overlay;
      changed.getAnimations().forEach((animation) => animation.cancel());
      changed.animate([{ opacity: 0.58 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    }
    previous.setAttribute("aria-disabled", String(index === 0));
    next.setAttribute("aria-disabled", String(index === steps.length - 1));
  }

  const tabbar = document.querySelector(".tabbar");
  const readingLine = () => {
    const available = innerHeight - (tabbar?.offsetHeight || 0);
    const stacked = stage.offsetWidth >= story.clientWidth - 2;
    return stacked ? (available + Math.min(stage.offsetHeight + 8, available * 0.65)) / 2 : available / 2;
  };
  const midpoint = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.top + rect.height / 2;
  };
  let frame = 0;
  function scheduleUpdate() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const line = readingLine();
      let index = 0;
      let nearest = Infinity;
      passages.forEach((p, i) => {
        const distance = Math.abs(midpoint(p) - line);
        if (distance < nearest) {
          index = i;
          nearest = distance;
        }
      });
      activate(index);
    });
  }

  function scrollToStep(index) {
    if (index < 0 || index >= steps.length) return;
    window.scrollTo({
      top: window.scrollY + midpoint(passages[index]) - readingLine(),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  previous.addEventListener("click", () => scrollToStep(current - 1));
  next.addEventListener("click", () => scrollToStep(current + 1));
  root.querySelector("#story-start").addEventListener("click", () => scrollToStep(0));
  addEventListener("scroll", scheduleUpdate, { passive: true });
  addEventListener("resize", scheduleUpdate);
  activate(0);
  scheduleUpdate();

  return () => {
    removeEventListener("scroll", scheduleUpdate);
    removeEventListener("resize", scheduleUpdate);
    cancelAnimationFrame(frame);
    map?.destroy();
  };
}
