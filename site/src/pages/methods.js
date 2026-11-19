import * as d3 from "d3";
import { SITE } from "../config.js";
import { esc, fmt, pct } from "../data.js";
import { evMany } from "../story/evidence.js";

const sections = {
  corpus: "Corpus",
  coverage: "Coverage by year",
  rules: "Inclusion rules",
  model: "Topic model",
  sensitivity: "Sensitivity",
  evidence: "Chapter evidence",
  version: "Data version",
  limits: "Limitations",
  references: "References",
};

export function update(params) {
  const section = params.get("section");
  if (!Object.hasOwn(sections, section)) {
    window.scrollTo(0, 0);
    return;
  }
  const heading = document.getElementById(section)?.querySelector("h2");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "start" });
  }
}

export async function render(root, D, params) {
  const m = D.manifest, P = m.params;
  const E = await evMany(["ch2_orientation", "ch3_citations", "ch4_methods", "ch5_importance"]);
  const years = d3.range(m.window[0], m.window[1] + 1);
  const covBy = new Map(D.coverage.map((c) => [`${c.journal}|${c.year}`, c]));
  // reconciliation: published papers per journal-year must equal coverage.mapped
  const per = d3.rollup(D.papers, (papers) => ({
    total: papers.length,
    withAbstract: d3.sum(papers, (paper) => paper.hasAbstract),
  }), (p) => `${p.journal}|${p.year}`);
  const keys = new Set([...covBy.keys(), ...per.keys()]);
  const mismatches = [...keys].filter((key) => {
    const row = covBy.get(key);
    const { total = 0, withAbstract = 0 } = per.get(key) || {};
    return !row || total !== row.mapped || row.mapped !== row.eligible || withAbstract !== row.with_abstract;
  });
  const jStats = m.journals.map((j) => {
    const ps = D.papers.filter((p) => p.journal === j.code);
    return { ...j, n: ps.length, abs: ps.filter((p) => p.hasAbstract).length,
      gaps: D.coverage.filter((c) => c.journal === j.code && c.status === "gap").map((c) => c.year) };
  });
  const maxN = d3.max(D.coverage, (c) => c.eligible) || 1;
  const shade = d3.scaleSequential([0, maxN], (t) => d3.interpolateRgb("#f1f5f9", "#334155")(t));
  const hasIssueAudit = D.coverage.some((c) => Number.isInteger(c.unassigned_issue));
  const withoutIssue = d3.sum(D.coverage, (c) => c.unassigned_issue || 0);
  const parPolicy = m.filter.par_practitioner_sections === "research_only"
    ? "Substantive research and scholarly reviews can qualify in practitioner-facing sections. Publisher-verified editorials and opinion-only items are excluded. Ambiguous entries were screened in the publisher sample. Other entries are subject to the same metadata rules."
    : m.filter.par_practitioner_sections;

  root.innerHTML = `
  <section class="hero"><div class="container hero-inner" style="padding:56px 0 40px">
    <p class="kicker">About this project</p>
    <h1 class="title">How this map was made</h1>
    <p class="dek">Which papers are included, how themes were built, what each chart's denominator is, and where the data are thin.</p>
    <nav class="toc" aria-label="On this page">
      ${Object.entries(sections).map(([id, title]) => `<a href="#/about?section=${id}">${title}</a>`).join("")}</nav>
  </div></section>

  <section class="section" id="corpus"><div class="container">
    <h2 class="section-title">Corpus</h2>
    <p class="section-sub">Five journals, ${m.window[0]}–${m.window[1]}. Each journal counts from its first volume inside the window. Publication dates follow the source priority listed below.</p>
    <div class="scroll-x"><table class="kv"><thead><tr><th>Journal</th><td class="muted">First year</td><td class="muted">Papers</td><td class="muted">With abstract</td><td class="muted">Data gaps</td></tr></thead><tbody>
      ${jStats.map((j) => `<tr><th style="color:var(--fg)">${esc(j.name)} <span class="muted">(${j.code})</span></th><td>${j.start}</td><td class="num">${fmt(j.n)}</td>
        <td class="num">${fmt(j.abs)} (${pct(j.abs / (j.n || 1), 0)})</td><td>${j.gaps.length ? `<span class="bad">${j.gaps.join(", ")}</span>` : "none"}</td></tr>`).join("")}
      <tr><th style="color:var(--fg)">All</th><td></td><td class="num"><b>${fmt(D.papers.length)}</b></td><td class="num">${fmt(m.counts.with_abstract)} (${pct(m.counts.with_abstract / D.papers.length, 0)})</td><td></td></tr>
    </tbody></table></div>
    ${m.journals.filter((j) => j.predecessor_until).map((j) => `<p class="note">${j.code} papers up to ${j.predecessor_until} appeared in its predecessor title and are marked with a purple underline in the table below. They are left out of the five-journal comparison, which starts in ${m.comparison_start}.</p>`).join("")}
  </div></section>

  <section class="section" id="coverage"><div class="container">
    <h2 class="section-title">Coverage by journal and year</h2>
    <p class="section-sub">Eligible papers are the denominators used in Trends. Choose a journal and year to see the counts behind a cell.</p>
    <div class="toolbar coverage-controls">
      <label>Journal <select id="coverage-journal">${m.journals.map((j) => `<option value="${esc(j.code)}">${esc(j.name)}</option>`).join("")}</select></label>
      <label>Year <select id="coverage-year">${years.map((y) => `<option value="${y}" ${y === m.window[1] ? "selected" : ""}>${y}</option>`).join("")}</select></label>
      <p class="note" id="coverage-detail" aria-live="polite"></p>
    </div>
    <div class="scroll-x"><table class="cov" aria-label="Eligible papers by journal and year"><thead><tr><th></th>${years.map((y) => `<th scope="col">${y}</th>`).join("")}</tr></thead><tbody>
      ${m.journals.map((j) => `<tr><th scope="row">${j.code}</th>${years.map((y) => {
        const c = covBy.get(`${j.code}|${y}`);
        if (!c) return `<td class="nl" title="${j.code} ${y}: outside the data window"></td>`;
        const tt = `${j.code} ${y}: ${c.candidates} candidates, ${c.excluded} excluded, ${c.eligible} eligible, ${c.with_abstract} with abstract${hasIssueAudit ? `, ${c.unassigned_issue} without a confirmed issue` : ""}`;
        if (c.status === "not_launched") return `<td class="nl" title="${j.code} ${y}: not yet published"></td>`;
        if (c.status === "gap") return `<td class="gap" title="${tt} (data gap: check the publisher's table of contents)">gap</td>`;
        const cls = [c.predecessor ? "pred" : "", c.eligible === 0 ? "zero" : ""].join(" ");
        const background = shade(c.eligible);
        const luminance = d3.lab(background).l;
        return `<td class="${cls}" style="background:${background};color:${luminance < 50 ? "#fff" : "#0a0a0a"}" title="${tt}">${c.eligible}</td>`;
      }).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="legend-inline" style="margin-top:10px">
      <span><span class="sw" style="background:repeating-linear-gradient(135deg,#f3f4f6 0 3px,#e5e7eb 3px 5px)"></span>Not yet published</span>
      <span><span class="sw" style="border:1.5px dashed #ef4444;height:10px"></span>Data gap</span>
      <span><span class="sw" style="border:1px solid #a3a3a3;height:10px"></span>Confirmed zero</span>
      <span><span class="sw" style="box-shadow:inset 0 -3px 0 #a855f7;background:#f1f5f9;height:10px"></span>Predecessor title</span>
    </div>
    <p class="note" style="margin-top:14px">Reconciliation: ${mismatches.length === 0
      ? `<span class="ok">✓ all ${fmt(D.coverage.length)} journal-years reconcile</span>. Mapped, eligible and usable-abstract counts match the paper data for every journal and year.`
      : `<span class="bad">✗ ${mismatches.length} journal-years do not reconcile</span>. Rerun the export.`}</p>
    ${hasIssueAudit ? `<p class="note">${fmt(withoutIssue)} eligible papers were dated from fallback publication metadata without a confirmed issue assignment.</p>` : ""}
  </div></section>

  <section class="section" id="rules"><div class="container">
    <h2 class="section-title">Inclusion rules</h2>
    <table class="kv"><tbody>
      <tr><th>Sources</th><td>OpenAlex supplies candidate records. Crossref provides issue dates and pages. Publisher tables of contents supply spot checks and documented corrections.</td></tr>
      <tr><th>Document types kept</th><td>Research articles, theoretical articles and scholarly reviews. The initial OpenAlex types are ${esc(m.filter.keep_types.join(", "))}. Documented publisher decisions can override metadata screening.</td></tr>
      <tr><th>Excluded by default</th><td>Book reviews, corrections, editorials, issue information, front or back matter, reviewer lists, obituaries, calls for papers and records known to be shorter than ${m.filter.min_pages} pages.</td></tr>
      ${D.isDemo ? "" : `<tr><th>Historical PAR pagination</th><td>For PAR records from JSTOR, identical start and end pages are treated as unknown length when no reliable page range is available. Archival spot checks showed that this metadata pattern can occur on full-length articles. <a href="https://www.jstor.org/stable/i357337">Example archival issue</a></td></tr>`}
      <tr><th>PAR practitioner sections</th><td>${esc(parPolicy)}</td></tr>
      <tr><th>Year</th><td>Publisher-verified issue years take precedence. Next come Crossref print-issue and item print years when consistent with the verified journal volume–year calendar. Where a validated calendar is available, its volume year is used if the print year is missing or inconsistent. The remaining fallbacks are the Crossref online issue date, Crossref issued date and OpenAlex publication year. Eligibility ends with issue year ${m.window[1]}.</td></tr>
      <tr><th>Duplicates</th><td>Records with a DOI are deduplicated by normalized DOI. Records without a DOI are also screened for duplicate or near-duplicate titles within a journal and year.</td></tr>
      <tr><th>Excluded records</th><td class="num">${fmt(m.counts.excluded)} (logged with reasons)</td></tr>
    </tbody></table>
  </div></section>

  <section class="section" id="model"><div class="container">
    <h2 class="section-title">Topic model</h2>
    <table class="kv"><tbody>
      <tr><th>Embedding model</th><td>Input is the title and abstract for papers with at least ${P.embed.min_abstract_words} abstract words, and the title alone for the other papers. Inputs are limited to ${P.embed.max_length} tokens. Model ${esc(P.embed.base_model)} with proximity adapter ${esc(P.embed.adapter)}. <a href="https://github.com/allenai/SPECTER2">SPECTER2 documentation</a></td></tr>
      <tr><th>Clustering</th><td>K-means on L2-normalized vectors groups papers into ${P.cluster.k_sub} subtopics. Ward clustering of their centroids groups them into ${P.cluster.n_macro} themes. Both steps use the full embedding space.</td></tr>
      <tr><th>Stability (mean pairwise ARI across ${P.cluster.seeds.length} seeds)</th><td>${P.cluster.stability.map((s) => `k=${s.k}: ${s.mean_ari.toFixed(3)}`).join(" · ")}</td></tr>
      <tr><th>2-D map</th><td>UMAP, n_neighbors=${P.umap.n_neighbors}, min_dist=${P.umap.min_dist}, metric=${esc(P.umap.metric)}, random_state=${P.umap.random_state}. Distances on the map are approximate; clusters are defined in the full space.</td></tr>
      <tr><th>Labels</th><td>Label review draws on central, randomly sampled and boundary papers from each cluster. ${D.topics.macro.every((t) => t.reviewed) ? "All theme labels have been reviewed." : `<span class="bad">${D.topics.macro.filter((t) => !t.reviewed).length} theme labels are still drafts</span> (marked * on the map).`}</td></tr>
    </tbody></table>
  </div></section>

  <section class="section" id="sensitivity"><div class="container">
    <h2 class="section-title">Sensitivity</h2>
    <p class="section-sub">About ${pct(1 - m.counts.with_abstract / D.papers.length, 0)} of papers have no usable abstract. Coverage varies across journals and years. The title-only sensitivity test assigns papers to their nearest subtopics using embeddings generated from titles.</p>
    <table class="kv">
      <thead><tr><th>Same assignment after using titles alone</th><td>All papers</td><td>Papers with usable abstracts</td></tr></thead>
      <tbody>
        <tr><th>Subtopic</th><td>${pct(m.sensitivity.title_only_agreement_sub)}</td><td>${pct(m.sensitivity.title_only_agreement_sub_abstract_rows)}</td></tr>
        <tr><th>Theme</th><td>${pct(m.sensitivity.title_only_agreement_macro)}</td><td>${pct(m.sensitivity.title_only_agreement_macro_abstract_rows)}</td></tr>
      </tbody>
    </table>
    <p class="note">For trend checks, the abstract-only subset uses each paper's original mapping and restricts the denominator to papers with usable abstracts.</p>
  </div></section>

  <section class="section" id="evidence"><div class="container">
    <h2 class="section-title">Chapter evidence</h2>
    <p class="section-sub">Each chapter answers its question with a different measure. All are computed by <code>python -m pa_map evidence</code> from the same corpus and published as aggregates in <code>data/chapters/</code>.</p>
    <table class="kv"><tbody>
      <tr><th>Ch1 · Field map and theme shares</th><td>Topic assignments and 2-D coordinates above; a theme's share is its papers divided by all papers published that year.</td></tr>
      <tr><th>Ch2 · Theory vs. phenomenon</th><td>An LLM labels each abstract as primarily theory- or phenomenon-driven (3-year rolling average). Status: <strong>${E.ch2_orientation.status === "ready" ? `ready (${esc(E.ch2_orientation.model)}, ${fmt(E.ch2_orientation.n)} papers)` : "awaiting LLM labels"}</strong>.</td></tr>
      <tr><th>Ch2 · Theory trajectories</th><td>Share of abstracts that name each of six frameworks, using the auditable patterns in <code>pipeline/coding_rules.toml</code> (5-year rolling average).</td></tr>
      <tr><th>Ch3 · Fragmentation</th><td>Effective paradigms (1/HHI over subtopic shares), HHI, semantic coherence (mean pairwise cosine of SPECTER2 vectors within a year) and dispersion (mean distance to the year's centroid in the same space).</td></tr>
      <tr><th>Ch3 · Citation flows</th><td>${E.ch3_citations.status === "ready" ? `Crossref reference lists matched by DOI to the corpus: ${fmt(E.ch3_citations.edges)} links from ${fmt(E.ch3_citations.papers_with_refs)} citing papers. References without a DOI, and citations to work outside the five journals, are not counted.` : "Awaiting reference lists."}</td></tr>
      <tr><th>Ch4 · Methods and data sources</th><td>Keyword rules for nine causal identification methods and five data sources, applied to title + abstract (${fmt(E.ch4_methods.n_coded)} abstracts). A paper can use several methods; the data source is the first matching rule. Rules can be audited with <code>python -m pa_map evidence --sample KEY</code>.</td></tr>
      <tr><th>Ch5 · Periphery test</th><td>Distance of each coded paper from the centroid of the 2-D map; Welch's t-test, Cohen's d.</td></tr>
      <tr><th>Ch5 · Question importance and scope</th><td>LLM ratings from 1 to 10. Status: <strong>${E.ch5_importance.status === "ready" ? `ready (${esc(E.ch5_importance.model)})` : "awaiting LLM scores"}</strong>.</td></tr>
    </tbody></table>
    <p class="note">The keyword and LLM codes are approximations, not hand-coded measurements. Abstracts often omit the method or data source, so shares understate true use.</p>
  </div></section>

  <section class="section" id="version"><div class="container">
    <h2 class="section-title">Data version and downloads</h2>
    <table class="kv"><tbody>
      <tr><th>Version</th><td>${esc(m.data_version)} (${esc(m.status)}), generated ${esc(m.generated_at)}</td></tr>
      <tr><th>Downloads</th><td><a href="./data/downloads/papers.csv">papers.csv</a> · <a href="./data/downloads/coverage.csv">coverage.csv</a> · <a href="./data/manifest.json">manifest.json</a> · <a href="./data/topics.json">topics.json</a></td></tr>
      <tr><th>What is published</th><td>Bibliographic fields, DOI, OpenAlex ID, theme and subtopic labels, 2-D coordinates and aggregate counts. Abstracts, full texts and embedding vectors are not published.</td></tr>
      ${SITE.repoUrl ? `<tr><th>Source code</th><td><a href="${esc(SITE.repoUrl)}">${esc(SITE.repoUrl)}</a></td></tr>` : ""}
    </tbody></table>
  </div></section>

  <section class="section" id="limits"><div class="container prose">
    <h2 class="section-title">Limitations</h2>
    <ul class="clean">
      <li>The corpus covers five journals. Books and scholarship in other journals sit outside its scope.</li>
      <li>Abstract coverage differs by journal and era, especially for older PAR volumes. Papers without abstracts are placed using their titles, which is less precise.</li>
      <li>SPECTER2 is pretrained using citation signals. Paper positions are generated from the available text for each record.</li>
      <li>Themes come from an unsupervised model and a human reading of examples. Boundaries are fuzzy, and a paper can fit more than one theme.</li>
      <li>OpenAlex and Crossref metadata contain errors. Publisher tables of contents were sampled, so missing or misclassified records may remain.</li>
      <li>Citation counts come from OpenAlex and favour older papers.</li>
    </ul>
  </div></section>

  <section class="section" id="references"><div class="container prose">
    <h2 class="section-title">References</h2>
    <ul class="clean">
      <li>Peters, Pierre, Sørensen and Torfing (2022) searched Web of Science abstracts in these same five journals for political concepts, 2005–2019. <a href="https://doi.org/10.1111/gove.12705">Bringing political science back into public administration research</a></li>
      <li>Walker, Zhang and Chandra (2024) modeled topics across 17 journals and 12,760 articles, 1991–2019. <a href="https://doi.org/10.1017/9781009378697">Topics in Public Administration</a></li>
      <li>Vogel and Hattke (2022) used bibliometrics and natural language processing to trace themes through the publication history of <em>Public Administration</em>. <a href="https://doi.org/10.1111/padm.12831">A century of Public Administration</a></li>
      <li>Ni, Sugimoto and Robbin (2017) traced authorship, collaboration and impact in <em>Public Administration Review</em>, 1940–2013. <a href="https://doi.org/10.1111/puar.12737">Examining the evolution of the field of public administration</a></li>
      <li>Rajan and Sen (2024) traced thematic changes in nine journals, 2010–2022, using dynamic topic modeling. <a href="https://doi.org/10.1002/pad.2047">Changing discourse of public administration</a></li>
      <li>The interactive format draws on Justin Frake's field map of strategic management. <a href="https://whatisstrategy.org/about">What is Strategy?</a></li>
    </ul>
  </div></section>`;

  const journalInput = root.querySelector("#coverage-journal");
  const yearInput = root.querySelector("#coverage-year");
  const coverageDetail = root.querySelector("#coverage-detail");
  function showCoverage() {
    const label = `${journalInput.value} ${yearInput.value}`;
    const row = covBy.get(`${journalInput.value}|${yearInput.value}`);
    if (!row || row.status === "not_launched") {
      coverageDetail.textContent = `${label} · ${row ? "Journal had not yet launched." : "Coverage record unavailable."}`;
      return;
    }
    const share = row.eligible ? row.with_abstract / row.eligible : null;
    const details = [
      `${fmt(row.candidates)} candidates`, `${fmt(row.excluded)} excluded`, `${fmt(row.eligible)} eligible`,
      `${fmt(row.mapped)} mapped`, `${fmt(row.with_abstract)} with usable abstracts (${pct(share, 0)})`,
    ];
    if (Number.isInteger(row.unassigned_issue)) details.push(`${fmt(row.unassigned_issue)} without a confirmed issue`);
    if (row.status === "gap") details.push("Data gap");
    if (row.predecessor) details.push("Predecessor title");
    coverageDetail.textContent = `${label} · ${details.join(" · ")}`;
  }
  journalInput.addEventListener("change", showCoverage);
  yearInput.addEventListener("change", showCoverage);
  showCoverage();

  if (params.get("section")) update(params);
}
