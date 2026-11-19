// Chart components for the chapter stories. Each returns { set(state, i), destroy() }.
// Highlighting only changes opacity / outline, never the geometry, as on What is Strategy?.
import * as d3 from "d3";
import { esc } from "../data.js";
import { short } from "./evidence.js";

const T = 500;                         // transition duration (ms)
const GRID = "#f1f1f1";
export const COLORS = { theory: "#f59e0b", phenomenon: "#3b82f6", mixed: "#94a3b8", causal: "#f97316", coherence: "#14b8a6", pending: "#cbd5e1" };

function responsive(el, draw) {
  let last = [{}, 0];
  const ro = new ResizeObserver(() => draw(...last, true));
  ro.observe(el);
  return {
    set(state, i) { last = [state, i]; draw(state, i, false); },
    destroy() { ro.disconnect(); el.innerHTML = ""; },
  };
}
const size = (el) => {
  const cs = getComputedStyle(el);
  const px = (k) => parseFloat(cs[k]) || 0;
  return [Math.max(280, el.clientWidth - px("paddingLeft") - px("paddingRight")), Math.max(240, el.clientHeight - px("paddingTop") - px("paddingBottom"))];
};
const axisStyle = (g) => { g.select(".domain").remove(); g.selectAll("line").attr("stroke", GRID); g.selectAll("text").attr("fill", "#9ca3af").attr("font-size", 10); };
const asSet = (v) => (v == null ? null : new Set([].concat(v)));

function tooltip() {
  const t = document.createElement("div");
  t.className = "tooltip"; t.hidden = true; t.style.position = "fixed"; document.body.appendChild(t);
  return {
    show(e, html) { t.hidden = false; t.innerHTML = html; t.style.left = Math.min(e.clientX + 14, innerWidth - 300) + "px"; t.style.top = e.clientY + 14 + "px"; },
    hide() { t.hidden = true; },
    remove() { t.remove(); },
  };
}

export function awaiting(el, title, body) {
  const box = document.createElement("div");
  box.className = "awaiting";
  box.innerHTML = `<div><p class="kicker-sm">Awaiting data</p><p class="aw-t">${title}</p><p class="aw-b">${body}</p></div>`;
  el.appendChild(box);
}

// ------------------------------------------------------------------ small multiples (Ch1 B)
export function smallMultiples(el, ctx, { years, series, counts }) {
  // series: [{id,label,color,share:[], count:[], total}] sorted by total desc
  let mode = "share";
  ctx.extra.innerHTML = `<div class="seg mini" role="group" aria-label="Measure"><button data-v="share" aria-pressed="true">% of field</button><button data-v="count" aria-pressed="false"># of papers</button></div>`;
  el.classList.add("sm-wrap");
  const grid = document.createElement("div");
  grid.className = "sm-grid story-sm";
  el.appendChild(grid);
  const tip = tooltip();
  const cards = series.map((s) => {
    const c = document.createElement("div");
    c.className = "sm-card";
    const v = s.share.filter((x) => x != null);
    const last = d3.mean(s.share.slice(-10).filter((x) => x != null)), prev = d3.mean(s.share.slice(-20, -10).filter((x) => x != null));
    const rel = prev ? (last - prev) / prev : 0;
    const arrow = rel > 0.15 ? ["↗", "#059669"] : rel < -0.15 ? ["↘", "#dc2626"] : ["→", "#9ca3af"];
    const pk = s.share.indexOf(d3.max(v));
    c.innerHTML = `<div class="h"><div><div class="name" style="color:${s.color}">${esc(s.label)}</div><div class="sub">${s.total.toLocaleString("en-US")} papers</div></div>
      <span class="arrow" style="color:${arrow[1]}">${arrow[0]}</span></div><div class="chart"></div>
      <div class="f"><span>Peak: ${years[pk]}</span><span>${s.share[pk].toFixed(1)}% of field</span></div>`;
    grid.appendChild(c);
    return { c, s };
  });
  function draw() {
    const yMax = mode === "share" ? d3.max(series, (s) => d3.max(s.share)) : d3.max(series, (s) => d3.max(s.count));
    for (const { c, s } of cards) {
      const host = c.querySelector(".chart");
      const W = Math.max(160, host.clientWidth), H = Math.max(56, host.clientHeight || 70);
      const mg = { t: 6, r: 6, b: 14, l: 26 };
      const x = d3.scaleLinear([years[0], years.at(-1)], [mg.l, W - mg.r]);
      const y = d3.scaleLinear([0, yMax], [H - mg.b, mg.t]).nice();
      const vals = mode === "share" ? s.share : s.count;
      const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(2).tickSize(-(W - mg.l - mg.r)).tickFormat(mode === "share" ? (d) => d + "%" : d3.format("~s"))).call(axisStyle);
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).tickValues([years[0], 2000, years.at(-1)]).tickFormat(d3.format("d")).tickSize(0)).call(axisStyle).selectAll("text").attr("dy", "0.9em");
      const area = d3.area().defined((d) => d != null).x((d, i) => x(years[i])).y0(y(0)).y1((d) => y(d)).curve(d3.curveMonotoneX);
      svg.append("path").attr("d", area(vals)).attr("fill", s.color).attr("opacity", 0.12);
      svg.append("path").attr("d", area.lineY1()(vals)).attr("fill", "none").attr("stroke", s.color).attr("stroke-width", 1.4);
      const pk = vals.indexOf(d3.max(vals.filter((v) => v != null)));
      svg.append("circle").attr("cx", x(years[pk])).attr("cy", y(vals[pk])).attr("r", 2.6).attr("fill", s.color);
      svg.append("rect").attr("x", mg.l).attr("width", W - mg.l - mg.r).attr("height", H).attr("fill", "transparent")
        .on("mousemove", (e) => { const yy = Math.round(x.invert(d3.pointer(e)[0])); const i = years.indexOf(yy); if (i < 0) return;
          tip.show(e, `<div class="t">${esc(s.label)} · ${yy}</div>${s.count[i]} of ${counts[i]} papers (${s.share[i]?.toFixed(1)}%)`); })
        .on("mouseleave", tip.hide);
      host.replaceChildren(svg.node());
    }
  }
  ctx.extra.querySelector(".seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    mode = b.dataset.v;
    ctx.extra.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === mode));
    draw();
  });
  const r = responsive(el, (state, i, resized) => {
    if (resized || !el.dataset.drawn) { draw(); el.dataset.drawn = 1; }
    const hi = asSet(state.highlight);
    for (const { c, s } of cards) {
      const on = !hi || hi.has(s.id);
      c.classList.toggle("dim", !on);
      c.classList.toggle("hi", !!hi && on);
      c.style.setProperty("--ring", s.color);
    }
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

// ------------------------------------------------------------------ two-line area (Ch2 A)
export function twoLine(el, ctx, data) {
  ctx.extra.innerHTML = `<span class="lg"><i style="background:${COLORS.theory}"></i>Theory</span><span class="lg"><i style="background:${COLORS.phenomenon}"></i>Phenomenon</span>`;
  if (data.status !== "ready") {
    awaiting(el, "Theory vs. phenomenon labels have not been generated yet.",
      "This chart classifies each abstract with an LLM. Run <code>python -m pa_map classify</code> and then <code>python -m pa_map evidence</code>; the chart and the numbers in the text fill in automatically.");
    const r = ghostAxes(el, [20, 80]);
    return { set() {}, destroy() { r(); el.innerHTML = ""; } };
  }
  const tip = tooltip();
  const { years } = data;
  let g;
  const r = responsive(el, (state, i, resized) => {
    if (resized || !g) {
      el.innerHTML = "";
      const [W, H] = size(el), mg = { t: 24, r: 24, b: 28, l: 48 };
      const x = d3.scaleLinear([years[0], years.at(-1)], [mg.l, W - mg.r]);
      const y = d3.scaleLinear([20, 80], [H - mg.b, mg.t]);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((d) => d + "%").tickSize(-(W - mg.l - mg.r))).call(axisStyle);
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(Math.min(23, W / 45)).tickFormat(d3.format("d")).tickSize(0)).call(axisStyle).selectAll("text").attr("dy", "1.2em");
      svg.append("line").attr("x1", mg.l).attr("x2", W - mg.r).attr("y1", y(50)).attr("y2", y(50)).attr("stroke", "#cbd5e1").attr("stroke-dasharray", "4 4");
      const defs = svg.append("defs");
      g = {};
      for (const key of ["phenomenon", "theory"]) {
        const gid = `grad-${key}`;
        defs.append("linearGradient").attr("id", gid).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1)
          .html(`<stop offset="0" stop-color="${COLORS[key]}" stop-opacity=".35"/><stop offset="1" stop-color="${COLORS[key]}" stop-opacity=".04"/>`);
        const ar = d3.area().defined((d) => d != null).x((d, k) => x(years[k])).y0(y(20)).y1((d) => y(Math.max(20, d))).curve(d3.curveMonotoneX);
        const grp = svg.append("g").style("transition", `opacity ${T}ms`);
        grp.append("path").attr("d", ar(data[key])).attr("fill", `url(#${gid})`);
        grp.append("path").attr("d", ar.lineY1()(data[key])).attr("fill", "none").attr("stroke", COLORS[key]).attr("stroke-width", 2);
        g[key] = grp;
      }
      g.marker = svg.append("g").style("transition", `opacity ${T}ms`).attr("opacity", 0);
      g.marker.append("line").attr("y1", mg.t).attr("y2", H - mg.b).attr("stroke", "#111").attr("stroke-dasharray", "3 3");
      g.marker.append("text").attr("y", mg.t - 8).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600);
      g.x = x;
      svg.append("rect").attr("x", mg.l).attr("y", mg.t).attr("width", W - mg.l - mg.r).attr("height", H - mg.t - mg.b).attr("fill", "transparent")
        .on("mousemove", (e) => { const yy = Math.round(x.invert(d3.pointer(e)[0])); const k = years.indexOf(yy); if (k < 0) return;
          tip.show(e, `<div class="t">${yy}</div><span style="color:${COLORS.theory}">Theory ${data.theory[k]?.toFixed(1)}%</span><br><span style="color:${COLORS.phenomenon}">Phenomenon ${data.phenomenon[k]?.toFixed(1)}%</span>`); })
        .on("mouseleave", tip.hide);
    }
    for (const key of ["theory", "phenomenon"]) g[key].attr("opacity", !state.emph || state.emph === key ? 1 : 0.18);
    if (state.marker) {
      const mx = g.x(state.marker), right = mx > g.x.range()[1] - 20;
      g.marker.attr("opacity", 1).attr("transform", `translate(${mx},0)`).select("text").text(state.marker).attr("text-anchor", right ? "end" : "middle");
      ctx.setValue(state.marker);
    } else { g.marker.attr("opacity", 0); ctx.setValue(""); }
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

function ghostAxes(el, [lo, hi]) {
  const draw = () => {
    el.querySelector("svg")?.remove();
    const [W, H] = size(el), mg = { t: 24, r: 24, b: 28, l: 48 };
    const x = d3.scaleLinear([1980, 2025], [mg.l, W - mg.r]), y = d3.scaleLinear([lo, hi], [H - mg.b, mg.t]);
    const svg = d3.select(el).insert("svg", ":first-child").attr("width", W).attr("height", H).attr("aria-hidden", true);
    svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((d) => d + (hi > 10 ? "%" : "")).tickSize(-(W - mg.l - mg.r))).call(axisStyle);
    svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")).tickSize(0)).call(axisStyle).selectAll("text").attr("dy", "1.2em");
  };
  const ro = new ResizeObserver(draw); ro.observe(el);
  return () => ro.disconnect();
}

// ------------------------------------------------------------------ stacked areas (Ch2 B, Ch4 A, Ch4 C)
export function stacked(el, ctx, { years, series, unit = "%", counts = null, curve = d3.curveMonotoneX, yLabel = "", toggle = false, outline = false }) {
  // series: [{key,label,color,values:[], counts?:[]}]
  let mode = "share";
  if (toggle && counts) {
    ctx.extra.innerHTML = `<div class="seg mini" role="group" aria-label="Measure"><button data-v="share" aria-pressed="true">%</button><button data-v="count" aria-pressed="false">#</button></div>`;
    ctx.extra.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      mode = b.dataset.v; ctx.extra.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x.dataset.v === mode));
      g = null; r.set(...cur);
    });
  }
  const tip = tooltip();
  let g = null, cur = [{}, 0];
  const r = responsive(el, (state, i, resized) => {
    cur = [state, i];
    if (resized || !g) {
      el.innerHTML = "";
      const [W, H] = size(el), mg = { t: 24, r: 24, b: 28, l: 52 };
      const vals = (s) => (mode === "share" ? s.values : s.counts).map((v) => v ?? 0);
      const rows = years.map((y, k) => Object.fromEntries([["year", y], ...series.map((s) => [s.key, vals(s)[k]])]));
      const st = d3.stack().keys(series.map((s) => s.key))(rows);
      const x = d3.scaleLinear([years[0], years.at(-1)], [mg.l, W - mg.r]);
      const y = d3.scaleLinear([0, d3.max(st.at(-1), (d) => d[1]) || 1], [H - mg.b, mg.t]).nice();
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((d) => (mode === "share" ? d + unit : d3.format("~s")(d))).tickSize(-(W - mg.l - mg.r))).call(axisStyle);
      if (yLabel) svg.append("text").attr("transform", `translate(14,${(H - mg.b + mg.t) / 2}) rotate(-90)`).attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#9ca3af").text(mode === "share" ? yLabel : "papers");
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(Math.min(23, W / 45)).tickFormat(d3.format("d")).tickSize(0)).call(axisStyle).selectAll("text").attr("dy", "1.2em");
      const area = d3.area().x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(curve);
      g = { paths: new Map() };
      st.forEach((layer, k) => {
        const s = series[k];
        const p = svg.append("path").attr("d", area(layer)).attr("fill", s.color).attr("stroke", "none").style("transition", `opacity ${T}ms`);
        g.paths.set(s.key, p);
      });
      g.marker = svg.append("g").attr("opacity", 0).style("transition", `opacity ${T}ms`);
      g.marker.append("line").attr("y1", mg.t).attr("y2", H - mg.b).attr("stroke", "#111").attr("stroke-dasharray", "3 3");
      g.marker.append("text").attr("y", mg.t - 8).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600);
      g.x = x;
      svg.append("rect").attr("x", mg.l).attr("y", mg.t).attr("width", W - mg.l - mg.r).attr("height", H - mg.t - mg.b).attr("fill", "transparent")
        .on("mousemove", (e) => { const yy = Math.round(x.invert(d3.pointer(e)[0])); const k = years.indexOf(yy); if (k < 0) return;
          tip.show(e, `<div class="t">${yy}</div>${series.slice().reverse().map((s) => `<span style="color:${s.color}">■</span> ${esc(s.label)}: ${mode === "share" ? (s.values[k] ?? 0).toFixed(1) + unit : s.counts[k]}`).join("<br>")}`); })
        .on("mouseleave", tip.hide);
    }
    const em = asSet(state.emph);
    for (const s of series) {
      const on = !em || em.has(s.key);
      g.paths.get(s.key).attr("opacity", on ? 1 : 0.16).attr("stroke", em && on && outline ? d3.color(s.color).darker(1.2) : "none").attr("stroke-width", 1.2);
    }
    if (state.marker) { const mx = g.x(state.marker); g.marker.attr("opacity", 1).attr("transform", `translate(${mx},0)`).select("text").text(state.marker).attr("text-anchor", mx > g.x.range()[1] - 20 ? "end" : "middle"); ctx.setValue(state.marker); }
    else { g.marker.attr("opacity", 0); ctx.setValue(""); }
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

// ------------------------------------------------------------------ diverging bars (Ch2 C)
export function diverging(el, ctx, data, D) {
  const ready = data.orientation_status === "ready";
  ctx.extra.innerHTML = ready
    ? `<span class="lg"><i style="background:${COLORS.theory}"></i>Theory-driven</span><span class="lg"><i style="background:${COLORS.phenomenon}"></i>Phenomenon-driven</span><span class="lg"><i style="background:${COLORS.mixed}"></i>Mixed</span>`
    : `<span class="lg"><i style="background:#ef8a62"></i>Declined</span><span class="lg"><i style="background:#67a9cf"></i>Grew</span><span class="lg muted">Orientation colours appear after LLM labelling</span>`;
  const neg = data.topics.filter((t) => t.change <= -data.threshold_pp).slice(0, 10);
  const pos = data.topics.filter((t) => t.change >= data.threshold_pp).slice(-10);
  const rows = [...neg, ...pos];
  const color = (t) => (ready ? COLORS[t.orientation || "mixed"] : t.change < 0 ? "#ef8a62" : "#67a9cf");
  const tip = tooltip();
  let bars;
  const r = responsive(el, (state, i, resized) => {
    if (resized || !bars) {
      el.innerHTML = "";
      const [W, H] = size(el), mg = { t: 16, r: 40, b: 30, l: Math.min(260, W * 0.3) };
      const ext = d3.max(rows, (t) => Math.abs(t.change));
      const x = d3.scaleLinear([-ext, ext], [mg.l, W - mg.r]).nice();
      const y = d3.scaleBand(rows.map((t) => t.id), [mg.t, H - mg.b]).paddingInner(0.22);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d > 0 ? "+" : ""}${d}pp`).tickSize(-(H - mg.b - mg.t))).call(axisStyle);
      svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", mg.t).attr("y2", H - mg.b).attr("stroke", "#a3a3a3");
      svg.append("g").selectAll("text").data(rows).join("text").attr("x", mg.l - 8).attr("y", (t) => y(t.id) + y.bandwidth() / 2).attr("dy", "0.35em")
        .attr("text-anchor", "end").attr("font-size", Math.min(11.5, y.bandwidth() * 0.8)).attr("fill", "#525252").text((t) => short(t.label, 40));
      bars = svg.append("g").selectAll("rect").data(rows).join("rect")
        .attr("x", (t) => x(Math.min(0, t.change))).attr("width", (t) => Math.abs(x(t.change) - x(0))).attr("y", (t) => y(t.id)).attr("height", y.bandwidth())
        .attr("fill", color).attr("rx", 2).style("transition", `opacity ${T}ms`)
        .on("mousemove", (e, t) => tip.show(e, `<div class="t">${esc(t.label)}</div>${data.early.join("–")}: ${t.early.toFixed(1)}% → ${data.late.join("–")}: ${t.late.toFixed(1)}%<br>Change ${t.change > 0 ? "+" : ""}${t.change.toFixed(2)} pp${ready ? `<br>Orientation: ${t.orientation || "mixed"}` : ""}`))
        .on("mouseleave", tip.hide);
    }
    bars.attr("opacity", (t) => (!state.side || (state.side === "neg" ? t.change < 0 : t.change > 0) ? 1 : 0.15));
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

// ------------------------------------------------------------------ four metric cards (Ch3 A)
export function fourMetrics(el, ctx, data) {
  const spec = [["effective", "#ef4444"], ["coherence", "#3b82f6"], ["hhi", "#10b981"], ["dispersion", "#f59e0b"]];
  el.classList.add("fm-wrap");
  const grid = document.createElement("div");
  grid.className = "fm-grid";
  el.appendChild(grid);
  const cards = spec.map(([key, color]) => {
    const m = data.metrics[key];
    const c = document.createElement("div");
    c.className = "fm-card";
    const ch = m.change == null ? "" : `${m.change > 0 ? "+" : ""}${Math.round(m.change * 100)}%`;
    c.innerHTML = `<div class="h"><div><div class="name"><span class="dot" style="background:${color}"></span> ${m.label}</div><div class="sub">${m.description}</div></div><span class="chg" style="color:${color}" title="Mean of last 5 years vs first 5 years">${ch}</span></div><div class="chart"></div>`;
    grid.appendChild(c);
    return { c, key, color, m };
  });
  const tip = tooltip();
  function draw() {
    for (const { c, color, m } of cards) {
      const host = c.querySelector(".chart");
      const W = Math.max(200, host.clientWidth), H = Math.max(80, host.clientHeight);
      const mg = { t: 8, r: 10, b: 18, l: 40 };
      const yrs = data.years, vals = m.values;
      const x = d3.scaleLinear([yrs[0], yrs.at(-1)], [mg.l, W - mg.r]);
      const y = d3.scaleLinear(d3.extent(vals.filter((v) => v != null)), [H - mg.b, mg.t]).nice();
      const svg = d3.create("svg").attr("width", W).attr("height", H);
      svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - mg.l - mg.r)).tickFormat(d3.format(m.label.includes("Paradigm") ? "d" : ".2f"))).call(axisStyle);
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).tickValues([yrs[0], 2000, yrs.at(-1)]).tickFormat(d3.format("d")).tickSize(0)).call(axisStyle).selectAll("text").attr("dy", "1em");
      const ar = d3.area().defined((d) => d != null).x((d, i) => x(yrs[i])).y0(H - mg.b).y1((d) => y(d)).curve(d3.curveMonotoneX);
      svg.append("path").attr("d", ar(vals)).attr("fill", color).attr("opacity", 0.08);
      svg.append("path").attr("d", ar.lineY1()(vals)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.6);
      if (m.trend) {
        const [a, b] = m.trend;
        svg.append("line").attr("x1", x(yrs[0])).attr("x2", x(yrs.at(-1))).attr("y1", y(a)).attr("y2", y(a + b * (yrs.length - 1)))
          .attr("stroke", color).attr("stroke-dasharray", "4 4").attr("opacity", 0.6);
      }
      svg.append("rect").attr("x", mg.l).attr("width", W - mg.l - mg.r).attr("height", H).attr("fill", "transparent")
        .on("mousemove", (e) => { const yy = Math.round(x.invert(d3.pointer(e)[0])); const k = yrs.indexOf(yy); if (k < 0 || vals[k] == null) return;
          tip.show(e, `<div class="t">${m.label} · ${yy}</div>${vals[k]} <span class="muted">(${data.n[k]} papers)</span>`); })
        .on("mouseleave", tip.hide);
      host.replaceChildren(svg.node());
    }
  }
  const r = responsive(el, (state, i, resized) => {
    if (resized || !el.dataset.drawn) { draw(); el.dataset.drawn = 1; }
    for (const { c, key } of cards) c.classList.toggle("dim", !!state.emph && state.emph !== key);
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

// ------------------------------------------------------------------ chord diagram (Ch3 B, Explore)
export function chord(el, ctx, data, D, { level = "macro", interactive = true } = {}) {
  if (data.status !== "ready") {
    awaiting(el, "Citation links have not been fetched yet.", "Run <code>python -m pa_map refs</code>, then <code>python -m pa_map evidence</code>.");
    return { set() {}, destroy() { el.innerHTML = ""; } };
  }
  const M = data[level];
  const items = level === "macro" ? D.topics.macro : D.topics.sub;
  const color = (k) => (level === "macro" ? items[k].color : D.macroById.get(items[k].macro).color);
  const label = (k) => short(level === "macro" ? items[k].label.replace(/ and /g, " & ") : items[k].label, 24);
  let G, hover = null, cur = {};
  const tip = tooltip();
  function center(focus) {
    const c = G.center;
    c.selectAll("*").remove();
    if (focus == null) {
      c.append("text").attr("y", -6).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#525252").text(`${Math.round(data.cross_share * 100)}% cross-area`);
      c.append("text").attr("y", 12).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#9ca3af").text(`${Math.round(data.within_share * 100)}% within-area`);
      return;
    }
    const out = d3.sum(M[focus]), inn = d3.sum(M, (row) => row[focus]), self = M[focus][focus];
    c.append("text").attr("y", -22).attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 600).attr("fill", color(focus)).text(label(focus));
    [[`◎ ${self} self (${out ? Math.round((100 * self) / out) : 0}%)`, -2], [`↗ ${out - self} out`, 14], [`↙ ${inn - self} in`, 30]]
      .forEach(([t, dy]) => c.append("text").attr("y", dy).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#525252").text(t));
  }
  function emphasize(focus) {
    G.groups.attr("opacity", (d) => (focus == null || d.index === focus ? 1 : 0.25));
    G.ribbons.attr("opacity", (d) => (focus == null ? 0.55 : d.source.index === focus || d.target.index === focus ? 0.85 : 0.04));
    center(focus);
  }
  const r = responsive(el, (state, i, resized) => {
    cur = state;
    if (resized || !G) {
      el.innerHTML = "";
      const [W, H] = size(el);
      const narrow = W < 600;
      const R = Math.min(W, H) / 2 - (narrow ? 16 : level === "macro" ? 70 : 110);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      const g = svg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);
      const ch = d3.chord().padAngle(level === "macro" ? 0.03 : 0.012).sortSubgroups(d3.descending)(M);
      const arc = d3.arc().innerRadius(R).outerRadius(R + (level === "macro" ? 18 : 12));
      const rib = d3.ribbon().radius(R - 2);
      G = {};
      G.ribbons = g.append("g").selectAll("path").data(ch).join("path").attr("d", rib)
        .attr("fill", (d) => color(d.source.index)).attr("stroke", "none").style("transition", `opacity ${T}ms`);
      G.groups = g.append("g").selectAll("g").data(ch.groups).join("g").style("transition", `opacity ${T}ms`);
      G.groups.append("path").attr("d", arc).attr("fill", (d) => color(d.index)).attr("stroke", "#fff");
      G.groups.append("text").each((d) => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", "0.35em").attr("font-size", level === "macro" ? 11 : 9.5).attr("fill", "#404040")
        .attr("transform", (d) => `rotate(${(d.angle * 180) / Math.PI - 90}) translate(${R + (level === "macro" ? 26 : 18)})${d.angle > Math.PI ? " rotate(180)" : ""}`)
        .attr("text-anchor", (d) => (d.angle > Math.PI ? "end" : null)).text((d) => (narrow ? "" : label(d.index)));
      if (interactive) {
        G.groups.style("cursor", "pointer")
          .on("mouseenter", (e, d) => { hover = d.index; if (cur.focus == null) emphasize(hover); })
          .on("mouseleave", () => { hover = null; emphasize(cur.focus ?? null); });
        G.ribbons.on("mousemove", (e, d) => tip.show(e, `${esc(label(d.source.index))} → ${esc(label(d.target.index))}: ${M[d.source.index][d.target.index]}<br>${esc(label(d.target.index))} → ${esc(label(d.source.index))}: ${M[d.target.index][d.source.index]}`))
          .on("mouseleave", tip.hide);
      }
      G.center = g.append("g");
    }
    emphasize(state.focus ?? null);
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

// ------------------------------------------------------------------ heatmap (Ch4 B, Explore)
export function heatmap(el, ctx, data) {
  const tip = tooltip();
  let cells, colLabels, rowLabels;
  const fill = d3.scaleSequential([0, 60], d3.interpolateRgb("#eef2ff", "#3730a3")).clamp(true);
  const r = responsive(el, (state, i, resized) => {
    if (resized || !cells) {
      el.innerHTML = "";
      const [W, H] = size(el), mg = { t: 26, r: 16, b: 10, l: Math.min(230, W * 0.26) };
      const x = d3.scaleBand(data.bins, [mg.l, W - mg.r]).padding(0.06);
      const y = d3.scaleBand(data.themes.map((t) => t.id), [mg.t, H - mg.b]).padding(0.08);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      colLabels = svg.append("g").selectAll("text").data(data.bins).join("text").attr("x", (b) => x(b) + x.bandwidth() / 2).attr("y", mg.t - 9)
        .attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#737373").text((b) => b).style("transition", `opacity ${T}ms`);
      rowLabels = svg.append("g").selectAll("text").data(data.themes).join("text").attr("x", mg.l - 8).attr("y", (t) => y(t.id) + y.bandwidth() / 2).attr("dy", "0.35em")
        .attr("text-anchor", "end").attr("font-size", 11).attr("fill", "#404040").text((t) => short(t.label, 34)).style("transition", `opacity ${T}ms`);
      const flat = data.themes.flatMap((t) => t.cells.map((c, col) => ({ ...c, t, col })));
      cells = svg.append("g").selectAll("g").data(flat).join("g").style("transition", `opacity ${T}ms`)
        .attr("transform", (d) => `translate(${x(data.bins[d.col])},${y(d.t.id)})`)
        .on("mousemove", (e, d) => tip.show(e, `<div class="t">${esc(d.t.label)} · ${data.bins[d.col]}</div>${d.n ? `${d.k} of ${d.n} papers${d.share != null ? ` (${d.share.toFixed(1)}%)` : " (fewer than 5 papers)"}` : "No coded papers"}`))
        .on("mouseleave", tip.hide);
      cells.append("rect").attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("rx", 3)
        .attr("fill", (d) => (d.share == null ? "#f5f5f5" : fill(d.share)));
      cells.append("text").attr("x", x.bandwidth() / 2).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "middle")
        .attr("font-size", Math.min(11, y.bandwidth() * 0.45)).attr("fill", (d) => (d.share != null && d.share > 30 ? "#fff" : d.share == null ? "#bdbdbd" : "#3730a3"))
        .text((d) => (d.share == null ? (d.n ? "n<5" : "–") : `${Math.round(d.share)}%`));
    }
    const cols = state.cols ? new Set(state.cols) : null;
    cells.attr("opacity", (d) => (state.row != null ? (d.t.id === state.row ? 1 : 0.15) : cols ? (cols.has(d.col) ? 1 : 0.25) : 1));
    colLabels.attr("opacity", (b, k) => (cols && state.row == null ? (cols.has(k) ? 1 : 0.3) : 1));
    rowLabels.attr("opacity", (t) => (state.row != null ? (t.id === state.row ? 1 : 0.3) : 1)).attr("font-weight", (t) => (t.id === state.row ? 700 : 400));
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}

// ------------------------------------------------------------------ periphery scatter (Ch5 A)
export function periphery(el, ctx, D, codes, stats) {
  ctx.extra.innerHTML = `<span class="lg"><i style="background:#94a3b8;border-radius:50%"></i>Non-causal</span><span class="lg"><i style="background:${COLORS.causal};border-radius:50%"></i>Causal</span>`;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Papers in semantic space: grey dots are papers without a causal identification method, orange dots papers with one. Dashed rings mark distance from the field's centre.");
  el.appendChild(canvas);
  el.classList.add("canvas-viz");
  const pts = D.papers.map((p, i) => ({ p, c: codes.c[i], causal: codes.c[i] && codes.m[i] > 0 })).filter((d) => d.c);
  let show = "both", W, H, dpr, sx;
  function draw() {
    const rr = el.getBoundingClientRect();
    W = rr.width; H = rr.height; dpr = devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx2 = canvas.getContext("2d");
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.fillStyle = "#fafafa"; ctx2.fillRect(0, 0, W, H);
    const s = Math.min(W, H) * 0.9, ox = (W - s) / 2, oy = (H - s) / 2;
    sx = (x, y) => [ox + x * s, oy + y * s];
    const [cx, cy] = sx(stats.centroid.x, stats.centroid.y);
    ctx2.setLineDash([4, 4]); ctx2.strokeStyle = "#cbd5e1"; ctx2.lineWidth = 1;
    for (const rad of stats.rings) { ctx2.beginPath(); ctx2.arc(cx, cy, rad * s, 0, 6.2832); ctx2.stroke(); }
    ctx2.setLineDash([]);
    const layer = (causal, colour) => {
      ctx2.fillStyle = colour; ctx2.beginPath();
      for (const d of pts) if (d.causal === causal) { const [x, y] = sx(d.p.x, d.p.y); ctx2.moveTo(x + 2, y); ctx2.arc(x, y, 2, 0, 6.2832); }
      ctx2.fill();
    };
    if (show !== "causal") layer(false, "rgba(148,163,184,0.45)");
    if (show !== "non") layer(true, "rgba(249,115,22,0.8)");
    ctx2.strokeStyle = "#111"; ctx2.lineWidth = 1.5;
    ctx2.beginPath(); ctx2.arc(cx, cy, 7, 0, 6.2832); ctx2.moveTo(cx - 11, cy); ctx2.lineTo(cx + 11, cy); ctx2.moveTo(cx, cy - 11); ctx2.lineTo(cx, cy + 11); ctx2.stroke();
    ctx2.font = "600 11px ui-sans-serif, system-ui"; ctx2.fillStyle = "#404040"; ctx2.fillText("Field centre", cx + 12, cy - 8);
  }
  const r = responsive(el, (state) => { show = state.show || "both"; draw(); });
  return r;
}

// ------------------------------------------------------------------ box plots (Ch5 B)
export function boxPlots(el, ctx, data) {
  ctx.extra.innerHTML = `<span class="lg"><i style="background:#cbd5e1"></i>Other papers</span><span class="lg"><i style="background:#60a5fa"></i>Causal methods</span>`;
  if (data.status !== "ready") {
    awaiting(el, "Question importance and scope have not been scored yet.",
      "Each abstract's research question is rated 1–10 by an LLM. Run <code>python -m pa_map classify</code> and then <code>python -m pa_map evidence</code>.");
    return { set() {}, destroy() { el.innerHTML = ""; } };
  }
  let panels;
  const r = responsive(el, (state, i, resized) => {
    if (resized || !panels) {
      el.innerHTML = "";
      const [W, H] = size(el);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      panels = {};
      [["importance", "Question Importance"], ["scope", "Question Scope"]].forEach(([key, title], k) => {
        const d = data[key], x0 = (W / 2) * k, pw = W / 2;
        const g = svg.append("g").attr("transform", `translate(${x0},0)`).style("transition", `opacity ${T}ms`);
        const lo = Math.min(d.causal_q[0], d.noncausal_q[0]) - 1, hi = Math.max(d.causal_q[4], d.noncausal_q[4]) + 1;
        const y = d3.scaleLinear([Math.max(1, Math.floor(lo)), Math.min(10, Math.ceil(hi))], [H - 70, 50]);
        g.append("text").attr("x", pw / 2).attr("y", 26).attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 600).text(title);
        g.append("g").attr("transform", `translate(60,0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(pw - 100))).call(axisStyle);
        [["noncausal", "Other Papers", "#cbd5e1", "#e2e8f0"], ["causal", "Causal Methods", "#60a5fa", "#dbeafe"]].forEach(([grp, lab, stroke, fillc], j) => {
          const q = d[`${grp}_q`], cx = 60 + (pw - 100) * (j === 0 ? 0.33 : 0.67), bw = Math.min(70, pw * 0.15);
          g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", y(q[0])).attr("y2", y(q[4])).attr("stroke", stroke);
          g.append("rect").attr("x", cx - bw / 2).attr("width", bw).attr("y", y(q[3])).attr("height", y(q[1]) - y(q[3])).attr("fill", fillc).attr("stroke", stroke);
          g.append("line").attr("x1", cx - bw / 2).attr("x2", cx + bw / 2).attr("y1", y(q[2])).attr("y2", y(q[2])).attr("stroke", stroke).attr("stroke-width", 2);
          g.append("circle").attr("cx", cx).attr("cy", y(d[`${grp}_mean`])).attr("r", 3).attr("fill", stroke);
          g.append("text").attr("x", cx).attr("y", H - 48).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#525252").text(lab);
        });
        g.append("text").attr("x", pw / 2).attr("y", H - 22).attr("text-anchor", "middle").attr("font-size", 10.5).attr("fill", "#737373")
          .text(`p ${d.p < 0.001 ? "< 0.001" : "= " + d.p.toFixed(3)} · d = ${d.cohens_d.toFixed(2)}`);
        panels[key] = g;
      });
    }
    for (const k of ["importance", "scope"]) panels[k].attr("opacity", !state.emph || state.emph === k ? 1 : 0.15);
  });
  return r;
}

// ------------------------------------------------------------------ synthesis lines (Ch6)
export function synthesis(el, ctx, data) {
  const series = [
    ["theory", "Theory-driven", COLORS.theory], ["phenomenon", "Phenomenon-driven", COLORS.phenomenon],
    ["causal", "Causal methods", COLORS.causal], ["coherence", "Semantic coherence (×100)", COLORS.coherence],
  ];
  ctx.extra.innerHTML = series.map(([k, l, c]) => `<span class="lg ${data[k] ? "" : "muted"}"><i style="background:${data[k] ? c : COLORS.pending}"></i>${l}${data[k] ? "" : " · awaiting LLM"}</span>`).join("");
  const tip = tooltip();
  let lines;
  const r = responsive(el, (state, i, resized) => {
    if (resized || !lines) {
      el.innerHTML = "";
      const [W, H] = size(el), mg = { t: 20, r: 20, b: 28, l: 44 };
      const x = d3.scaleLinear([data.years[0], data.years.at(-1)], [mg.l, W - mg.r]);
      const y = d3.scaleLinear([0, 100], [H - mg.b, mg.t]);
      const svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
      svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((d) => d + "%").tickSize(-(W - mg.l - mg.r))).call(axisStyle);
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(Math.min(23, W / 45)).tickFormat(d3.format("d")).tickSize(0)).call(axisStyle).selectAll("text").attr("dy", "1.2em");
      const line = d3.line().defined((d) => d != null).x((d, k) => x(data.years[k])).y((d) => y(d)).curve(d3.curveMonotoneX);
      lines = {};
      for (const [k, , c] of series) if (data[k]) lines[k] = svg.append("path").attr("d", line(data[k])).attr("fill", "none").attr("stroke", c).attr("stroke-width", 2.2).style("transition", `opacity 700ms`);
      svg.append("rect").attr("x", mg.l).attr("y", mg.t).attr("width", W - mg.l - mg.r).attr("height", H - mg.t - mg.b).attr("fill", "transparent")
        .on("mousemove", (e) => { const yy = Math.round(x.invert(d3.pointer(e)[0])); const k = data.years.indexOf(yy); if (k < 0) return;
          tip.show(e, `<div class="t">${yy}</div>` + series.filter(([key]) => data[key]).map(([key, l, c]) => `<span style="color:${c}">${l}: ${data[key][k]?.toFixed(1)}</span>`).join("<br>")); })
        .on("mouseleave", tip.hide);
    }
    for (const k in lines) lines[k].attr("opacity", !state.emph || state.emph === k ? 1 : 0.12);
  });
  return { ...r, destroy() { r.destroy(); tip.remove(); } };
}
