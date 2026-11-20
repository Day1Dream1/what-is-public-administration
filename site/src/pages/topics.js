// Explore › Topic Lifecycles (reference: whatisstrategy.org/explore/topics)
import * as d3 from "d3";
import { esc, fmt } from "../data.js";

const DECADES = [[1980, 1989, "1980s"], [1990, 1999, "1990s"], [2000, 2009, "2000s"], [2010, 2019, "2010s"], [2020, 2025, "2020s*"]];
const STAGES = { growing: ["Growing", "#3b82f6", "Rapidly expanding research areas"], mature: ["Mature", "#a3a3a3", "Established, stable topics"], declining: ["Declining", "#f87171", "Waning research interest"] };

export function render(root, D) {
  const tot = DECADES.map(([a, b]) => D.papers.filter((p) => p.year >= a && p.year <= b).length);
  const rows = D.topics.sub.map((s) => {
    const n = DECADES.map(([a, b]) => D.papers.filter((p) => p.sub === s.id && p.year >= a && p.year <= b).length);
    const share = n.map((v, i) => v / tot[i]);
    const recent = (share[3] + share[4]) / 2, middle = (share[1] + share[2]) / 2;
    const ratio = middle ? recent / middle : 2;
    const stage = ratio > 1.25 ? "growing" : ratio < 0.8 ? "declining" : "mature";
    const peak = DECADES[share.indexOf(d3.max(share))][2].replace("*", "");
    return { s, n, share, stage, peak, total: d3.sum(n), color: D.macroById.get(s.macro).color };
  });
  const count = (k) => rows.filter((r) => r.stage === k).length;
  let stage = "all";
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 36px">
    <p class="kicker">Explore</p><h1 class="title">Topic Lifecycles</h1>
    <p class="dek">See how research subtopics are born, grow, peak and decline. Filter by lifecycle stage to find growing or mature areas of inquiry.</p>
  </div></section>
  <section class="section" style="padding-top:28px"><div class="container">
    <div class="seg" role="group" aria-label="Stage" id="filter">
      <button data-v="all" aria-pressed="true">All stages</button>
      ${Object.entries(STAGES).map(([k, [l, c]]) => `<button data-v="${k}" aria-pressed="false"><span class="dot" style="background:${c}"></span> ${l} ${count(k)}</button>`).join("")}
    </div>
    <div class="stage-cards">${Object.entries(STAGES).map(([k, [l, c, d]]) => `<button class="stage-card" data-v="${k}" style="--c:${c}"><span class="kicker-sm"><span class="dot" style="background:${c}"></span> ${l}</span><b>${count(k)}</b><span>${d}</span></button>`).join("")}</div>
    <p class="note">Stage compares a subtopic's share of all papers in 2010–2025 with its share in 1990–2009 (growing &gt; 1.25×, declining &lt; 0.8×). *The 2020s cover 2020–2025 only.</p>
    <div class="lifecycle" id="rows"></div>
  </div></section>`;
  const $ = (s) => root.querySelector(s);
  function draw() {
    root.querySelectorAll("#filter button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === stage));
    root.querySelectorAll(".stage-card").forEach((b) => b.classList.toggle("on", b.dataset.v === stage));
    const list = rows.filter((r) => stage === "all" || r.stage === stage).sort((a, b) => b.total - a.total);
    const yMax = d3.max(list, (r) => d3.max(r.share));
    $("#rows").innerHTML = list.map((r) => `
      <div class="lc-row" style="--c:${r.color}">
        <div class="lc-name"><strong>${esc(r.s.label)}</strong><span>${fmt(r.total)} papers · Peak: ${r.peak} · <em style="color:${STAGES[r.stage][1]}">${STAGES[r.stage][0]}</em></span></div>
        <div class="lc-spark" data-s="${r.share.join(",")}"></div>
        <div class="lc-dec">${r.n.map((v, i) => `<span><i>${DECADES[i][2]}</i>${v}</span>`).join("")}</div>
      </div>`).join("");
    $("#rows").querySelectorAll(".lc-spark").forEach((el) => {
      const v = el.dataset.s.split(",").map(Number), W = el.clientWidth || 300, H = 44;
      const x = d3.scalePoint(d3.range(v.length), [6, W - 6]), y = d3.scaleLinear([0, yMax], [H - 4, 4]);
      const c = getComputedStyle(el.parentElement).getPropertyValue("--c");
      const ar = d3.area().x((d, i) => x(i)).y0(H - 4).y1((d) => y(d)).curve(d3.curveMonotoneX);
      el.innerHTML = `<svg width="${W}" height="${H}"><path d="${ar(v)}" fill="${c}" opacity=".15"/><path d="${ar.lineY1()(v)}" fill="none" stroke="${c}" stroke-width="1.6"/>${v.map((d, i) => `<circle cx="${x(i)}" cy="${y(d)}" r="2.5" fill="${c}"/>`).join("")}</svg>`;
    });
  }
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-v]"); if (!b) return; stage = stage === b.dataset.v && b.classList.contains("stage-card") ? "all" : b.dataset.v; draw(); });
  draw();
}
