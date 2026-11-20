// Chapter 3 · Is the public administration field fracturing?
// Reference: whatisstrategy.org/chapters/fracturing (6 + 5 steps).
import { fmt } from "../data.js";
import { chord, fourMetrics } from "./charts.js";
import { evMany, f1 } from "./evidence.js";

export default async function (D) {
  const { ch3_fragmentation: F, ch3_citations: C } = await evMany(["ch3_fragmentation", "ch3_citations"]);
  const Y = F.years, M = F.metrics;
  const at = (key, y) => M[key].values[Y.indexOf(y)];
  const eff = M.effective.values, effMax = Math.max(...eff.filter((v) => v != null));
  const mean = (key, a, b) => { const v = Y.map((y, i) => (y >= a && y <= b ? M[key].values[i] : null)).filter((x) => x != null); return v.reduce((s, x) => s + x, 0) / v.length; };
  const pct = (x) => Math.round(100 * x);
  const cit = C.status === "ready";
  const L = (id) => D.macroById.get(id).label;
  let selfMax, mixer, range;
  if (cit) {
    // leave out the catch-all "Mixed Topics" group: it is not a research area
    const valid = C.per_macro.filter((d) => d.out >= 30 && !/mixed/i.test(D.macroById.get(d.id).label));
    range = [Math.min(...valid.map((d) => d.self_share)), Math.max(...valid.map((d) => d.self_share))];
    selfMax = valid.reduce((a, b) => (b.self_share > a.self_share ? b : a));
    // the theme with the most cross-theme traffic in both directions
    mixer = valid.filter((d) => d.id !== selfMax.id).reduce((a, b) => (b.out_cross + b.in_cross > a.out_cross + a.in_cross ? b : a));
  }
  const cohTrend = M.coherence.change;

  return {
    title: "Diversity without fragmentation",
    dek: `Public administration now spreads across more subtopics than it did in the 1980s. But the language of its papers has not drifted apart, and ${cit ? "most citations cross from one research area to another" : "citation links between its areas are the next test"}.`,
    stats: cit ? [[`${pct(C.cross_share)}%`, "cross-area citations"], [fmt(D.papers.length), "papers analysed"]] : [[fmt(D.papers.length), "papers analysed"]],
    sections: [
      {
        title: "Measuring Fragmentation",
        make: (el, ctx) => fourMetrics(el, ctx, F),
        steps: [
          { id: "frag-method", state: {}, html: `If the field moved away from shared frameworks and spread across dozens of topics, an obvious question follows: is public administration fracturing into silos? I placed each paper in a high-dimensional embedding space, assigned it to one of ${F.n_subtopics} subtopics, and tracked how the distribution changed over ${Y.length} years.` },
          { id: "frag-paradigms", state: { emph: "effective" }, html: `The number of <strong>effective paradigms</strong> (the equivalent number of equal-sized subtopics) rose from ${f1(at("effective", Y[0]))} in ${Y[0]} to ${f1(effMax)} by ${Y[eff.indexOf(effMax)]}, then eased to ${f1(eff.at(-1))} in ${Y.at(-1)}. The field spread across more topics.` },
          { id: "frag-coherence", state: { emph: "coherence" }, html: `<strong>Semantic coherence</strong> measures the average pairwise cosine similarity of paper vectors within each year. It captures shared concepts and framing, not just shared topics. Coherence ${cohTrend >= 0 ? "held steady and edged up" : "slipped slightly"}, from ${mean("coherence", 1980, 1984).toFixed(3)} in the early 1980s to ${mean("coherence", 2021, 2025).toFixed(3)} in the 2020s.` },
          { id: "frag-hhi", state: { emph: "hhi" }, html: `<strong>Concentration</strong> fell. In the 1980s, the five largest subtopics accounted for ${pct(F.top5.early.share)}% of papers. In ${F.top5.late.years.join("–")}, they accounted for ${pct(F.top5.late.share)}%.` },
          { id: "frag-dispersion", state: { emph: "dispersion" }, html: `<strong>Semantic dispersion</strong> measures how far papers sit from each year's centre in the embedding space. It ${M.dispersion.change < 0 ? "drifted slightly down" : "rose slightly"} (${M.dispersion.change > 0 ? "+" : ""}${pct(M.dispersion.change)}% from the early 1980s to the 2020s): papers did not scatter further apart as the field grew.` },
          { id: "frag-verdict", state: {}, html: `<strong>Topically diverse, but not intellectually fragmented.</strong> Research spread across more subtopics, while the language papers share stayed about as close as it was in the 1980s.` },
        ],
      },
      { kind: "interlude", text: "Citation patterns offer another test: are research communities actually talking to each other?" },
      {
        title: "Citation Flow Between Research Areas",
        make: (el, ctx) => chord(el, ctx, C, D),
        steps: cit ? [
          { id: "cf-method", state: {}, html: `I mapped citation flows between the ${D.topics.macro.length} macro research themes using the reference lists publishers deposit with Crossref. Each chord connects two themes, with thickness proportional to the number of citations between them. Only references to another paper in the corpus count: <strong>${fmt(C.edges)} links</strong> in total.` },
          { id: "cf-cross", state: {}, html: `<strong>${pct(C.cross_share)}% of citations cross area boundaries.</strong> The rest stay within a theme. Ideas travel between areas more often than they stay inside one.` },
          { id: "cf-self", state: { focus: selfMax.id }, html: `<strong>${L(selfMax.id)}</strong> is the most self-referencing area: ${pct(selfMax.self_share)}% of its citations stay within the theme.` },
          { id: "cf-mixer", state: { focus: mixer.id }, html: `<strong>${L(mixer.id)}</strong> exchanges citations with nearly every other area: ${fmt(mixer.out_cross)} citations out to other themes and ${fmt(mixer.in_cross)} in.` },
          { id: "cf-spread", state: {}, html: `No area is truly siloed. Within-theme citation rates range from ${pct(range[0])}% to ${pct(range[1])}% across the substantive themes. Even the most inward-looking area sends ${100 - pct(range[1])}% of its citations elsewhere.` },
        ] : ["cf-method", "cf-cross", "cf-self", "cf-mixer", "cf-spread"].map((id, i) => ({ id, state: {}, html: i ? "Awaiting citation data." : "This section maps citations between research themes once the reference lists are fetched." })),
      },
    ],
  };
}
