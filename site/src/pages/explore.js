import { esc, fmt } from "../data.js";
import { ICON } from "../icons.js";
import { createMap } from "../map.js";
import { paperLink, setParams } from "../router.js";

const PAGE = 100;
let api = null;

export function render(root, D, params) {
  const m = D.manifest;
  const yMin = m.window[0], yMax = m.window[1];
  const st = { q: "", journals: new Set(D.jcodes), y0: yMin, y1: yMax, theme: "", sort: "new", paper: null, shown: PAGE, view: "list" };

  const yearOpts = (sel) => Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i)
    .map((y) => `<option value="${y}" ${y === sel ? "selected" : ""}>${y}</option>`).join("");
  root.innerHTML = `
  <div class="explore" data-view="list">
    <h1 class="sr-only">Explore the map of papers</h1>
    <div class="filters" role="search">
      <div class="search"><label class="sr-only" for="q">Search title, author or DOI</label>
        <input id="q" type="search" placeholder="Search title, author or DOI" autocomplete="off"></div>
      <div class="group" role="group" aria-label="Journals">${D.jcodes.map((j) =>
        `<button class="chip" data-j="${j}" aria-pressed="true" title="${esc(D.journalName[j])}">${j}</button>`).join("")}</div>
      <div class="group"><span class="field-label" id="yl">Years</span>
        <select id="y0" aria-label="From year">${yearOpts(yMin)}</select><span class="muted">–</span>
        <select id="y1" aria-label="To year">${yearOpts(yMax)}</select></div>
      <div class="group"><label class="field-label" for="theme">Theme</label>
        <select id="theme"><option value="">All themes</option>${D.topics.macro.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join("")}</select></div>
      <button class="btn-ghost btn" id="reset" style="padding:6px 14px">Reset</button>
      <div class="seg view-toggle" role="group" aria-label="View"><button data-v="list" aria-pressed="true">List</button><button data-v="map" aria-pressed="false">Map</button></div>
    </div>
    <div class="explore-body">
      <div class="map-wrap" id="mapwrap">
        <div class="map-tools"><button id="zin" aria-label="Zoom in">+</button><button id="zout" aria-label="Zoom out">−</button><button id="zreset" aria-label="Reset zoom" style="font-size:12px">⟲</button></div>
        <div class="map-legend" role="group" aria-label="Themes (click to filter)">${D.topics.macro.map((t) =>
          `<button data-m="${t.id}" aria-pressed="true"><span class="dot" style="background:${t.color}"></span>${esc(t.label)}${t.reviewed ? "" : ' <span class="muted" title="Label not yet reviewed">*</span>'}</button>`).join("")}</div>
        <div class="tooltip" id="tip" hidden></div>
      </div>
      <div class="list-pane">
        <div class="list-head"><span id="count" aria-live="polite"></span>
          <label class="sr-only" for="sort">Sort</label>
          <select id="sort" style="font-size:12.5px;padding:4px 8px"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="cited">Most cited</option></select></div>
        <div class="list" id="list"></div>
        <div class="detail" id="detail" hidden></div>
      </div>
    </div>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const tip = $("#tip");
  const map = createMap($("#mapwrap"), D, {
    onHover: (p, x, y) => {
      if (!p) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.innerHTML = `<div class="t">${esc(p.title)}</div><div class="muted">${p.journal} · ${p.year} · ${esc(D.macroById.get(p.macro)?.label)}</div>`;
      const w = $("#mapwrap").clientWidth;
      tip.style.left = Math.max(4, Math.min(x + 14, w - tip.offsetWidth - 4)) + "px";
      tip.style.top = (y + 14) + "px";
    },
    onClick: (p) => openPaper(p, false),
  });
  $("#mapwrap").insertBefore(root.querySelector("canvas"), $(".map-tools"));

  let matches = [];
  let previousView = "list";
  let returnToMap = false;

  function setView(view) {
    st.view = view;
    $(".explore").dataset.view = view;
    root.querySelectorAll("[data-v]").forEach((button) => button.setAttribute("aria-pressed", button.dataset.v === view));
  }

  function apply() {
    const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    const mask = new Uint8Array(D.papers.length);
    matches = [];
    for (const p of D.papers) {
      if (!st.journals.has(p.journal) || p.year < st.y0 || p.year > st.y1) continue;
      if (st.theme !== "" && p.macro !== +st.theme) continue;
      if (terms.length && !terms.every((t) => p.hay.includes(t))) continue;
      mask[p.i] = 1; matches.push(p);
    }
    const s = st.sort;
    matches.sort(s === "cited" ? (a, b) => b.cited - a.cited : s === "old" ? (a, b) => a.year - b.year : (a, b) => b.year - a.year);
    if (terms.length) {   // titles that contain the whole query first
      const q = st.q.toLowerCase();
      matches.sort((a, b) => (b.title.toLowerCase().includes(q)) - (a.title.toLowerCase().includes(q)));
    }
    map.setMask(mask);
    st.shown = PAGE;
    if (st.paper && !mask[D.byId.get(st.paper).i]) clearPaper();
    renderList();
    syncUrl();
    root.querySelectorAll(".map-legend button").forEach((b) => b.setAttribute("aria-pressed", st.theme === "" || +st.theme === +b.dataset.m ? "true" : "false"));
  }

  function renderList() {
    const filtered = !(st.q === "" && st.journals.size === D.jcodes.length && st.y0 === yMin && st.y1 === yMax && st.theme === "");
    $("#count").textContent = `${fmt(matches.length)} ${matches.length === 1 ? "paper" : "papers"}${filtered ? " match" : ""}`;
    const list = $("#list");
    if (!matches.length) {
      list.innerHTML = `<div class="empty"><p>No papers match these filters.</p><button class="btn btn-ghost" data-act="reset">Clear filters</button></div>`;
      return;
    }
    list.innerHTML = matches.slice(0, st.shown).map(item).join("") +
      (matches.length > st.shown ? `<div class="more"><button class="btn btn-ghost" data-act="more">Show ${Math.min(PAGE, matches.length - st.shown)} more</button></div>` : "");
  }
  const item = (p) => {
    const t = D.macroById.get(p.macro);
    return `<button class="item" data-id="${esc(p.id)}" ${st.paper === p.id ? 'aria-current="true"' : ""}>
      <div class="it">${esc(p.title)}</div>
      <div class="im"><span>${esc(p.authors || "Unknown authors")}</span><span>·</span><span>${p.journal} ${p.year}</span></div>
      <div class="im" style="margin-top:3px"><span class="dot" style="background:${t.color}"></span><span>${esc(t.label)}</span></div></button>`;
  };

  function openPaper(p, focusMap = true) {
    previousView = st.view;
    returnToMap = !focusMap;
    setView("list");
    st.paper = p.id;
    map.select(p, focusMap);
    const t = D.macroById.get(p.macro), s = D.subById.get(p.sub);
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : null;
    const links = D.isDemo ? `<span class="note">Demo record: no external links.</span>` :
      `${doiUrl ? `<a class="btn" href="${esc(doiUrl)}" target="_blank" rel="noopener">Open DOI</a>` : ""}
       <a class="btn btn-ghost" href="https://openalex.org/${esc(p.id)}" target="_blank" rel="noopener">OpenAlex record</a>`;
    $("#detail").innerHTML = `
      <button class="back" data-act="back">← Back to ${fmt(matches.length)} results</button>
      <h2>${esc(p.title)}</h2>
      <div class="muted" style="font-size:14px">${esc(p.authors || "Unknown authors")}</div>
      <dl>
        <dt>Journal</dt><dd>${esc(D.journalName[p.journal])}</dd>
        <dt>Year</dt><dd>${p.year}</dd>
        <dt>Theme</dt><dd><span class="dot" style="background:${t.color}"></span> ${esc(t.label)}</dd>
        <dt>Subtopic</dt><dd>${esc(s?.label || "–")}${s && !s.reviewed ? ' <span class="muted">(draft label)</span>' : ""}</dd>
        <dt>Mapped from</dt><dd>${p.hasAbstract ? "Title and abstract" : "Title only (no abstract available)"}</dd>
        <dt>DOI</dt><dd style="word-break:break-all">${esc(p.doi || "–")}</dd>
        <dt>Cited by</dt><dd>${fmt(p.cited)} <span class="muted">(OpenAlex)</span></dd>
      </dl>
      <div class="actions">${links}<button class="btn btn-ghost" data-act="copy">${ICON.link.replace("<svg", '<svg width="15" height="15"')} Copy link</button></div>
      <p class="note" id="copied" aria-live="polite"></p>`;
    $("#list").hidden = true; $("#detail").hidden = false;
    $("#detail").scrollTop = 0;
    $("#detail .back").focus({ preventScroll: true });
    syncUrl();
  }
  function clearPaper() {
    st.paper = null;
    map.select(null);
    $("#detail").hidden = true;
    $("#list").hidden = false;
  }

  function closePaper() {
    const id = st.paper;
    clearPaper();
    setView(previousView);
    renderList();
    syncUrl();
    const item = root.querySelector(`.item[data-id="${CSS.escape(id)}"]`);
    const focusTarget = returnToMap ? root.querySelector("canvas") : item || $("#q");
    focusTarget.focus({ preventScroll: true });
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (st.q) p.set("q", st.q);
    if (st.journals.size !== D.jcodes.length) p.set("j", [...st.journals].join(","));
    if (st.y0 !== yMin) p.set("from", st.y0);
    if (st.y1 !== yMax) p.set("to", st.y1);
    if (st.theme !== "") p.set("theme", st.theme);
    if (st.paper) p.set("paper", st.paper);
    setParams(p);
  }

  function readParams(params) {
    clearPaper();
    st.q = params.get("q") || "";
    const j = params.get("j");
    st.journals = new Set(j === null ? D.jcodes : j.split(",").filter((x) => D.jcodes.includes(x)));
    const yearLimit = (key, fallback) => Math.min(yMax, Math.max(yMin, +params.get(key) || fallback));
    st.y0 = Math.round(yearLimit("from", yMin));
    st.y1 = Math.round(yearLimit("to", yMax));
    if (st.y0 > st.y1) [st.y0, st.y1] = [st.y1, st.y0];
    const theme = params.get("theme");
    st.theme = theme && D.macroById.has(+theme) ? theme : "";
    $("#q").value = st.q; $("#y0").value = st.y0; $("#y1").value = st.y1; $("#theme").value = st.theme;
    root.querySelectorAll("[data-j]").forEach((b) => b.setAttribute("aria-pressed", st.journals.has(b.dataset.j)));
    apply();
    const pid = params.get("paper");
    const p = pid && D.byId.get(pid);
    if (p) openPaper(p, true);
    else if (pid) { $("#count").textContent = `Paper ${pid} is not in this data version.`; }
  }

  // events
  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { st.q = e.target.value.trim(); clearPaper(); apply(); }, 150); });
  root.querySelectorAll("[data-j]").forEach((b) => b.addEventListener("click", () => {
    const j = b.dataset.j;
    if (st.journals.has(j)) st.journals.delete(j); else st.journals.add(j);
    b.setAttribute("aria-pressed", st.journals.has(j)); apply();
  }));
  $("#y0").addEventListener("change", (e) => { st.y0 = +e.target.value; if (st.y0 > st.y1) { st.y1 = st.y0; $("#y1").value = st.y1; } apply(); });
  $("#y1").addEventListener("change", (e) => { st.y1 = +e.target.value; if (st.y1 < st.y0) { st.y0 = st.y1; $("#y0").value = st.y0; } apply(); });
  $("#theme").addEventListener("change", (e) => { st.theme = e.target.value; apply(); });
  $("#sort").addEventListener("change", (e) => { st.sort = e.target.value; apply(); });
  const reset = () => { $("#sort").value = st.sort = "new"; readParams(new URLSearchParams()); };
  $("#reset").addEventListener("click", reset);
  root.querySelectorAll(".map-legend button").forEach((b) => b.addEventListener("click", () => {
    st.theme = st.theme !== "" && +st.theme === +b.dataset.m ? "" : b.dataset.m;
    $("#theme").value = st.theme; apply();
  }));
  $("#zin").addEventListener("click", () => map.zoomBy(1.6));
  $("#zout").addEventListener("click", () => map.zoomBy(1 / 1.6));
  $("#zreset").addEventListener("click", () => map.reset());
  root.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
  root.querySelector(".list-pane").addEventListener("click", async (e) => {
    const it = e.target.closest(".item");
    if (it) { openPaper(D.byId.get(it.dataset.id), true); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "more") { st.shown += PAGE; renderList(); }
    if (act === "reset") reset();
    if (act === "back") closePaper();
    if (act === "copy") {
      const url = paperLink(st.paper);
      try { await navigator.clipboard.writeText(url); $("#copied").textContent = "Link copied."; }
      catch { $("#copied").textContent = url; }
    }
  });

  readParams(params);
  api = { update: readParams };
  return () => { clearTimeout(qTimer); map.destroy(); api = null; };
}

export function update(params) { api?.update(params); }
