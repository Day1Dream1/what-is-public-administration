import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CHAPTERS } from "../src/chapters.js";

const root = process.argv[2] || "public";
const load = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const files = readdirSync(join(root, "data")).sort();
const fieldNames = ["id", "doi", "title", "authors", "year", "j", "m", "s", "x", "y", "a", "c"];
assert.deepEqual(files, ["chapters", "coverage.json", "downloads", "manifest.json", "papers.json", "topics.json", "trends.json"]);
assert.deepEqual(readdirSync(join(root, "data/downloads")).sort(), ["coverage.csv", "papers.csv"]);
const manifest = load("data/manifest.json");
assert.equal(manifest.status, "release", "Only a full real-data release can be deployed");
const [start, end] = manifest.window;
assert(start === 1980 && Number.isInteger(end) && end >= 2025, "A release must cover at least 1980–2025");
assert.equal(manifest.journals.length, 5);

const { fields, rows } = load("data/papers.json");
assert.deepEqual(fields, fieldNames);
assert(rows.length > 0 && rows.length === manifest.counts.papers);
const { macro, sub } = load("data/topics.json");
assert.equal(macro.length, manifest.counts.macro);
assert.equal(sub.length, manifest.counts.sub);
assert([...macro, ...sub].every((t) => t.reviewed && t.label.trim()), "A topic label is still a draft");
const parents = new Map(sub.map((item) => [item.id, item.macro]));
const coverage = load("data/coverage.json");
assert.equal(coverage.length, manifest.journals.length * (end - start + 1));
const expected = new Map(coverage.map((c) => [`${c.journal}|${c.year}`, c]));
assert.equal(expected.size, coverage.length);
for (const { code } of manifest.journals) {
  for (let year = start; year <= end; year++) assert(expected.has(`${code}|${year}`));
}

const ids = new Set(), dois = new Set(), totals = new Map(), aggregates = new Map();
for (const row of rows) {
  assert.equal(row.length, fieldNames.length);
  const [id, doi, title, author, year, journalIndex, theme, subtype, x, y, hasAbstract] = row;
  assert(/^W\d+$/.test(id) && !ids.has(id), `Duplicate or malformed work ID ${id}`);
  ids.add(id);
  if (doi) {
    assert(/^10\.\d+\/.+$/i.test(doi) && !dois.has(doi), `Invalid or duplicate DOI ${doi}`);
    dois.add(doi);
  }
  assert(!/\(synthetic\)\s*$/i.test(title) && !/^Demo Author \d/i.test(author), `Demo record ${id}`);
  assert.equal(parents.get(subtype), theme, `Inconsistent topic assignment for ${id}`);
  assert([x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  assert(hasAbstract === 0 || hasAbstract === 1);
  const key = `${manifest.journals[journalIndex]?.code}|${year}`;
  assert(expected.has(key), `Paper with unknown journal/year ${id}`);
  const count = totals.get(key) || { mapped: 0, abstracts: 0 };
  count.mapped++;
  count.abstracts += hasAbstract;
  totals.set(key, count);
  const trendKey = `${journalIndex}|${year}|${theme}`;
  aggregates.set(trendKey, (aggregates.get(trendKey) || 0) + 1);
}
for (const [key, c] of expected) {
  assert.equal(c.mapped, totals.get(key)?.mapped || 0, `Map count for ${key}`);
  assert.equal(c.eligible, c.mapped, `Eligible count for ${key}`);
  assert.equal(c.with_abstract, totals.get(key)?.abstracts || 0, `Abstract count for ${key}`);
  assert.equal(c.candidates, c.eligible + c.excluded, `Candidate count for ${key}`);
}
const trendRows = load("data/trends.json").rows;
assert.equal(trendRows.length, aggregates.size);
for (const [journal, year, theme, count] of trendRows) {
  const key = `${journal}|${year}|${theme}`;
  assert.equal(aggregates.get(key), count, `Trend count for ${key}`);
  aggregates.delete(key);
}
// Chapter evidence (python -m pa_map evidence): one file per chart, aggregates only.
const CHAPTER_FILES = ["ch2_orientation", "ch2_shifts", "ch2_theories", "ch3_citations", "ch3_fragmentation", "ch4_heatmap",
  "ch4_methods", "ch4_sources", "ch5_importance", "ch5_periphery", "ch6_synthesis", "paper_codes"];
assert.deepEqual(readdirSync(join(root, "data/chapters")).sort(), CHAPTER_FILES.map((f) => `${f}.json`));
assert.equal(CHAPTERS.length, 6, "Six chapters, as on the reference site");
const ev = (f) => load(`data/chapters/${f}.json`);
const codes = ev("paper_codes");
for (const k of ["m", "s", "c"]) assert.equal(codes[k].length, rows.length, `paper_codes.${k} must align with papers.json`);
// Only research articles with a usable abstract are coded (pipeline/pa_map/eligibility.py).
assert(codes.c.every((c, i) => !c || rows[i][10]), "Only papers with abstracts can be coded");
const elig = ev("ch2_orientation").eligibility;
assert(elig && codes.c.reduce((a, b) => a + b, 0) === elig.eligible, "Coded papers must equal the eligible research articles");
assert(elig.with_abstract === rows.filter((r) => r[10]).length && elig.records === rows.length, "Eligibility counts must match papers.json");
for (const f of ["ch2_orientation", "ch5_importance"]) assert(["ready", "awaiting_llm"].includes(ev(f).status), `${f} status`);
assert.equal(ev("ch3_citations").status, "ready", "Citation flows need reference data (python -m pa_map refs)");
assert.equal(ev("ch2_shifts").topics.length, sub.length, "Sub-area shifts must cover every subtopic");
assert.equal(ev("ch4_heatmap").themes.length, macro.length, "Heatmap must cover every theme");
const years = ev("ch4_methods").years;
assert(years[0] === start && years.at(-1) === end, "Method series must span the release window");
const privateKeys = /^(abstract|abstract_inverted_index|embeddings?|vectors?|full_?text|mailto|api_key)$/i;
const publicJson = [...files.filter((file) => file.endsWith(".json")), ...CHAPTER_FILES.map((f) => `chapters/${f}.json`)];
for (const path of publicJson) {
  JSON.stringify(load(`data/${path}`), (key, value) => {
    assert(!privateKeys.test(key), `Private field ${key} in ${path}`);
    return value;
  });
}
console.log(`Verified ${ids.size} paper records, ${expected.size} journal-years, six chapters and ${CHAPTER_FILES.length} evidence files.`);
