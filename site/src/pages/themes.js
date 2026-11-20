// Explore › Theme Browser (reference: whatisstrategy.org/explore/themes)
import * as d3 from "d3";
import { esc, fmt } from "../data.js";

export function render(root, D) {
  const Y0 = d3.min(D.papers, (p) => p.year), Y1 = d3.max(D.papers, (p) => p.year);
  const recentShare = D.papers.filter((p) => p.year >= 2020).length / D.papers.length;
  const stats = D.topics.macro.map((t) => {
    const ps = D.papers.filter((p) => p.macro === t.id);
    const cites = d3.sum(ps, (p) => p.cited);
    const rec = ps.filter((p) => p.year >= 2020).length / ps.length;
    const ratio = rec / recentShare;
    return {
      t, ps, n: ps.length, cites, avg: cites / ps.length, ratio,
      trend: ratio > 1.25 ? ["Growing", "#059669"] : ratio < 0.75 ? ["Declining", "#dc2626"] : ["Stable", "#737373"],
      span: d3.extent(ps, (p) => p.year), subs: D.topics.sub.filter((s) => s.macro === t.id),
      top: [...ps].sort((a, b) => b.cited - a.cited).slice(0, 3),
      since2015: ps.filter((p) => p.year >= 2015).length, before2000: ps.filter((p) => p.year < 2000).length,
    };
  });
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 36px">
    <p class="kicker">Explore</p><h1 class="title">Theme Browser</h1>
    <p class="dek">The ${D.topics.macro.length} research themes of public administration, ${Y0}–${Y1}: their size, citations, trajectory and most-cited papers. Pick two to compare them side by side.</p>
  </div></section>
  <section class="section" style="padding-top:28px"><div class="container">
    <div class="toolbar"><label class="field-label" for="sort">Sort by</label>
      <select id="sort"><option value="n">Papers</option><option value="cites">Total citations</option><option value="avg">Citations per paper</option><option value="ratio">Recent growth</option></select>
      <span class="note">Trend compares each theme's share of papers since 2020 with its overall share (growing &gt; 1.25×, declining &lt; 0.75×).</span></div>
    <div class="theme-grid" id="grid"></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">Compare two themes</h2>
    <div class="toolbar"><select id="a"></select><span class="muted">vs</span><select id="b"></select></div>
    <div class="scroll-x"><table class="kv compare" id="cmp"></table></div>
  </div></section>`;
  const $ = (s) => root.querySelector(s);
  function grid() {
    const k = $("#sort").value;
    $("#grid").innerHTML = [...stats].sort((a, b) => b[k] - a[k]).map((s) => `
      <article class="theme-card" style="--c:${s.t.color}">
        <div class="tc-bar"></div>
        <div class="tc-head"><h3>${esc(s.t.label)}</h3><span class="tc-trend" style="color:${s.trend[1]}">${s.trend[0]}</span></div>
        ${s.t.description ? `<p class="tc-desc">${esc(s.t.description)}</p>` : ""}
        <dl class="tc-stats"><div><dt>Papers</dt><dd>${fmt(s.n)}</dd></div><div><dt>Citations</dt><dd>${fmt(s.cites)}</dd></div>
          <div><dt>Per paper</dt><dd>${s.avg.toFixed(1)}</dd></div><div><dt>Years</dt><dd>${s.span.join("–")}</dd></div></dl>
        <p class="kicker-sm">Subtopics</p><div class="tc-subs">${s.subs.map((x) => `<span>${esc(x.label)}</span>`).join("")}</div>
        <p class="kicker-sm" style="margin-top:12px">Most cited</p>
        <ol class="tc-top">${s.top.map((p) => `<li><a href="#/explore?paper=${p.id}">${esc(p.title)}</a><span>${p.journal} ${p.year} · ${fmt(p.cited)} citations</span></li>`).join("")}</ol>
      </article>`).join("");
  }
  const opts = stats.map((s) => `<option value="${s.t.id}">${esc(s.t.label)}</option>`).join("");
  $("#a").innerHTML = opts; $("#b").innerHTML = opts;
  $("#a").value = stats[0].t.id; $("#b").value = stats[1].t.id;
  function compare() {
    const A = stats.find((s) => s.t.id === +$("#a").value), B = stats.find((s) => s.t.id === +$("#b").value);
    [...$("#a").options].forEach((o) => (o.disabled = +o.value === B.t.id));
    [...$("#b").options].forEach((o) => (o.disabled = +o.value === A.t.id));
    const rows = [["Papers", "n", fmt], ["Total citations", "cites", fmt], ["Citations per paper", "avg", (v) => v.toFixed(1)],
      ["Subtopics", (s) => s.subs.length, String], ["Papers since 2015", "since2015", fmt], ["Papers before 2000", "before2000", fmt]];
    const val = (s, k) => (typeof k === "function" ? k(s) : s[k]);
    $("#cmp").innerHTML = `<thead><tr><th></th><th style="color:${A.t.color}">${esc(A.t.label)}</th><th style="color:${B.t.color}">${esc(B.t.label)}</th></tr></thead><tbody>
      ${rows.map(([l, k, f]) => { const a = val(A, k), b = val(B, k); return `<tr><th>${l}</th><td class="${a > b ? "win" : ""}">${f(a)}</td><td class="${b > a ? "win" : ""}">${f(b)}</td></tr>`; }).join("")}
      <tr><th>Most cited paper</th><td><a href="#/explore?paper=${A.top[0].id}">${esc(A.top[0].title)}</a></td><td><a href="#/explore?paper=${B.top[0].id}">${esc(B.top[0].title)}</a></td></tr></tbody>`;
  }
  $("#sort").addEventListener("change", grid);
  $("#a").addEventListener("change", compare); $("#b").addEventListener("change", compare);
  grid(); compare();
}
