import * as d3 from "d3";
import { denominators, esc, fmt, pct } from "../data.js";
import { setParams } from "../router.js";

export function render(root, D, params) {
  const m = D.manifest, th = m.thresholds;
  const [start, end] = m.window;
  const comparisonStart = Math.max(start, m.comparison_start);
  const periods = [["all", comparisonStart, end], ["p1", comparisonStart, Math.min(2010, end)],
    ["p2", Math.max(comparisonStart, 2011), Math.min(2020, end)], ["p3", Math.max(comparisonStart, 2021), end]]
    .filter(([, first, last]) => first <= last);
  const st = {
    measure: params.get("measure") === "count" ? "count" : "share",
    journal: D.jcodes.includes(params.get("journal")) ? params.get("journal") : "ALL",
    period: start < comparisonStart && params.get("period") === "comparison" ? "comparison" : "full",
    cmp: periods.some(([key]) => key === params.get("cmp")) ? params.get("cmp") : "all",
  };
  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 40px">
    <p class="kicker">Trends</p>
    <h1 class="title">How the field's themes grew and shrank</h1>
    <p class="dek">Each theme's share of the papers published in a given year. Every point shows its own denominator; years with few papers or low abstract coverage are marked.</p>
  </div></section>
  <section class="section" style="padding-top:32px"><div class="container">
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Measure" id="measure">
        <button data-v="share">% of papers</button><button data-v="count"># of papers</button></div>
      <div class="seg" role="group" aria-label="Journal" id="journal">
        <button data-v="ALL">All five</button>${D.jcodes.map((j) => `<button data-v="${j}" title="${esc(D.journalName[j])}">${j}</button>`).join("")}</div>
      ${start < comparisonStart ? `<div class="seg" role="group" aria-label="Period" id="period">
        <button data-v="full">${start}–${end}</button><button data-v="comparison">${comparisonStart}–${end}</button></div>` : ""}
    </div>
    <h2 class="section-title" style="font-size:22px">How many papers, and how many had abstracts?</h2>
    <p class="section-sub" id="den-sub"></p>
    <div class="chart" id="den"></div>
    <div class="legend-inline" style="margin:8px 0 40px">
      <span><span class="sw" style="background:#525252"></span>Title + abstract</span>
      <span><span class="sw" style="background:#d4d4d4"></span>Title only</span>
      <span><span class="sw" style="background:repeating-linear-gradient(135deg,#f3f4f6 0 3px,#e5e7eb 3px 5px)"></span>Journal not yet published</span>
      <span><span class="sw" style="border:1.5px dashed #ef4444;height:10px"></span>Data gap</span>
      <span>▲ abstract coverage &lt; ${pct(th.low_coverage_threshold, 0)} or fewer than ${th.min_denominator} papers</span>
    </div>
    <h2 class="section-title" style="font-size:22px">Themes over time</h2>
    <p class="section-sub">Line = 3-year rolling average; dots = single years. Hollow dots are flagged years (see legend above). Hover for counts and denominators.</p>
    <div class="sm-grid" id="sm"></div>
  </div></section>
  <section class="section"><div class="container">
    <h2 class="section-title">Five journals compared</h2>
    <p class="section-sub">Share of each journal's papers in each theme, from ${comparisonStart} to ${end}.</p>
    <div class="toolbar"><div class="seg" role="group" aria-label="Comparison period" id="cmp">
      ${periods.map(([key, first, last]) => `<button data-v="${key}">${first}–${last}</button>`).join("")}</div></div>
    <div class="scroll-x"><table class="heat" id="heat"></table></div>
    <p class="note" id="heat-note"></p>
  </div></section>`;

  const $ = (s) => root.querySelector(s);
  const tip = document.createElement("div");
  tip.className = "tooltip"; tip.hidden = true; tip.style.position = "fixed";
  document.body.appendChild(tip);
  const showTip = (e, html) => { tip.hidden = false; tip.innerHTML = html; tip.style.left = Math.min(e.clientX + 14, innerWidth - 300) + "px"; tip.style.top = e.clientY + 14 + "px"; };
  const hideTip = () => (tip.hidden = true);

  function segs() {
    for (const k of ["measure", "journal", "period", "cmp"])
      root.querySelectorAll(`#${k} button`).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === st[k]));
  }
  for (const k of ["measure", "journal", "period", "cmp"])
    $(`#${k}`)?.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st[k] = b.dataset.v; draw(); });

  function draw() {
    segs();
    const p = new URLSearchParams();
    if (st.measure !== "share") p.set("measure", st.measure);
    if (st.journal !== "ALL") p.set("journal", st.journal);
    if (st.period !== "full") p.set("period", st.period);
    if (st.cmp !== "all") p.set("cmp", st.cmp);
    setParams(p);
    const js = st.journal === "ALL" ? D.jcodes : [st.journal];
    const y0 = st.period === "full" ? start : comparisonStart, y1 = end;
    const years = d3.range(y0, y1 + 1);
    const { den, abs } = denominators(D, js, y0, y1);
    const cnt = new Map();   // `${year}|${macro}` -> n
    for (const pp of D.papers) if (js.includes(pp.journal) && pp.year >= y0 && pp.year <= y1) {
      const k = `${pp.year}|${pp.macro}`; cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    const flagged = (y) => (den.get(y) || 0) < th.min_denominator || (den.get(y) ? abs.get(y) / den.get(y) < th.low_coverage_threshold : false);
    const status = (y) => {
      const rows = D.coverage.filter((c) => js.includes(c.journal) && c.year === y);
      if (rows.every((c) => c.status === "not_launched")) return "not_launched";
      if (rows.some((c) => c.status === "gap")) return "gap";
      return "ok";
    };
    const total = d3.sum(years, (y) => den.get(y) || 0), totalAbs = d3.sum(years, (y) => abs.get(y) || 0);
    $("#den-sub").innerHTML = `${fmt(total)} papers in ${st.journal === "ALL" ? "the five journals" : esc(D.journalName[st.journal])}, ${y0}–${y1}; ${pct(totalAbs / total, 0)} have an abstract. These counts are the denominators of every share below.`;
    drawDen($("#den"), years, den, abs, status, flagged);
    drawSmall($("#sm"), years, den, abs, cnt, flagged);
    drawHeat();
  }

  function drawDen(el, years, den, abs, status, flagged) {
    const W = el.clientWidth || 900, H = 170, mg = { t: 10, r: 8, b: 26, l: 40 };
    const x = d3.scaleBand(years, [mg.l, W - mg.r]).padding(0.18);
    const y = d3.scaleLinear([0, d3.max(years, (yy) => den.get(yy) || 0) || 1], [H - mg.b, mg.t]).nice();
    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
      .attr("aria-label", "Bar chart: papers per year, split into papers with and without abstracts");
    svg.append("defs").html(`<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f3f4f6"/><line x1="0" y1="0" x2="0" y2="5" stroke="#e5e7eb" stroke-width="2.5"/></pattern>`);
    svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - mg.l - mg.r)))
      .call((g) => g.select(".domain").remove()).call((g) => g.selectAll("line").attr("stroke", "#f0f0f0"));
    const g = svg.append("g");
    for (const yy of years) {
      const s = status(yy), n = den.get(yy) || 0, a = abs.get(yy) || 0, bx = x(yy), bw = x.bandwidth();
      if (s === "not_launched") { g.append("rect").attr("x", bx).attr("y", mg.t).attr("width", bw).attr("height", H - mg.b - mg.t).attr("fill", "url(#hatch)"); continue; }
      if (s === "gap") g.append("rect").attr("x", bx).attr("y", y(0) - 24).attr("width", bw).attr("height", 24).attr("fill", "none").attr("stroke", "#ef4444").attr("stroke-dasharray", "3 2");
      g.append("rect").attr("x", bx).attr("y", y(n)).attr("width", bw).attr("height", y(0) - y(n)).attr("fill", "#d4d4d4");
      g.append("rect").attr("x", bx).attr("y", y(a)).attr("width", bw).attr("height", y(0) - y(a)).attr("fill", "#525252");
      if (flagged(yy) && n) g.append("text").attr("x", bx + bw / 2).attr("y", y(n) - 3).attr("text-anchor", "middle").style("fill", "#d97706").style("font-size", "8px").text("▲");
      g.append("rect").attr("x", bx).attr("y", mg.t).attr("width", bw).attr("height", H - mg.b - mg.t).attr("fill", "transparent")
        .on("mousemove", (e) => showTip(e, `<div class="t">${yy}</div>${s === "gap" ? '<div style="color:#ef4444">Data gap: check publisher table of contents</div>' : ""}${fmt(n)} papers · ${fmt(a)} with abstract (${pct(n ? a / n : null, 0)})`))
        .on("mouseleave", hideTip);
    }
    svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).tickValues(years.filter((yy) => yy % 5 === 0)).tickSize(0))
      .call((g2) => g2.select(".domain").attr("stroke", "#e5e5e5")).selectAll("text").attr("dy", "1.2em");
    el.replaceChildren(svg.node());
  }

  function drawSmall(el, years, den, abs, cnt, flagged) {
    const share = st.measure === "share";
    const series = D.topics.macro.map((t) => {
      const pts = years.map((yy) => { const n = cnt.get(`${yy}|${t.id}`) || 0, d = den.get(yy) || 0; return { year: yy, n, d, a: abs.get(yy) || 0, v: share ? (d ? n / d : null) : n }; });
      const roll = pts.map((p, i) => {
        const w = pts.slice(Math.max(0, i - 1), i + 2).filter((q) => q.d > 0);
        if (!w.length || !p.d) return null;
        return share ? d3.sum(w, (q) => q.n) / d3.sum(w, (q) => q.d) : d3.mean(w, (q) => q.n);
      });
      return { t, pts, roll, total: d3.sum(pts, (p) => p.n) };
    });
    const yMaxAll = d3.max(series, (s) => d3.max(s.pts, (p) => p.v ?? 0)) || 1;
    el.innerHTML = "";
    for (const s of series) {
      const card = document.createElement("div");
      card.className = "sm-card";
      const valid = s.pts.filter((p) => p.d > 0);
      const last = valid.slice(-10), prev = valid.slice(-20, -10);
      const rate = (arr) => (share ? d3.sum(arr, (p) => p.n) / (d3.sum(arr, (p) => p.d) || 1) : d3.mean(arr, (p) => p.n));
      const ch = prev.length ? rate(last) - rate(prev) : 0, rel = prev.length && rate(prev) ? ch / rate(prev) : 0;
      const arrow = rel > 0.15 ? ["↗", "#059669"] : rel < -0.15 ? ["↘", "#dc2626"] : ["→", "#9ca3af"];
      const peak = d3.greatest(valid.filter((p) => !flagged(p.year)), (p) => p.v);
      card.innerHTML = `<div class="h"><div><div class="name" style="color:${s.t.color}">${esc(s.t.label)}</div><div class="sub">${fmt(s.total)} papers</div></div>
        <span class="arrow" style="color:${arrow[1]}" title="Last 10 years vs previous 10">${arrow[0]}</span></div><div class="chart"></div>
        <div class="f"><span>Peak: ${peak ? peak.year : "–"}</span><span>${share ? `${pct(rate(last))} of papers, last 10 yrs` : `${d3.format(".1f")(rate(last) || 0)} papers/yr, last 10 yrs`}</span></div>`;
      el.appendChild(card);
      const W = 260, H = 110, mg = { t: 8, r: 6, b: 18, l: 30 };
      const x = d3.scaleLinear([years[0], years.at(-1)], [mg.l, W - mg.r]);
      const y = d3.scaleLinear([0, yMaxAll], [H - mg.b, mg.t]).nice();
      const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
        .attr("aria-label", `${s.t.label}: ${share ? "share" : "number"} of papers per year`);
      svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(3).tickSize(-(W - mg.l - mg.r)).tickFormat(share ? d3.format(".0%") : d3.format("~s")))
        .call((g) => g.select(".domain").remove()).call((g) => g.selectAll("line").attr("stroke", "#f3f3f3"));
      svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(3).tickFormat(d3.format("d")).tickSize(0))
        .call((g) => g.select(".domain").attr("stroke", "#e5e5e5")).selectAll("text").attr("dy", "1.1em");
      const area = d3.area().defined((d, i) => s.roll[i] != null).x((d) => x(d.year)).y0(y(0)).y1((d, i) => y(s.roll[i])).curve(d3.curveMonotoneX);
      const line = area.lineY1();
      svg.append("path").attr("d", area(s.pts)).attr("fill", s.t.color).attr("opacity", 0.1);
      svg.append("path").attr("d", line(s.pts)).attr("fill", "none").attr("stroke", s.t.color).attr("stroke-width", 1.6);
      svg.append("g").selectAll("circle").data(valid).join("circle").attr("cx", (d) => x(d.year)).attr("cy", (d) => y(d.v)).attr("r", 1.8)
        .attr("fill", (d) => (flagged(d.year) ? "#fff" : s.t.color)).attr("stroke", s.t.color).attr("stroke-width", (d) => (flagged(d.year) ? 1 : 0)).attr("opacity", 0.75);
      const hover = svg.append("line").attr("y1", mg.t).attr("y2", H - mg.b).attr("stroke", "#a3a3a3").attr("stroke-dasharray", "2 2").attr("opacity", 0);
      svg.append("rect").attr("x", mg.l).attr("y", mg.t).attr("width", W - mg.l - mg.r).attr("height", H - mg.t - mg.b).attr("fill", "transparent")
        .on("mousemove", (e) => {
          const [mx] = d3.pointer(e); const yy = Math.round(x.invert(mx)); const p = s.pts.find((q) => q.year === yy);
          if (!p) return;
          hover.attr("x1", x(yy)).attr("x2", x(yy)).attr("opacity", 1);
          showTip(e, `<div class="t">${esc(s.t.label)} · ${yy}</div>${p.d ? `${fmt(p.n)} of ${fmt(p.d)} papers (${pct(p.n / p.d)})<br>Abstract coverage ${pct(p.a / p.d, 0)}${flagged(yy) ? '<br><span style="color:#d97706">▲ flagged year</span>' : ""}` : "No papers this year"}`);
        })
        .on("mouseleave", () => { hover.attr("opacity", 0); hideTip(); });
      card.querySelector(".chart").appendChild(svg.node());
    }
  }

  function drawHeat() {
    const [, a, b] = periods.find(([key]) => key === st.cmp);
    const n = new Map(), tot = new Map(), ab = new Map();
    for (const p of D.papers) if (p.year >= a && p.year <= b) {
      n.set(`${p.journal}|${p.macro}`, (n.get(`${p.journal}|${p.macro}`) || 0) + 1);
      tot.set(p.journal, (tot.get(p.journal) || 0) + 1); ab.set(p.journal, (ab.get(p.journal) || 0) + p.hasAbstract);
    }
    const maxShare = d3.max(D.topics.macro, (t) => d3.max(D.jcodes, (j) => (n.get(`${j}|${t.id}`) || 0) / (tot.get(j) || 1))) || 1;
    $("#heat").innerHTML = `<thead><tr><th>Theme</th>${D.jcodes.map((j) => `<th class="c" title="${esc(D.journalName[j])}">${j}</th>`).join("")}</tr></thead><tbody>
      ${D.topics.macro.map((t) => `<tr><td class="lab"><span class="dot" style="background:${t.color}"></span> ${esc(t.label)}</td>${D.jcodes.map((j) => {
        const count = n.get(`${j}|${t.id}`) || 0, denominator = tot.get(j) || 0;
        if (!denominator) return `<td title="No mapped ${j} papers in this period">–</td>`;
        const v = count / denominator;
        const c = d3.color(t.color); c.opacity = 0.08 + 0.72 * (v / maxShare);
        return `<td style="background:${c.formatRgb()};color:${v / maxShare > 0.8 ? "#fff" : "inherit"}" title="${fmt(count)} of ${fmt(denominator)} ${j} papers">${pct(v, 0)}</td>`;
      }).join("")}</tr>`).join("")}
      <tr><td class="lab muted">Papers (denominator)</td>${D.jcodes.map((j) => `<td class="muted">${fmt(tot.get(j) || 0)}</td>`).join("")}</tr>
      <tr><td class="lab muted">Abstract coverage</td>${D.jcodes.map((j) => `<td class="muted">${pct(tot.get(j) ? ab.get(j) / tot.get(j) : null, 0)}</td>`).join("")}</tr></tbody>`;
    $("#heat-note").textContent = `Shares are computed within each journal for ${a}–${b}. Displayed percentages are rounded.`;
  }

  draw();
  const onResize = () => { clearTimeout(onResize.t); onResize.t = setTimeout(draw, 150); };
  addEventListener("resize", onResize);
  return () => { clearTimeout(onResize.t); removeEventListener("resize", onResize); tip.remove(); };
}
