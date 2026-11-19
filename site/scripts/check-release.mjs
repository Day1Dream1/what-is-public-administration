import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CHAPTERS } from "../src/chapters.js";
import { SIGNALS } from "../src/chapter-evidence.js";

const root = process.argv[2] || "public";
const load = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const files = readdirSync(join(root, "data")).sort();
const fieldNames = ["id", "doi", "title", "authors", "year", "j", "m", "s", "x", "y", "a", "c"];
assert.deepEqual(files, ["coverage.json", "downloads", "manifest.json", "papers.json", "topics.json", "trends.json"]);
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
const findings = load("content/findings.json");
assert.equal(findings.status, "final", "Findings need reviewed release copy");
assert.equal(findings.data_version, manifest.data_version, "Findings must match this data release");
assert(!/\b(demo|synthetic)\b/i.test(JSON.stringify(findings)), "Findings still contain demo copy");
assert(findings.periods?.early && findings.periods?.recent, "The field-map chapter needs two comparison periods");
const chapterContent = load("content/chapters.json");
assert.equal(chapterContent.status, "final", "The chapter collection needs reviewed release copy");
assert.equal(chapterContent.data_version, manifest.data_version, "Chapters must match this data release");
assert.deepEqual(chapterContent.chapters.map((c) => c.id), CHAPTERS.slice(1).map((c) => c.id));
const chapterSignals = new Set(Object.keys(SIGNALS));
const journalIds = new Set(manifest.journals.map((j) => j.code));
const themeIds = new Set(macro.map((theme) => theme.id));
for (const chapter of [findings, ...chapterContent.chapters]) {
  const figures = chapter === findings ? ["map", "bar", "table"] : ["map", "signals", "journal", "overlap"];
  assert(chapter.title.trim() && chapter.steps.length, "Each chapter needs a title and reading steps");
  assert.equal(new Set(chapter.steps.map((s) => s.id)).size, chapter.steps.length, "Step IDs must be unique within a chapter");
  for (const step of chapter.steps) {
    assert(step.heading.trim() && step.text.trim(), `Missing text for ${step.id}`);
    assert(!step.paperId || ids.has(step.paperId), `Unknown paper in ${step.id}`);
    assert(!step.filter?.journal || journalIds.has(step.filter.journal), `Unknown journal in ${step.id}`);
    assert(!step.filter?.signal || chapterSignals.has(step.filter.signal), `Unknown title phrase in ${step.id}`);
    assert(figures.includes(step.figure), `Unsupported figure in ${step.id}`);
    assert((step.signals || []).every((signal) => chapterSignals.has(signal)), `Unknown signal in ${step.id}`);
    assert((step.themes || step.compare?.macros || []).every((theme) => themeIds.has(theme)), `Unknown theme in ${step.id}`);
  }
}
const privateKeys = /^(abstract|abstract_inverted_index|embeddings?|vectors?|full_?text|mailto|api_key)$/i;
for (const path of files.filter((file) => file.endsWith(".json"))) {
  JSON.stringify(load(`data/${path}`), (key, value) => {
    assert(!privateKeys.test(key), `Private field ${key} in ${path}`);
    return value;
  });
}
console.log(`Verified ${ids.size} paper records, ${expected.size} journal-years and five release chapters.`);
