// Explore › Journal Comparison (reference: whatisstrategy.org/explore/journals)
import * as d3 from "d3";
import { esc, fmt } from "../data.js";

const JCOL = { JPART: "#2563eb", PAR: "#dc2626", PA: "#059669", PMR: "#d97706", GOV: "#7c3aed" };

export function render(root, D) {
  const M = D.topics.macro, J = D.manifest.journals;
  let win = "all";
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 36px">
    <p class="kicker">Explore</p><h1 class="title">Journal Comparison</h1>
    <p class="dek">How the five journals differ in what they publish: profiles, thematic emphasis, and how similar their research portfolios are.</p>
  </div></section>
  <section class="section" style="padding-top:28px"><div class="container">
    <div class="toolbar"><div class="seg" id="win" role="group" aria-label="Years"><button data-v="all" aria-pressed="true">All years</button><button data-v="cmp" aria-pressed="false">${D.manifest.comparison_start}–${D.manifest.window[1]} (all five publishing)</button></div></div>
    <div class="jp-grid" id="profiles"></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">Thematic emphasis</h2><p class="section-sub">Each journal's share of papers in each theme. Click a journal in the legend to show or hide it.</p>
    <div class="radar-wrap"><div id="radar"></div><div class="radar-legend" id="rleg"></div></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">Theme × journal</h2>
    <div class="toolbar"><div class="seg" id="mode" role="group" aria-label="Measure"><button data-v="pct" aria-pressed="true">% within journal</button><button data-v="n" aria-pressed="false">Papers</button><button data-v="norm" aria-pressed="false">Relative to highest journal</button></div></div>
    <div class="scroll-x"><table class="heat" id="heat"></table></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">How similar are the journals?</h2><p class="section-sub">Cosine similarity between the journals' theme-share profiles. 1 means identical portfolios.</p>
    <div class="sim-wrap"><div id="sim"></div><div id="simsum" class="prose"></div></div>
  </div></section>`;
  const $ = (s) => root.querySelector(s);
  const hidden = new Set();
  let mode = "pct";

  function data() {
    const ps = win === "all" ? D.papers : D.papers.filter((p) => p.year >= D.manifest.comparison_start);
    const by = Object.fromEntries(J.map((j) => [j.code, ps.filter((p) => p.journal === j.code)]));
    const share = Object.fromEntries(J.map((j) => [j.code, M.map((t) => by[j.code].filter((p) => p.macro === t.id).length / (by[j.code].length || 1))]));
    return { by, share };
  }
  function draw() {
    const { by, share } = data();
    $("#profiles").innerHTML = J.map((j) => {
      const ps = by[j.code], top = M[d3.maxIndex(share[j.code])];
      return `<article class="jp-card" style="--c:${JCOL[j.code]}"><h3>${esc(j.name)}</h3><p class="kicker-sm">${j.code}</p>
        <dl class="tc-stats"><div><dt>Papers</dt><dd>${fmt(ps.length)}</dd></div><div><dt>Years</dt><dd>${d3.min(ps, (p) => p.year)}–${d3.max(ps, (p) => p.year)}</dd></div>
        <div><dt>Citations / paper</dt><dd>${(d3.mean(ps, (p) => p.cited) || 0).toFixed(1)}</dd></div><div><dt>With abstract</dt><dd>${Math.round((100 * ps.filter((p) => p.hasAbstract).length) / ps.length)}%</dd></div></dl>
        <p class="note">Top theme: <span class="dot" style="background:${top.color}"></span> ${esc(top.label)} (${Math.round(100 * d3.max(share[j.code]))}%)</p></article>`;
    }).join("");
    radar(share); heat(by, share); sim(share);
  }
  function radar(share) {
    const el = $("#radar"), W = Math.min(760, el.clientWidth || 760), H = Math.min(620, W), R = H / 2 - 70, c = W / 2, cy = H / 2;
    const max = d3.max(J, (j) => d3.max(share[j.code]));
    const a = (i) => (i / M.length) * 2 * Math.PI - Math.PI / 2;
    const r = d3.scaleLinear([0, max], [0, R]);
    let s = `<svg width="${W}" height="${H}" role="img" aria-label="Radar chart of theme shares by journal">`;
    for (const k of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${M.map((_, i) => [c + Math.cos(a(i)) * R * k, cy + Math.sin(a(i)) * R * k].join(",")).join(" ")}" fill="none" stroke="#eee"/>`;
    M.forEach((t, i) => {
      const x = c + Math.cos(a(i)) * (R + 10), y = cy + Math.sin(a(i)) * (R + 10);
      s += `<line x1="${c}" y1="${cy}" x2="${c + Math.cos(a(i)) * R}" y2="${cy + Math.sin(a(i)) * R}" stroke="#eee"/>
        <text x="${x}" y="${y}" font-size="10.5" fill="#525252" text-anchor="${Math.cos(a(i)) > 0.2 ? "start" : Math.cos(a(i)) < -0.2 ? "end" : "middle"}" dy="0.35em">${esc(t.label.length > 26 ? t.label.slice(0, 25) + "…" : t.label)}</text>`;
    });
    for (const j of J) if (!hidden.has(j.code)) s += `<polygon class="rp" data-j="${j.code}" points="${share[j.code].map((v, i) => [c + Math.cos(a(i)) * r(v), cy + Math.sin(a(i)) * r(v)].join(",")).join(" ")}" fill="${JCOL[j.code]}" fill-opacity=".08" stroke="${JCOL[j.code]}" stroke-width="2"/>`;
    el.innerHTML = s + "</svg>";
    $("#rleg").innerHTML = J.map((j) => `<button class="chip" data-j="${j.code}" aria-pressed="${!hidden.has(j.code)}"><span class="dot" style="background:${JCOL[j.code]}"></span>${j.code}</button>`).join("");
  }
  function heat(by, share) {
    const vals = (j, i) => (mode === "n" ? by[j].filter((p) => p.macro === M[i].id).length : mode === "pct" ? share[j][i] : share[j][i] / d3.max(J, (k) => share[k.code][i]));
    const all = J.flatMap((j) => M.map((_, i) => vals(j.code, i)));
    const col = d3.scaleSequential([0, d3.max(all)], d3.interpolateRgb("#f8fafc", "#1e3a8a"));
    $("#heat").innerHTML = `<thead><tr><th>Theme</th>${J.map((j) => `<th class="c" title="${esc(j.name)}">${j.code}</th>`).join("")}</tr></thead><tbody>
      ${M.map((t, i) => `<tr><td class="lab"><span class="dot" style="background:${t.color}"></span> ${esc(t.label)}</td>${J.map((j) => {
        const v = vals(j.code, i), dark = v > d3.max(all) * 0.55;
        return `<td style="background:${col(v)};color:${dark ? "#fff" : "inherit"}" title="${j.code} · ${esc(t.label)}">${mode === "n" ? v : mode === "pct" ? Math.round(v * 100) + "%" : v.toFixed(2)}</td>`;
      }).join("")}</tr>`).join("")}</tbody>`;
  }
  function sim(share) {
    const cos = (a, b) => d3.sum(a, (v, i) => v * b[i]) / Math.sqrt(d3.sum(a, (v) => v * v) * d3.sum(b, (v) => v * v));
    const pairs = [];
    const cell = 64;
    let s = `<svg width="${cell * (J.length + 1)}" height="${cell * (J.length + 1)}" role="img" aria-label="Similarity matrix">`;
    J.forEach((a, i) => {
      s += `<text x="${cell * (i + 1) + cell / 2}" y="${cell / 2 + 6}" text-anchor="middle" font-size="12" fill="#525252">${a.code}</text><text x="${cell - 8}" y="${cell * (i + 1) + cell / 2 + 4}" text-anchor="end" font-size="12" fill="#525252">${a.code}</text>`;
      J.forEach((b, k) => {
        const v = cos(share[a.code], share[b.code]);
        if (k > i) pairs.push([a.code, b.code, v]);
        const shade = d3.interpolateRgb("#eff6ff", "#1e3a8a")((v - 0.5) / 0.5);
        s += `<rect x="${cell * (k + 1) + 2}" y="${cell * (i + 1) + 2}" width="${cell - 4}" height="${cell - 4}" rx="6" fill="${shade}"><title>${a.code}–${b.code}: ${v.toFixed(3)}</title></rect>
          <text x="${cell * (k + 1) + cell / 2}" y="${cell * (i + 1) + cell / 2 + 4}" text-anchor="middle" font-size="12" fill="${v > 0.8 ? "#fff" : "#1e3a8a"}">${v.toFixed(2)}</text>`;
      });
    });
    $("#sim").innerHTML = s + "</svg>";
    pairs.sort((a, b) => b[2] - a[2]);
    $("#simsum").innerHTML = `<p><strong>Most similar:</strong> ${pairs[0][0]} and ${pairs[0][1]} (${pairs[0][2].toFixed(2)})</p>
      <p><strong>Most different:</strong> ${pairs.at(-1)[0]} and ${pairs.at(-1)[1]} (${pairs.at(-1)[2].toFixed(2)})</p>
      <p><strong>Average similarity:</strong> ${d3.mean(pairs, (p) => p[2]).toFixed(2)}</p>`;
  }
  root.addEventListener("click", (e) => {
    const w = e.target.closest("#win button"), m = e.target.closest("#mode button"), j = e.target.closest("#rleg [data-j]");
    if (w) { win = w.dataset.v; root.querySelectorAll("#win button").forEach((b) => b.setAttribute("aria-pressed", b === w)); draw(); }
    if (m) { mode = m.dataset.v; root.querySelectorAll("#mode button").forEach((b) => b.setAttribute("aria-pressed", b === m)); draw(); }
    if (j) { const k = j.dataset.j; if (hidden.has(k)) hidden.delete(k); else if (hidden.size < J.length - 1) hidden.add(k); radar(data().share); }
  });
  root.addEventListener("mouseover", (e) => {
    const k = e.target.closest("#rleg [data-j]")?.dataset.j;
    root.querySelectorAll(".rp").forEach((p) => p.setAttribute("fill-opacity", !k || p.dataset.j === k ? ".08" : "0"));
    root.querySelectorAll(".rp").forEach((p) => p.setAttribute("stroke-opacity", !k || p.dataset.j === k ? "1" : ".15"));
  });
  draw();
}
