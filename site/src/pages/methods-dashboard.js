// Explore › Methods Dashboard (reference: whatisstrategy.org/explore/methods)
import * as d3 from "d3";
import { esc, fmt } from "../data.js";
import { heatmap, stacked } from "../story/charts.js";
import { evMany } from "../story/evidence.js";
import { METHOD_COLORS } from "../story/ch4.js";

export async function render(root, D) {
  const { ch4_methods: M, ch4_heatmap: H, paper_codes: codes } = await evMany(["ch4_methods", "ch4_heatmap", "paper_codes"]);
  const Y = M.years, Y1 = Y.at(-1);
  const keys = codes.methods.map((m) => m.key);
  const uses = (i, b) => codes.c[i] && (codes.m[i] >> b) & 1;
  const recent = d3.mean(M.any_causal.slice(-5));
  const top = [...M.methods].sort((a, b) => b.total - a.total)[0];
  let sel = top.key;
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 30px">
    <p class="kicker">Explore</p><h1 class="title">Methods Dashboard</h1>
    <p class="dek">Causal identification methods named in public administration abstracts, ${Y[0]}–${Y1}. Coded with keyword rules from titles and abstracts; papers without an abstract are not coded.</p>
    <div class="stats">
      <div class="stat"><b class="num">${fmt(M.n_coded)}</b><span>abstracts coded</span></div>
      <div class="stat"><b class="num">${fmt(M.n_causal)}</b><span>name ≥1 causal method</span></div>
      <div class="stat"><b class="num">${recent.toFixed(1)}%</b><span>of abstracts, ${Y1 - 4}–${Y1}</span></div>
      <div class="stat"><b class="num">${esc(top.label)}</b><span>most common</span></div>
    </div>
  </div></section>
  <section class="section" style="padding-top:28px"><div class="container">
    <h2 class="section-title">Adoption over time</h2><p class="section-sub">Share of coded abstracts naming each method. Bands overlap: one paper can use several methods.</p>
    <div class="dash-chart" id="area"></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">By theme and period</h2><p class="section-sub">Share of papers in each theme naming at least one causal method. Cells with fewer than five coded papers are greyed out.</p>
    <div class="dash-chart tall" id="heat"></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">Method detail</h2>
    <div class="method-picks" id="picks">${M.methods.map((m) => `<button class="chip" data-k="${m.key}"><span class="dot" style="background:${METHOD_COLORS[m.key]}"></span>${esc(m.label)}</button>`).join("")}</div>
    <div class="method-detail" id="detail"></div>
  </div></section>`;
  const $ = (s) => root.querySelector(s);
  const stub = () => ({ extra: document.createElement("div"), setValue() {} });
  const area = stacked($("#area"), stub(), { years: Y, curve: d3.curveLinear, outline: true,
    series: [...M.methods].sort((a, b) => b.total - a.total).map((s) => ({ key: s.key, label: s.label, color: METHOD_COLORS[s.key], values: s.share })) });
  area.set({}, 0);
  const hm = heatmap($("#heat"), stub(), H);
  hm.set({}, 0);

  function detail() {
    const m = M.methods.find((x) => x.key === sel), b = keys.indexOf(sel), col = METHOD_COLORS[sel];
    root.querySelectorAll("#picks .chip").forEach((c) => c.setAttribute("aria-pressed", c.dataset.k === sel));
    const idx = D.papers.map((p, i) => i).filter((i) => uses(i, b));
    const first = d3.min(idx, (i) => D.papers[i].year);
    const byJ = D.jcodes.map((j) => { const coded = D.papers.filter((p, i) => p.journal === j && codes.c[i]).length; const k = idx.filter((i) => D.papers[i].journal === j).length; return [j, k, coded ? k / coded : 0]; });
    const ex = idx.map((i) => D.papers[i]).sort((a, c) => c.cited - a.cited).slice(0, 5);
    $("#detail").innerHTML = `
      <div class="stats" style="margin-top:6px"><div class="stat"><b class="num" style="color:${col}">${fmt(m.total)}</b><span>papers</span></div>
        <div class="stat"><b class="num">${first ?? "–"}</b><span>first appearance</span></div>
        <div class="stat"><b class="num">${(d3.mean(m.share.slice(-5)) || 0).toFixed(1)}%</b><span>of abstracts, ${Y1 - 4}–${Y1}</span></div></div>
      <div class="md-grid"><div><p class="kicker-sm">By journal (share of coded abstracts)</p>
        ${byJ.map(([j, k, s]) => `<div class="bar-row"><span>${j}</span><div><i style="width:${Math.min(100, (s / (d3.max(byJ, (d) => d[2]) || 1)) * 100)}%;background:${col}"></i></div><b>${(100 * s).toFixed(1)}% <span class="muted">(${k})</span></b></div>`).join("")}</div>
        <div><p class="kicker-sm">Per year</p><div id="trend" style="height:180px"></div></div></div>
      <p class="kicker-sm" style="margin-top:22px">Most cited papers using this method</p>
      <ol class="tc-top">${ex.map((p) => `<li><a href="#/explore?paper=${p.id}">${esc(p.title)}</a><span>${p.journal} ${p.year} · ${fmt(p.cited)} citations</span></li>`).join("") || "<li>None</li>"}</ol>`;
    const el = $("#trend"), W = el.clientWidth, Hh = 180, mg = { t: 10, r: 10, b: 22, l: 36 };
    const x = d3.scaleLinear([Y[0], Y1], [mg.l, W - mg.r]), y = d3.scaleLinear([0, d3.max(m.share) || 1], [Hh - mg.b, mg.t]).nice();
    const ar = d3.area().defined((d) => d != null).x((d, i) => x(Y[i])).y0(Hh - mg.b).y1((d) => y(d));
    el.innerHTML = `<svg width="${W}" height="${Hh}"><path d="${ar(m.share)}" fill="${col}" opacity=".18"/><path d="${ar.lineY1()(m.share)}" fill="none" stroke="${col}" stroke-width="1.6"/>
      ${y.ticks(3).map((t) => `<text x="${mg.l - 6}" y="${y(t)}" dy="0.35em" text-anchor="end" font-size="10" fill="#9ca3af">${t}%</text><line x1="${mg.l}" x2="${W - mg.r}" y1="${y(t)}" y2="${y(t)}" stroke="#f1f1f1"/>`).join("")}
      ${[Y[0], 2000, Y1].map((t) => `<text x="${x(t)}" y="${Hh - 6}" text-anchor="middle" font-size="10" fill="#9ca3af">${t}</text>`).join("")}</svg>`;
  }
  $("#picks").addEventListener("click", (e) => { const c = e.target.closest("[data-k]"); if (c) { sel = c.dataset.k; detail(); } });
  detail();
  return () => { area.destroy(); hm.destroy(); };
}
