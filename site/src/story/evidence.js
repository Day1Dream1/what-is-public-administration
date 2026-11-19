// Lazy loader for the chapter evidence files written by `python -m pa_map evidence`.
const cache = new Map();

export function ev(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`./data/chapters/${name}.json`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Could not load chapters/${name}.json (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(name);
}

export const evMany = (names) => Promise.all(names.map(ev)).then((a) => Object.fromEntries(names.map((n, i) => [n, a[i]])));

// Small numeric helpers used in chapter text.
export const f1 = (v) => (v == null ? "–" : (+v).toFixed(1));
export const f0 = (v) => (v == null ? "–" : Math.round(+v).toLocaleString("en-US"));
export const pp = (v) => (v == null ? "–" : `${v > 0 ? "+" : ""}${(+v).toFixed(1)} pp`);
export const yearOf = (years, values, pick = Math.max) => {
  const v = values.filter((x) => x != null);
  const target = pick(...v);
  return years[values.indexOf(target)];
};

// Theme shares by period, computed from the published papers.
export function periodShare(D, macro, a, b) {
  let n = 0, k = 0;
  for (const p of D.papers) if (p.year >= a && p.year <= b) { n++; if (p.macro === macro) k++; }
  return n ? (100 * k) / n : null;
}

export function short(label, n = 26) {
  return label.length > n ? label.slice(0, n - 1) + "…" : label;
}
