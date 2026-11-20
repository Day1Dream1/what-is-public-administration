// Chapter 1 semantic map: fixed UMAP coordinates, cumulative years driven by scroll progress
// (hold 2025 → rewind to 1980 → run to 1995 → run to 2025 → reader control), new dots grow in
// over ~1 s, labels glide to the centroid of visible papers, growth halos for the fastest-growing
// themes (last 5 years vs the 5 before). Mirrors the map-* steps of What is Strategy? Chapter 1.
import * as d3 from "d3";
import { esc } from "../data.js";

export function storyMap(el, ctx, D) {
  const P = D.papers;
  const Y0 = d3.min(P, (p) => p.year), Y1 = d3.max(P, (p) => p.year);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Semantic map: each dot is a paper, coloured by research theme. The map shows papers published up to the year shown at the top right.");
  el.appendChild(canvas);
  el.classList.add("canvas-viz");
  const tip = document.createElement("div");
  tip.className = "tooltip"; tip.hidden = true; el.appendChild(tip);
  const g2 = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, sx = new Float32Array(P.length), sy = new Float32Array(P.length), qt;
  const vis = new Uint8Array(P.length);               // 1 = shown at the current year
  const born = new Float64Array(P.length);            // time a dot appeared (ms); 0 = long ago
  let year = Y1, halos = false, manual = null, playing = null, raf = 0, ready = false;
  const labelPos = new Map();                          // macro -> {x,y} eased

  function layout() {
    const r = el.getBoundingClientRect();
    W = r.width; H = r.height; dpr = devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    // fill the stage like the reference: stretch to the frame, but no wider than 1.8 : 1
    const pad = 28, hs = H - 2 * pad, ws = Math.min(W - 2 * pad, hs * 1.8), ox = (W - ws) / 2, oy = pad;
    for (let i = 0; i < P.length; i++) { sx[i] = ox + P[i].x * ws; sy[i] = oy + P[i].y * hs; }
    qt = d3.quadtree().x((i) => sx[i]).y((i) => sy[i]).addAll(d3.range(P.length));
    labelPos.clear();
  }

  function setYear(y) {
    y = Math.round(y);
    if (y === year && ready) return;
    ready = true;
    const now = performance.now();
    for (let i = 0; i < P.length; i++) {
      if (P[i].year <= y) { if (!vis[i]) { vis[i] = 1; born[i] = year < y ? now : 0; } }
      else vis[i] = 0;
    }
    year = y;
    ctx.setValue(String(y));
    kick();
  }

  function growth() {
    const cur = new Map(), prev = new Map();
    for (const p of P) {
      if (p.year > year - 5 && p.year <= year) cur.set(p.macro, (cur.get(p.macro) || 0) + 1);
      else if (p.year > year - 10 && p.year <= year - 5) prev.set(p.macro, (prev.get(p.macro) || 0) + 1);
    }
    return [...cur.keys()].map((m) => [m, (cur.get(m) || 0) - (prev.get(m) || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter((d) => d[1] > 0).map((d) => d[0]);
  }

  function draw(now) {
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, W, H);
    let animating = false;
    // halos under the dots
    const top = halos && W > 700 ? growth() : [];
    const cent = new Map();
    for (let i = 0; i < P.length; i++) if (vis[i]) {
      const c = cent.get(P[i].macro) || { x: 0, y: 0, n: 0, rx: 0, ry: 0, rn: 0 };
      c.x += sx[i]; c.y += sy[i]; c.n++;
      if (P[i].year > year - 5) { c.rx += sx[i]; c.ry += sy[i]; c.rn++; }
      cent.set(P[i].macro, c);
    }
    for (const m of top) {
      const c = cent.get(m); if (!c || !c.rn) continue;
      const x = c.rx / c.rn, y = c.ry / c.rn, col = d3.color(D.macroById.get(m).color);
      const gr = g2.createRadialGradient(x, y, 0, x, y, 90);
      col.opacity = 0.28; gr.addColorStop(0, col.formatRgb()); col.opacity = 0; gr.addColorStop(1, col.formatRgb());
      g2.fillStyle = gr; g2.beginPath(); g2.arc(x, y, 90, 0, 6.2832); g2.fill();
    }
    // dots, batched by colour; growing ones drawn individually
    const groups = new Map();
    for (let i = 0; i < P.length; i++) {
      if (!vis[i]) continue;
      const age = (now - born[i]) / 1000;
      if (age < 1) {
        animating = true;
        const k = Math.max(0, age);
        g2.globalAlpha = 0.55 * k; g2.fillStyle = D.macroById.get(P[i].macro).color;
        g2.beginPath(); g2.arc(sx[i], sy[i], 1 + 1.2 * k, 0, 6.2832); g2.fill();
        continue;
      }
      if (!groups.has(P[i].macro)) groups.set(P[i].macro, []);
      groups.get(P[i].macro).push(i);
    }
    g2.globalAlpha = 0.55;
    for (const [m, idx] of groups) {
      g2.fillStyle = D.macroById.get(m).color; g2.beginPath();
      for (const i of idx) { g2.moveTo(sx[i] + 2.2, sy[i]); g2.arc(sx[i], sy[i], 2.2, 0, 6.2832); }
      g2.fill();
    }
    g2.globalAlpha = 1;
    // labels glide towards the centroid of visible papers
    g2.font = "500 11.5px ui-sans-serif, system-ui, sans-serif";
    for (const [m, c] of cent) {
      if (c.n < 8) continue;
      const tx = c.x / c.n, ty = c.y / c.n;
      const lp = labelPos.get(m) || { x: tx, y: ty };
      lp.x += (tx - lp.x) * 0.12; lp.y += (ty - lp.y) * 0.12;
      if (Math.abs(tx - lp.x) > 0.5 || Math.abs(ty - lp.y) > 0.5) animating = true;
      labelPos.set(m, lp);
      const t = D.macroById.get(m);
      const text = t.label.length > 30 ? t.label.slice(0, 29) + "…" : t.label;
      const w = g2.measureText(text).width + 16, x = Math.min(Math.max(lp.x, w / 2 + 4), W - w / 2 - 4);
      g2.globalAlpha = 0.88; g2.fillStyle = d3.color(t.color).darker(0.7).formatHex();
      g2.beginPath(); g2.roundRect(x - w / 2, lp.y - 11, w, 22, 7); g2.fill();
      g2.globalAlpha = 1; g2.fillStyle = "#fff"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.fillText(text, x, lp.y + 0.5);
    }
    if (animating) raf = requestAnimationFrame(draw); else raf = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const i = qt.find(mx, my, 8);
    if (i == null || !vis[i]) { tip.hidden = true; return; }
    const p = P[i];
    tip.hidden = false;
    tip.innerHTML = `<div class="t">${esc(p.title)}</div><div class="muted">${esc(p.authors.split(",")[0])}${p.authors.includes(",") ? " et al." : ""} · ${p.year} · ${esc(D.macroById.get(p.macro).label)}</div>`;
    tip.style.left = Math.min(mx + 14, W - 310) + "px"; tip.style.top = my + 14 + "px";
  });
  canvas.addEventListener("mouseleave", () => (tip.hidden = true));

  const ro = new ResizeObserver(() => { layout(); kick(); });
  ro.observe(el);
  layout();
  setYear(Y1);

  // scroll mapping (fractions of the section) — same breakpoints as the reference
  function fromProgress(p) {
    if (p < 0.22) return Y1;
    if (p < 0.42) return Y1 - (Y1 - Y0) * ((p - 0.22) / 0.2);
    if (p < 0.56) return Y0 + (1995 - Y0) * ((p - 0.42) / 0.14);
    if (p < 0.82) return 1995 + (Y1 - 1995) * ((p - 0.56) / 0.26);
    return Y1;
  }

  const api = {
    set(state) {
      halos = !!state.halos;
      if (!state.controls) { manual = null; stop(); }
      kick();
    },
    progress(p) {
      if (manual != null) return;
      setYear(fromProgress(p));
    },
    // reader controls for the last step
    play(onTick) {
      if (playing) { stop(); return false; }
      manual = year >= Y1 ? Y0 : year;
      setYear(manual);
      playing = setInterval(() => {
        manual = Math.min(Y1, manual + 1); setYear(manual); onTick?.(manual);
        if (manual >= Y1) stop();
      }, 200);
      return true;
    },
    seek(y) { stop(); manual = y; setYear(y); },
    years: [Y0, Y1],
    destroy() { stop(); ro.disconnect(); cancelAnimationFrame(raf); el.innerHTML = ""; },
  };
  function stop() { if (playing) { clearInterval(playing); playing = null; el.dispatchEvent(new CustomEvent("map-stop")); } }
  return api;
}

// Controls mounted inside the last step card.
export function mountMapControls(card, viz) {
  const [y0, y1] = viz.years;
  const box = document.createElement("div");
  box.className = "map-controls";
  box.innerHTML = `<button class="play" aria-label="Play the map from ${y0}">▶</button>
    <div class="rng"><input type="range" min="${y0}" max="${y1}" value="${y1}" aria-label="Year"><div class="ticks"><span>${y0}</span><span>2000</span><span>${y1}</span></div></div>
    <b class="yr">${y1}</b>`;
  card.querySelector(".step-text").appendChild(box);
  const btn = box.querySelector(".play"), range = box.querySelector("input"), yr = box.querySelector(".yr");
  const tick = (y) => { range.value = y; yr.textContent = y; };
  btn.addEventListener("click", () => {
    const on = viz.play(tick);
    btn.textContent = on ? "❚❚" : "▶";
    btn.setAttribute("aria-label", on ? "Pause" : "Play");
  });
  card.closest(".story").querySelector(".viz").addEventListener("map-stop", () => { btn.textContent = "▶"; btn.setAttribute("aria-label", "Play"); });
  range.addEventListener("input", () => { viz.seek(+range.value); tick(+range.value); btn.textContent = "▶"; });
}
