// Loads the versioned static data written by `python -m pa_map export`.
const base = "./data/";
let cache = null;

export async function loadData() {
  if (cache) return cache;
  const get = (f) => fetch(base + f, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`Could not load ${f} (${r.status})`);
    return r.json();
  });
  const [manifest, raw, topics, coverage, findings] = await Promise.all([
    get("manifest.json"), get("papers.json"), get("topics.json"), get("coverage.json"),
    fetch("./content/findings.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const jcodes = manifest.journals.map((j) => j.code);
  const f = Object.fromEntries(raw.fields.map((k, i) => [k, i]));
  const macroById = new Map(topics.macro.map((m) => [m.id, m]));
  const subById = new Map(topics.sub.map((s) => [s.id, s]));
  const papers = raw.rows.map((r, i) => {
    const p = {
      i, id: r[f.id], doi: r[f.doi], title: r[f.title], authors: r[f.authors] || "", year: r[f.year],
      journal: jcodes[r[f.j]], macro: r[f.m], sub: r[f.s], x: r[f.x], y: r[f.y], hasAbstract: !!r[f.a], cited: r[f.c] || 0,
    };
    p.hay = `${p.title} ${p.authors} ${p.doi || ""} ${p.id}`.toLowerCase();
    return p;
  });
  const byId = new Map(papers.map((p) => [p.id, p]));
  const journalName = Object.fromEntries(manifest.journals.map((j) => [j.code, j.name]));
  cache = { manifest, papers, byId, topics, macroById, subById, coverage, findings, jcodes, journalName,
    isDemo: manifest.status === "demo" };
  return cache;
}

export const fmt = (n) => (n == null ? "–" : n.toLocaleString("en-US"));
export const pct = (x, d = 1) => (x == null || !isFinite(x) ? "–" : `${(x * 100).toFixed(d)}%`);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Denominators: eligible (= mapped) papers per journal-year, from the coverage table.
export function denominators(D, journals, y0, y1) {
  const den = new Map(), abs = new Map();
  for (const c of D.coverage) {
    if (!journals.includes(c.journal) || c.year < y0 || c.year > y1) continue;
    den.set(c.year, (den.get(c.year) || 0) + c.mapped);
    abs.set(c.year, (abs.get(c.year) || 0) + c.with_abstract);
  }
  return { den, abs };
}
