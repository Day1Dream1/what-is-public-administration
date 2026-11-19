import { esc, fmt, pct } from "./data.js";

export const SIGNALS = {
  npm: ["New Public Management", /\bnew public management\b/i],
  motivation: ["Public Service Motivation", /\bpublic service motivation\b/i],
  representation: ["Representative Bureaucracy", /\brepresentative bureaucrac(?:y|ies)\b/i],
  cases: ["Case study", /\bcase stud(?:y|ies)\b/i],
  experiments: ["Named experiments or trials", /\b(?:(?:survey|field|lab(?:oratory)?|natural) experiments?|randomi[sz]ed (?:controlled )?trials?)\b/i],
  reviews: ["Systematic review or meta-analysis", /\b(?:systematic reviews?|meta[-\s]?analys[ie]s)\b/i],
  quasi: ["Selected causal-design terms", /\b(?:difference[-\s]in[-\s]differences?|regression discontinuity|instrumental variables?)\b/i],
};

const themeShort = new Map([
  [0, "Comparative governance"],
  [1, "Workforces"],
  [3, "Collaboration"],
  [4, "Discretion and accountability"],
  [6, "Digital and performance"],
]);
const signalColours = {
  npm: "#168368", motivation: "#3569aa", representation: "#72539e",
  cases: "#168368", experiments: "#72539e", reviews: "#3569aa", quasi: "#a45836",
};
const signalShort = {
  cases: "Case study", experiments: "Experiments", reviews: "Reviews & meta-analysis", quasi: "Causal-design terms",
};
const compactLabel = new Map([
  ["Comparative governance", "Comp. governance"],
  ["Discretion and accountability", "Discretion"],
  ["Digital and performance", "Digital & performance"],
  ...Object.entries(signalShort).map(([id, label]) => [SIGNALS[id][0], label]),
]);

export function chapterEvidence(D) {
  const start = D.manifest.comparison_start;
  const end = D.manifest.window[1];
  const papers = D.papers.filter((p) => p.year >= start && p.year <= end);
  const windows = [];
  for (let year = start; year <= end; year += 5) {
    const last = Math.min(end, year + 4);
    windows.push({ start: year, end: last, papers: papers.filter((p) => p.year >= year && p.year <= last) });
  }
  const matches = new Map(Object.keys(SIGNALS).map((id) => [id, new Set()]));
  const byJournal = new Map(D.jcodes.map((j) => [j, []]));
  const byTheme = new Map(D.topics.macro.map((t) => [t.id, []]));
  for (const p of papers) {
    byJournal.get(p.journal)?.push(p);
    byTheme.get(p.macro)?.push(p);
    const title = String(p.title ?? "").normalize("NFKC").replace(/[‐‑‒–—−]/g, "-");
    for (const [id, [, pattern]] of Object.entries(SIGNALS)) {
      if (pattern.test(title)) matches.get(id).add(p.id);
    }
  }
  const cross = (rows, ids, match) => rows.map(({ id, label, papers }) => ({
    id, label, total: papers.length,
    cells: ids.map((column) => papers.filter((paper) => match(paper, column)).length),
  }));
  const titleCount = (selected, id) => selected.filter((p) => matches.get(id)?.has(p.id)).length;
  return {
    start, end, papers, windows, matches,
    signalCounts(ids) { return ids.map((id) => ({ id, cells: windows.map((w) => titleCount(w.papers, id)) })); },
    journalRows(ids) {
      const journals = D.jcodes.map((id) => ({ id, label: id, papers: byJournal.get(id) || [] }));
      return cross(journals, ids, (p, theme) => p.macro === theme);
    },
    overlapRows(themes, ids) {
      const rows = themes.map((id) => ({ id, label: themeShort.get(id) || D.macroById.get(id)?.label || "", papers: byTheme.get(id) || [] }));
      return cross(rows, ids, (p, signal) => matches.get(signal)?.has(p.id));
    },
    select(filter) {
      return papers.filter((p) => (!filter.journal || p.journal === filter.journal) &&
        (!filter.signal || matches.get(filter.signal)?.has(p.id)));
    },
  };
}

const range = ({ start, end }) => `${start}–${end}`;
const fraction = (n, den) => den ? n / den : null;
const titleSignal = (id) => SIGNALS[id][0];
function labelText(label, compact) {
  if (!compact || compact === label) return esc(label);
  return `<span class="evidence-label-full">${esc(label)}</span><span class="evidence-label-short">${esc(compact)}</span>`;
}

function signalFigure(evidence, { signals, focus = null }, scaleSignals) {
  const data = evidence.signalCounts(signals);
  const max = Math.max(0.01, ...evidence.signalCounts(scaleSignals)
    .flatMap(({ cells }) => cells.map((n, i) => fraction(n, evidence.windows[i].papers.length) || 0)));
  return `<div class="evidence-periods">
    <table class="evidence-table" aria-label="Title mentions in five-year cohorts">
      <thead><tr><th scope="col">Title phrase</th>${evidence.windows.map((w) =>
        `<th scope="col" title="${range(w)}, ${fmt(w.papers.length)} titles">${String(w.start).slice(-2)}–${String(w.end).slice(-2)}</th>`
      ).join("")}</tr></thead>
      <tbody>${data.map(({ id, cells }) => `<tr class="${id === focus ? "evidence-focus" : ""}">
        <th scope="row" title="${esc(titleSignal(id))}">${labelText(titleSignal(id), signalShort[id])}</th>
        ${cells.map((n, i) => {
          const total = evidence.windows[i].papers.length;
          const share = fraction(n, total);
          return `<td title="${fmt(n)} / ${fmt(total)} titles">
            <span class="evidence-cell-value">${pct(share, 1)}</span>
            <span class="evidence-count">${fmt(n)}</span>
            <span aria-hidden="true" class="evidence-mark" style="--amount:${((share || 0) / max * 100).toFixed(2)}%;--mark:${signalColours[id]}"></span>
          </td>`;
        }).join("")}
      </tr>`).join("")}</tbody>
    </table>
    <p class="evidence-note">Share and match count. Cohort sizes ${evidence.windows.map((w) => fmt(w.papers.length)).join(" · ")}.</p>
  </div>`;
}

function matrix(rows, columns, focus, name) {
  const peak = Math.max(.01, ...rows.flatMap(({ total, cells }) => cells.map((n) => fraction(n, total) || 0)));
  return `<div class="evidence-matrix">
    <table class="evidence-table" aria-label="${esc(name)}">
      <thead><tr><th scope="col">Group</th>${columns.map((label) =>
        `<th scope="col" title="${esc(label)}">${labelText(label, compactLabel.get(label))}</th>`
      ).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr class="${focus === row.id ? "evidence-focus" : ""}">
        <th scope="row" title="${esc(row.label)}">${labelText(row.label, compactLabel.get(row.label))}<small>n = ${fmt(row.total)}</small></th>
        ${row.cells.map((n) => {
          const share = fraction(n, row.total);
          return `<td class="evidence-heat" style="--weight:${((share || 0) / peak * 24).toFixed(1)}%" title="${fmt(n)} of ${fmt(row.total)} papers">
            <span class="evidence-cell-value">${pct(share, 1)}</span><span class="evidence-count">${fmt(n)}</span>
          </td>`;
        }).join("")}
      </tr>`).join("")}</tbody>
    </table>
    <p class="evidence-note">Cells show share and count. Row n is the total.</p>
  </div>`;
}

export function chapterFigure(D, evidence, step, scaleSignals) {
  if (step.figure === "signals") return {
    title: "Phrases in paper titles",
    context: `Five cohorts · ${evidence.start}–${evidence.end}`,
    html: signalFigure(evidence, step, scaleSignals),
  };
  if (step.figure === "journal") return {
    title: "What each journal publishes",
    context: `Selected themes · ${evidence.start}–${evidence.end}`,
    html: matrix(evidence.journalRows(step.themes),
      step.themes.map((id) => themeShort.get(id) || D.macroById.get(id)?.label || ""), step.focus, "Theme share within each journal"),
  };
  return {
    title: "Where method cues appear",
    context: `Title phrases within selected themes · ${evidence.start}–${evidence.end}`,
    html: matrix(evidence.overlapRows(step.themes, step.signals),
      step.signals.map(titleSignal), step.focus, "Named method cues by theme"),
  };
}
