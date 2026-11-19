// Canvas scatter map of all papers (one dot per paper, UMAP coordinates in 0..1).
// Used by Home (static preview), Explore (interactive) and Findings (story mode).
import * as d3 from "d3";

const DIM = "rgba(160,160,160,0.10)";

export function createMap(container, D, opts = {}) {
  const { interactive = true, labels = "macro", pointRadius = 2.1, onHover, onClick } = opts;
  const canvas = document.createElement("canvas");
  if (interactive) {
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Map of papers: each dot is a paper, positioned by similarity of title and abstract. Use the list for keyboard access; arrow keys pan and plus/minus zoom.");
  } else {
    canvas.setAttribute("aria-hidden", "true");
  }
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const P = D.papers;
  let W = 0, H = 0, dpr = 1, sx = new Float32Array(P.length), sy = new Float32Array(P.length);
  let t = d3.zoomIdentity, qt = null;
  let mask = null;                 // Uint8Array, 1 = matches filters
  let story = null;                // Optional theme, year cutoff, and highlighted cohort.
  let selected = null, hovered = null, focusOnLayout = false;
  let projection = null;
  const color = (m) => D.macroById.get(m)?.color || "#888";
  const visible = (i) => story?.yearMax == null || P[i].year <= story.yearMax;
  const active = (i) => (!mask || mask[i]) &&
    (!story?.macros || story.macros.has(P[i].macro)) &&
    (!story?.paperIds || story.paperIds.has(P[i].id)) &&
    (story?.cohortMin == null || P[i].year >= story.cohortMin) &&
    (story?.cohortMax == null || P[i].year <= story.cohortMax);

  function rebuildIndex() {
    if (!interactive || !projection) return;
    const activePoints = d3.range(P.length).filter((i) => visible(i) && active(i));
    qt = d3.quadtree().x((i) => sx[i]).y((i) => sy[i]).addAll(activePoints);
  }

  // label anchors: median position of each macro / subtopic
  const anchors = (key) => {
    const g = d3.group(P, (p) => p[key]);
    return Array.from(g, ([id, ps]) => ({ id, x: d3.median(ps, (p) => p.x), y: d3.median(ps, (p) => p.y) }));
  };
  const macroAnch = anchors("macro"), subAnch = anchors("sub");

  function layout() {
    const r = container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const center = projection && t !== d3.zoomIdentity
      ? [(t.invertX(W / 2) - projection.ox) / projection.s, (t.invertY(H / 2) - projection.oy) / projection.s]
      : null;
    W = Math.max(50, r.width); H = Math.max(50, r.height); dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const pad = Math.min(W, H) * 0.06 + 10, s = Math.min(W - 2 * pad, H - 2 * pad);
    const ox = (W - s) / 2, oy = (H - s) / 2;
    projection = { ox, oy, s };
    for (let i = 0; i < P.length; i++) { sx[i] = ox + P[i].x * s; sy[i] = oy + P[i].y * s; }
    rebuildIndex();
    if (focusOnLayout) {
      focusOnLayout = false;
      focusPaper();
    } else if (center && zoom) {
      const x = ox + center[0] * s, y = oy + center[1] * s;
      d3.select(canvas).interrupt().call(zoom.transform, d3.zoomIdentity.translate(W / 2 - x * t.k, H / 2 - y * t.k).scale(t.k));
    } else {
      draw();
    }
  }

  function draw() {
    if (!projection) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(t.x, t.y); ctx.scale(t.k, t.k);
    const r = pointRadius / Math.sqrt(t.k) * (t.k > 1 ? 1.25 : 1);
    // pass 1: dimmed
    ctx.fillStyle = DIM;
    ctx.beginPath();
    for (let i = 0; i < P.length; i++) if (visible(i) && !active(i)) { ctx.moveTo(sx[i] + r, sy[i]); ctx.arc(sx[i], sy[i], r, 0, 6.2832); }
    ctx.fill();
    // optional glow for story highlights
    if (story && story.macros) {
      ctx.globalAlpha = 0.10;
      for (const m of story.macros) {
        ctx.fillStyle = color(m); ctx.beginPath();
        for (let i = 0; i < P.length; i++) if (P[i].macro === m && visible(i) && active(i)) { ctx.moveTo(sx[i] + r * 3, sy[i]); ctx.arc(sx[i], sy[i], r * 3, 0, 6.2832); }
        ctx.fill();
      }
    }
    // pass 2: active, batched by colour
    ctx.globalAlpha = 0.6;
    const byColor = d3.group(d3.range(P.length).filter((i) => visible(i) && active(i)), (i) => P[i].macro);
    for (const [m, idx] of byColor) {
      ctx.fillStyle = color(m); ctx.beginPath();
      for (const i of idx) { ctx.moveTo(sx[i] + r, sy[i]); ctx.arc(sx[i], sy[i], r, 0, 6.2832); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const [i, style] of [[hovered, "#555"], [selected, "#0a0a0a"]]) {
      if (i == null) continue;
      ctx.beginPath(); ctx.arc(sx[i], sy[i], 6.5 / t.k, 0, 6.2832);
      ctx.lineWidth = 2 / t.k; ctx.strokeStyle = style; ctx.stroke();
    }
    ctx.restore();
    if (labels) drawLabels();
  }

  function pill(text, x, y, bg) {
    ctx.font = "500 11.5px ui-sans-serif, system-ui, sans-serif";
    const w = ctx.measureText(text).width + 16, h = 22;
    x = Math.min(Math.max(x, w / 2 + 4), W - w / 2 - 4);   // keep labels inside the canvas
    ctx.globalAlpha = 0.86; ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 0.5);
  }

  function drawLabels() {
    const showSub = t.k >= 2.6;
    const list = showSub ? subAnch : macroAnch;
    const placed = [];
    for (const a of list) {
      const m = showSub ? D.subById.get(a.id)?.macro : a.id;
      if (story && story.macros && !story.macros.has(m)) continue;
      const bx = projection.ox + a.x * projection.s, by = projection.oy + a.y * projection.s;
      const x = t.x + bx * t.k, y = t.y + by * t.k;
      if (x < 0 || y < 0 || x > W || y > H) continue;
      if (placed.some(([px, py]) => Math.abs(px - x) < 120 && Math.abs(py - y) < 24)) continue;
      placed.push([x, y]);
      const label = showSub ? D.subById.get(a.id)?.label : D.macroById.get(a.id)?.label;
      pill(trim(label, 34), x, y, d3.color(color(m)).darker(0.6).formatHex());
    }
  }
  const trim = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

  function pick(mx, my) {
    const [x, y] = t.invert([mx, my]);
    return qt?.find(x, y, 9 / t.k) ?? null;
  }

  function focusPaper() {
    const k = Math.max(t.k, 4);
    d3.select(canvas).transition().duration(600)
      .call(zoom.transform, d3.zoomIdentity.translate(W / 2 - sx[selected] * k, H / 2 - sy[selected] * k).scale(k));
  }

  let zoom = null;
  if (interactive) {
    zoom = d3.zoom().scaleExtent([1, 24]).on("zoom", (e) => { t = e.transform; draw(); });
    d3.select(canvas).call(zoom).on("dblclick.zoom", null);
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      const i = pick(e.clientX - r.left, e.clientY - r.top);
      if (i !== hovered) { hovered = i; draw(); onHover?.(i == null ? null : P[i], e.clientX - r.left, e.clientY - r.top); }
    });
    canvas.addEventListener("mouseleave", () => { hovered = null; draw(); onHover?.(null); });
    canvas.addEventListener("click", (e) => {
      const r = canvas.getBoundingClientRect();
      const i = pick(e.clientX - r.left, e.clientY - r.top);
      if (i != null) onClick?.(P[i]);
    });
    canvas.addEventListener("keydown", (e) => {
      const step = 60, sel = d3.select(canvas);
      const k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (k) { e.preventDefault(); sel.transition().duration(150).call(zoom.translateBy, k[0] / t.k, k[1] / t.k); }
      if (e.key === "+" || e.key === "=") sel.transition().duration(200).call(zoom.scaleBy, 1.5);
      if (e.key === "-") sel.transition().duration(200).call(zoom.scaleBy, 1 / 1.5);
      if (e.key === "0") sel.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(container);
  layout();

  return {
    setMask(m) {
      mask = m;
      hovered = null;
      onHover?.(null);
      rebuildIndex();
      draw();
    },
    setStory(s) { story = s; rebuildIndex(); draw(); },
    select(p, focus = false) {
      selected = p ? p.i : null;
      const shouldFocus = p && focus && zoom;
      focusOnLayout = Boolean(shouldFocus && (!projection || !container.clientWidth || !container.clientHeight));
      if (shouldFocus && !focusOnLayout) {
        focusPaper();
      } else draw();
    },
    zoomBy(f) { zoom && d3.select(canvas).transition().duration(250).call(zoom.scaleBy, f); },
    reset() { zoom && d3.select(canvas).transition().duration(400).call(zoom.transform, d3.zoomIdentity); },
    destroy() { ro.disconnect(); d3.select(canvas).interrupt(); canvas.remove(); },
  };
}
