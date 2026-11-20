// Chapter 4 · What methods do scholars use?
// Reference: whatisstrategy.org/chapters/methods (5 + 6 + 4 steps).
import * as d3 from "d3";
import { fmt } from "../data.js";
import { heatmap, stacked } from "./charts.js";
import { evMany, f1 } from "./evidence.js";

export const METHOD_COLORS = {
  panel_fixed_effects: "#3b82f6", diff_in_diff: "#ec4899", randomized_experiment: "#10b981", instrumental_variables: "#f59e0b",
  regression_discontinuity: "#8b5cf6", matching: "#06b6d4", synthetic_control: "#f97316", event_study: "#84cc16", natural_experiment: "#ef4444",
};
export const SOURCE_COLORS = { archival: "#3b82f6", survey: "#10b981", case_study: "#06b6d4", interviews: "#8b5cf6", experiment: "#ec4899" };

export default async function (D) {
  const { ch4_methods: M, ch4_heatmap: H, ch4_sources: S } = await evMany(["ch4_methods", "ch4_heatmap", "ch4_sources"]);
  const Y = M.years, Y1 = Y.at(-1);
  const mean = (vals, a, b) => d3.mean(Y.map((y, i) => (y >= a && y <= b ? vals[i] : null)).filter((x) => x != null));
  const m = (k) => M.methods.find((s) => s.key === k);
  const src = (k) => S.sources.find((s) => s.key === k);
  const last = H.bins.length - 1;
  const rows = H.themes.filter((t) => !/mixed/i.test(t.label) && t.cells[last].n >= 30);
  const top = rows.reduce((a, b) => (b.cells[last].share > a.cells[last].share ? b : a));
  const low = rows.reduce((a, b) => (b.cells[last].share < a.cells[last].share ? b : a));
  const cell = (t) => `${f1(t.cells[last].share)}% (${t.cells[last].k} of ${t.cells[last].n} papers)`;
  const rare = (mean(m("diff_in_diff").share, 2021, Y1) || 0) + (mean(m("natural_experiment").share, 2021, Y1) || 0) + (mean(m("regression_discontinuity").share, 2021, Y1) || 0);
  // order bands as in the reference: biggest at the bottom
  const order = [...M.methods].sort((a, b) => b.total - a.total);

  return {
    title: "The credibility revolution reaches public administration",
    dek: `Causal identification methods were almost absent from these journals before 2000. In ${Y1}, roughly one abstract in five names one. But adoption varies widely by research area.`,
    stats: [[`${Math.round(M.endpoints.first)}% → ${Math.round(M.any_causal.at(-1))}%`, "causal methods"], [String(H.themes.length), "research themes compared"]],
    sections: [
      {
        title: "Causal Methods Over Time",
        make: (el, ctx) => stacked(el, ctx, { years: Y, curve: d3.curveLinear, outline: true,
          series: order.map((s) => ({ key: s.key, label: s.label, color: METHOD_COLORS[s.key], values: s.share })) }),
        steps: [
          { id: "sa-intro", state: {}, html: `The field diversified its topics and moved away from grand frameworks, but something else changed at the same time: the standard of empirical evidence. I tracked <strong>nine causal identification methods</strong> across ${Y.length} years of abstracts, using keyword rules that anyone can audit (${fmt(M.n_coded)} abstracts coded).` },
          { id: "sa-experiment", state: { emph: "randomized_experiment" }, html: `<strong>Randomized experiments</strong> (field, lab and above all survey experiments) became public administration's workhorse design, named in ${f1(m("randomized_experiment").share.at(-1))}% of abstracts in ${Y1}. The behavioural turn brought experimental designs into the study of citizens and public employees.` },
          { id: "sa-panel", state: { emph: "panel_fixed_effects" }, html: `<strong>Panel and fixed-effects designs</strong> grew alongside administrative data on agencies, schools and local governments, appearing in about ${f1(mean(m("panel_fixed_effects").share, 2021, Y1))}% of abstracts in 2021–${Y1}.` },
          { id: "sa-did", state: { emph: ["diff_in_diff", "natural_experiment", "regression_discontinuity"] }, html: `<strong>Difference-in-differences</strong>, regression discontinuity and other <strong>natural experiments</strong> remain rare: together about ${f1(rare)}% of abstracts a year in 2021–${Y1}. Reforms that roll out unevenly offer such designs, but few abstracts name them.` },
          { id: "sa-overall", state: {}, html: `Combined, abstracts naming at least one causal identification method rose from <strong>${f1(M.any_causal[0])}% in ${Y[0]}</strong> to <strong>${f1(M.any_causal.at(-1))}% in ${Y1}</strong>. (Bands can overlap: one paper can use several methods.)` },
        ],
      },
      { kind: "interlude", text: "Has this revolution reached every corner of the field?" },
      {
        title: "Causal Method Adoption by Theme & Period",
        make: (el, ctx) => heatmap(el, ctx, H),
        steps: [
          { id: "hm-intro", state: {}, html: `Each cell shows the share of papers in a research theme that name at least one causal identification method during a five-year window. Darker cells mean higher adoption. Cells with fewer than five coded papers are greyed out.` },
          { id: "hm-early", state: { cols: [0, 1, 2] }, html: `Before the mid-1990s, causal methods were absent almost everywhere. Most cells are zero.` },
          { id: "hm-recent", state: { cols: [6, 7, 8] }, html: `Since 2010, adoption has risen in most themes, but unevenly. In ${H.bins[last]}, shares range from ${f1(low.cells[last].share)}% to ${f1(top.cells[last].share)}%.` },
          { id: "hm-top", state: { row: top.id }, html: `<strong>${top.label}</strong> leads in ${H.bins[last]}, at ${cell(top)}. Performance information, digital services and behavioural questions lend themselves to experiments and panel data.` },
          { id: "hm-low", state: { row: low.id }, html: `<strong>${low.label}</strong> remains the lowest, at ${cell(low)}. Its core questions, about the constitutional and political position of administration, rarely offer the exogenous variation causal designs require.` },
          { id: "hm-verdict", state: {}, html: `The pattern suggests adoption is partly <strong>question-dependent</strong>. Areas where clean identification is available adopted causal methods earliest and most completely. Where the core questions are harder to isolate, adoption has lagged, but it is rising.` },
        ],
      },
      { kind: "interlude", text: "Methods don't change in isolation — the data sources have shifted too." },
      {
        title: "Data Sources Over Time",
        make: (el, ctx) => stacked(el, ctx, { years: Y, curve: d3.curveLinear, outline: true,
          series: ["archival", "survey", "case_study", "interviews", "experiment"].map((k) => ({ key: k, label: src(k).label, color: SOURCE_COLORS[k], values: src(k).share })) }),
        steps: [
          { id: "dt-intro", state: {}, html: `I classified each paper's primary data source from its abstract. The composition of data in public administration research has shifted alongside its methods. (Many abstracts, especially older ones, do not state a data source; they are the gap above the bands.)` },
          { id: "dt-survey", state: { emph: "survey" }, html: `<strong>Surveys</strong> are the field's most common stated source, the primary data in ${f1(mean(src("survey").share, 2021, Y1))}% of abstracts in 2021–${Y1}, up from ${f1(mean(src("survey").share, 1980, 1989))}% in the 1980s.` },
          { id: "dt-archival", state: { emph: ["archival", "experiment"] }, html: `<strong>Archival and administrative data</strong> and <strong>experiments</strong> rose fastest: from ${f1(mean(src("archival").share, 1980, 1989))}% and ${f1(mean(src("experiment").share, 1980, 1989))}% of abstracts in the 1980s to ${f1(mean(src("archival").share, 2021, Y1))}% and ${f1(mean(src("experiment").share, 2021, Y1))}% in 2021–${Y1}.` },
          { id: "dt-verdict", state: {}, html: `The rise of these data sources and the rise of causal methods are <strong>co-evolutionary</strong>. Large surveys of citizens and public employees made survey experiments cheap to run, and digitised administrative records made panel designs possible.` },
        ],
      },
    ],
  };
}
