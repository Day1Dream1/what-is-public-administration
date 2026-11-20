// Explore › Citation Flows (reference: whatisstrategy.org/explore/citations): chord · Sankey · network
import * as d3 from "d3";
import { esc, fmt } from "../data.js";
import { chord } from "../story/charts.js";
import { ev } from "../story/evidence.js";

export async function render(root, D) {
  const C = await ev("ch3_citations");
  let tab = "chord", level = "macro", threshold = 3, viz = null;
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 30px">
    <p class="kicker">Explore</p><h1 class="title">Citation Flows</h1>
    <p class="dek">How research areas cite each other. ${C.status === "ready" ? `${fmt(C.edges)} citation links between papers in the corpus, matched by DOI from Crossref reference lists (${fmt(C.papers_with_refs)} citing papers).` : "Citation data have not been fetched yet."}</p>
  </div></section>
  <section class="section" style="padding-top:20px"><div class="container">
    <div class="toolbar">
      <div class="seg" id="tabs" role="tablist"><button data-v="chord" aria-pressed="true">Chord diagram</button><button data-v="sankey" aria-pressed="false">Sankey (decades)</button><button data-v="network" aria-pressed="false">Network</button></div>
      <div class="seg" id="lvl" role="group" aria-label="Level"><button data-v="macro" aria-pressed="true">Themes</button><button data-v="sub" aria-pressed="false">Subtopics</button></div>
      <label class="field-label" id="thr-wrap" hidden>Minimum links <input type="range" id="thr" min="1" max="20" value="${threshold}"> <b id="thr-v">${threshold}</b></label>
    </div>
    <div class="cite-stage" id="stage"></div>
    <p class="note" id="note"></p>
  </div></section>`;
  const $ = (s) => root.querySelector(s);
  const stub = { extra: document.createElement("div"), setValue() {} };

  function show() {
    viz?.destroy?.(); viz = null;
    const st = $("#stage"); st.innerHTML = "";
    $("#lvl").hidden = tab !== "chord";
    $("#thr-wrap").hidden = tab !== "network";
    root.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === tab));
    root.querySelectorAll("#lvl button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === level));
    if (tab === "chord") {
      st.style.height = level === "macro" ? "680px" : "820px";
      viz = chord(st, stub, C, D, { level });
      viz.set({}, 0);
      $("#note").textContent = "Hover an arc to isolate a theme. Chord width is the number of citations between two areas; loops are citations within an area.";
    } else if (tab === "sankey") { st.style.height = "560px"; sankey(st); $("#note").textContent = "Columns are decades; segment height is the number of papers in each theme; ribbons connect the same theme in adjacent decades (width = the smaller of the two). The 2020s cover 2020–2025."; }
    else { st.style.height = "680px"; network(st); $("#note").textContent = "Nodes are subtopics (size = citations received). Edges link subtopics that cite each other at least the chosen number of times. Click a node to keep its neighbours highlighted."; }
  }

  function sankey(el) {
    const dec = [[1980, 1989, "1980s"], [1990, 1999, "1990s"], [2000, 2009, "2000s"], [2010, 2019, "2010s"], [2020, 2025, "2020s"]];
    const M = D.topics.macro;
    const n = dec.map(([a, b]) => M.map((t) => D.papers.filter((p) => p.macro === t.id && p.year >= a && p.year <= b).length));
    const W = el.clientWidth, H = 520, colW = 16, gap = 4, mg = 40;
    const maxTot = d3.max(n, (r) => d3.sum(r));
    const k = (H - mg * 2 - gap * M.length) / maxTot;
    const x = d3.scalePoint(dec.map((d) => d[2]), [mg + 20, W - 260]);
    const pos = n.map((r) => { let y = mg; return r.map((v) => { const o = { y, h: v * k }; y += v * k + gap; return o; }); });
    let s = `<svg width="${W}" height="${H}">`;
    for (let d = 0; d < dec.length - 1; d++) M.forEach((t, i) => {
      const a = pos[d][i], b = pos[d + 1][i], w = Math.min(n[d][i], n[d + 1][i]) * k;
      const x0 = x(dec[d][2]) + colW, x1 = x(dec[d + 1][2]), mx = (x0 + x1) / 2;
      s += `<path class="sk" data-m="${t.id}" d="M${x0},${a.y}C${mx},${a.y} ${mx},${b.y} ${x1},${b.y}L${x1},${b.y + w}C${mx},${b.y + w} ${mx},${a.y + w} ${x0},${a.y + w}Z" fill="${t.color}" opacity=".25"/>`;
    });
    dec.forEach((dd, d) => {
      s += `<text x="${x(dd[2]) + colW / 2}" y="${mg - 14}" text-anchor="middle" font-size="12" fill="#525252">${dd[2]}</text>`;
      M.forEach((t, i) => { s += `<rect class="sk" data-m="${t.id}" x="${x(dd[2])}" y="${pos[d][i].y}" width="${colW}" height="${Math.max(1, pos[d][i].h)}" fill="${t.color}"><title>${esc(t.label)} · ${dd[2]}: ${n[d][i]} papers</title></rect>`; });
    });
    M.forEach((t, i) => { s += `<text x="${x(dec.at(-1)[2]) + colW + 6}" y="${pos.at(-1)[i].y + pos.at(-1)[i].h / 2}" dy="0.35em" font-size="10.5" fill="#525252">${esc(t.label.length > 34 ? t.label.slice(0, 33) + "…" : t.label)}</text>`; });
    el.innerHTML = s + "</svg>";
    el.querySelectorAll(".sk").forEach((p) => p.addEventListener("mouseenter", () => el.querySelectorAll(".sk").forEach((q) => (q.style.opacity = q.dataset.m === p.dataset.m ? 1 : 0.12))));
    el.addEventListener("mouseleave", () => el.querySelectorAll(".sk").forEach((q) => (q.style.opacity = "")));
  }

  function network(el) {
    const S = C.sub, subs = D.topics.sub;
    const W = el.clientWidth, H = 660;
    const nodes = subs.map((s) => ({ id: s.id, label: s.label, color: D.macroById.get(s.macro).color, inn: d3.sum(S, (row) => row[s.id]) - S[s.id][s.id] }));
    const links = [];
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { const w = S[i][j] + S[j][i]; if (w >= threshold) links.push({ source: i, target: j, w }); }
    const r = d3.scaleSqrt([0, d3.max(nodes, (n) => n.inn) || 1], [4, 22]);
    const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    const lk = svg.append("g").selectAll("line").data(links).join("line").attr("stroke", "#cbd5e1").attr("stroke-width", (d) => Math.sqrt(d.w));
    const nd = svg.append("g").selectAll("g").data(nodes).join("g").style("cursor", "pointer");
    nd.append("circle").attr("r", (d) => r(d.inn)).attr("fill", (d) => d.color).attr("stroke", "#fff");
    nd.append("text").attr("dy", (d) => -r(d.inn) - 3).attr("text-anchor", "middle").attr("font-size", 9.5).attr("fill", "#404040").text((d) => (d.label.length > 26 ? d.label.slice(0, 25) + "…" : d.label));
    nd.append("title").text((d) => `${d.label}: ${d.inn} citations from other subtopics`);
    let pinned = null;
    const focus = (id) => {
      const nb = new Set([id]); links.forEach((l) => { if (l.source.id === id) nb.add(l.target.id); if (l.target.id === id) nb.add(l.source.id); });
      nd.attr("opacity", (d) => (id == null || nb.has(d.id) ? 1 : 0.15));
      lk.attr("stroke", (l) => (id != null && (l.source.id === id || l.target.id === id) ? "#475569" : "#cbd5e1")).attr("opacity", (l) => (id == null || l.source.id === id || l.target.id === id ? 1 : 0.1));
    };
    nd.on("mouseenter", (e, d) => pinned == null && focus(d.id)).on("mouseleave", () => pinned == null && focus(null))
      .on("click", (e, d) => { pinned = pinned === d.id ? null : d.id; focus(pinned); e.stopPropagation(); });
    svg.on("click", () => { pinned = null; focus(null); });
    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).distance(150).strength((l) => Math.min(0.6, l.w / 40)))
      .force("charge", d3.forceManyBody().strength(-520)).force("x", d3.forceX(W / 2).strength(0.04)).force("y", d3.forceY(H / 2).strength(0.06)).force("center", d3.forceCenter(W / 2, H / 2)).force("collide", d3.forceCollide((d) => r(d.inn) + 8))
      .on("tick", () => {
        nodes.forEach((d) => { d.x = Math.max(30, Math.min(W - 30, d.x)); d.y = Math.max(30, Math.min(H - 20, d.y)); });
        lk.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
        nd.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });
    viz = { destroy: () => sim.stop() };
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("#tabs button"), l = e.target.closest("#lvl button");
    if (t) { tab = t.dataset.v; show(); }
    if (l) { level = l.dataset.v; show(); }
  });
  $("#thr").addEventListener("input", (e) => { threshold = +e.target.value; $("#thr-v").textContent = threshold; show(); });
  if (C.status === "ready") show();
  return () => viz?.destroy?.();
}
