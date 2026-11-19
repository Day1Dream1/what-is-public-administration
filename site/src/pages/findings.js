// Scrollytelling page: a sticky chart with step cards scrolling over it (pattern from What is Strategy?).
// Content lives in site/public/content/findings.json so findings can be written without touching code.
import * as d3 from "d3";
import { denominators, esc, fmt } from "../data.js";
import { createMap } from "../map.js";

export function render(root, D) {
  const F = D.findings;
  if (!F) {
    root.innerHTML = `<div class="container section"><h1 class="title">Findings</h1><p class="muted">No findings file (content/findings.json) found.</p></div>`;
    return;
  }
  if (D.manifest.status === "release" && F.status !== "final") {
    root.innerHTML = `<section class="section"><div class="container prose">
      <h1 class="title">Findings</h1>
      <p>The narrative findings are in review. Explore the paper map and the data behind the trends.</p>
      <p><a class="btn" href="#/trends">Explore trends</a> <a class="btn btn-ghost" href="#/methods">Data &amp; Methods</a></p>
    </div></section>`;
    return;
  }
  const fill = (s) => String(s)
    .replace(/\{papers\}/g, fmt(D.papers.length))
    .replace(/\{themes\}/g, D.topics.macro.length)
    .replace(/\{journals\}/g, D.manifest.journals.length)
    .replace(/\{theme:(\d+)\}/g, (_, id) => { const t = D.macroById.get(+id); return t ? `<strong style="color:${t.color}">${esc(t.label)}</strong>` : "?"; });

  let stepNo = 0;
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 48px">
    <p class="kicker">${esc(F.kicker || "Findings")}</p>
    <h1 class="title">${esc(F.title)}</h1>
    <p class="dek">${fill(F.dek || "")}</p>
    ${F.status !== "final" ? `<p class="warn" style="margin-top:20px;max-width:680px">Draft. These findings will be written after the full corpus passes the coverage and sensitivity checks described in Data &amp; Methods.</p>` : ""}
  </div></section>
  ${F.sections.map((s, si) => s.interlude
    ? `<div class="interlude" data-interlude><div class="q"><p>${fill(s.interlude)}</p></div></div>`
    : `<section class="story" data-sec="${si}">
        <div class="story-sticky"><div class="viz-bar"><span class="vt">${esc(s.vizTitle || "")}</span><span class="vy" data-year></span></div>
          <div class="viz"></div><div class="progress-dots">${s.steps.map(() => "<i></i>").join("")}</div></div>
        <div class="steps">${s.steps.map((st, i) => `<div class="step" data-step="${i}"><div class="step-card"><span class="n">${String(++stepNo).padStart(2, "0")}</span>${fill(st.text)}</div></div>`).join("")}</div>
      </section>`).join("")}
  <div class="upnext">
    <p class="kicker-sm">${esc(F.end?.kicker || "You've reached the end")}</p>
    <h2>${esc(F.end?.title || "Explore the data yourself")}</h2>
    <a class="btn" href="#/explore">Open the map →</a>
    <div class="links"><a href="#/trends">Trends</a><span>·</span><a href="#/methods">Data &amp; Methods</a></div>
  </div>`;

  const cleanups = [];
  root.querySelectorAll(".story").forEach((secEl) => {
    const s = F.sections[+secEl.dataset.sec];
    const viz = secEl.querySelector(".viz");
    const yearEl = secEl.querySelector("[data-year]");
    let setStep;
    if (s.view === "trend") {
      viz.innerHTML = `<div class="trend-viz chart"><div style="width:100%;height:100%"></div></div>`;
      const trend = trendView(viz.firstChild.firstChild, D, s, yearEl);
      setStep = trend.setStep;
      cleanups.push(trend.destroy);
    } else {
      const map = createMap(viz, D, { interactive: false, labels: "macro", pointRadius: 2 });
      cleanups.push(() => map.destroy());
      setStep = (show) => {
        const macros = !show.macros || show.macros === "all" ? null : new Set(show.macros);
        map.setStory({ macros, yearMax: show.yearMax ?? null });
        yearEl.textContent = show.yearMax ?? D.manifest.window[1];
      };
    }
    const cards = secEl.querySelectorAll(".step-card"), dots = secEl.querySelectorAll(".progress-dots i");
    const activate = (i) => {
      cards.forEach((c, k) => c.classList.toggle("active", k === i));
      dots.forEach((d, k) => d.classList.toggle("on", k === i));
      setStep(s.steps[i].show || {});
    };
    activate(0);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) activate(+e.target.dataset.step);
    }, { rootMargin: "-45% 0px -45% 0px" });
    secEl.querySelectorAll(".step").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());
  });

  // interludes fade in and out with scroll progress
  const inter = [...root.querySelectorAll("[data-interlude]")];
  const onScroll = () => {
    for (const el of inter) {
      const r = el.getBoundingClientRect();
      const prog = -r.top / Math.max(1, r.height - innerHeight);
      const o = prog < 0 ? Math.max(0, 1 + prog * 3) : prog > 1 ? Math.max(0, 1 - (prog - 1) * 3) : 1;
      el.querySelector("p").style.opacity = o.toFixed(2);
    }
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  cleanups.push(() => removeEventListener("scroll", onScroll));
  return () => cleanups.forEach((f) => f());
}

// Line chart of theme shares; steps choose which themes are emphasised.
function trendView(el, D, sec, yearEl) {
  let [y0, y1] = D.manifest.window;
  if (Array.isArray(sec.window) && sec.window.length === 2 && sec.window.every(Number.isInteger)) {
    const start = Math.max(y0, sec.window[0]);
    const end = Math.min(y1, sec.window[1]);
    if (start <= end) [y0, y1] = [start, end];
  }
  const years = d3.range(y0, y1 + 1);
  const { den } = denominators(D, D.jcodes, y0, y1);
  const cnt = d3.rollup(D.papers, (v) => v.length, (p) => p.macro, (p) => p.year);
  const series = D.topics.macro.map((t) => {
    const per = cnt.get(t.id) || new Map();
    const v = years.map((y, i) => {
      const w = years.slice(Math.max(0, i - 1), i + 2);
      const d = d3.sum(w, (yy) => den.get(yy) || 0);
      return d ? d3.sum(w, (yy) => per.get(yy) || 0) / d : null;
    });
    return { t, v };
  });
  let current = null;
  function draw() {
    const W = el.clientWidth || 800, H = Math.max(260, el.clientHeight || 500);
    const endLabels = W >= 520;
    const mg = { t: 16, r: endLabels ? 150 : 14, b: 30, l: 44 };
    const x = d3.scaleLinear([y0, y1], [mg.l, W - mg.r]);
    const y = d3.scaleLinear([0, d3.max(series, (s) => d3.max(s.v)) || 1], [H - mg.b, mg.t]).nice();
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).attr("role", "img")
      .attr("aria-label", `Share of mapped papers per theme, ${y0}–${y1}`);
    svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")).tickSize(-(W - mg.l - mg.r)))
      .call((g) => g.select(".domain").remove()).call((g) => g.selectAll("line").attr("stroke", "#f0f0f0"));
    svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(endLabels ? 8 : 4).tickFormat(d3.format("d")).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", "#e5e5e5")).selectAll("text").attr("dy", "1.2em");
    const line = d3.line().defined((d) => d != null).x((d, i) => x(years[i])).y((d) => y(d)).curve(d3.curveMonotoneX);
    const on = current?.macros && current.macros !== "all" ? new Set(current.macros) : null;
    const g = svg.append("g");
    for (const s of [...series].sort((a, b) => (on?.has(a.t.id) ?? true) - (on?.has(b.t.id) ?? true))) {
      const hi = !on || on.has(s.t.id);
      g.append("path").attr("d", line(s.v)).attr("fill", "none").attr("stroke", hi ? s.t.color : "#d4d4d4")
        .attr("stroke-width", hi && on ? 2.6 : 1.4).attr("opacity", hi ? 1 : 0.6).style("transition", "all .4s");
      if (hi && on && endLabels) {
        const li = s.v.findLastIndex((d) => d != null);
        if (li >= 0) g.append("text").attr("x", x(years[li]) + 6).attr("y", y(s.v[li])).attr("dy", "0.35em")
          .style("fill", s.t.color).style("font-size", "12px").style("font-weight", 600).text(s.t.label.length > 22 ? s.t.label.slice(0, 21) + "…" : s.t.label);
      }
    }
    el.replaceChildren(svg.node());
  }
  const observer = new ResizeObserver(draw);
  observer.observe(el);
  yearEl.textContent = `${y0}–${y1}`;
  return {
    setStep(show) { current = show; draw(); },
    destroy() { observer.disconnect(); },
  };
}
