// Chapter 2 · What happened to the big theories?
// Reference: whatisstrategy.org/chapters/big-theories (4 + 7 + 4 steps).
import { fmt } from "../data.js";
import { COLORS, diverging, stacked, twoLine } from "./charts.js";
import { evMany, f1 } from "./evidence.js";

const THEORY_COLORS = { npm: "#f59e0b", principal_agent: "#10b981", institutional: "#8b5cf6", network: "#3b82f6", psm: "#ec4899", public_value: "#06b6d4" };

export default async function (D) {
  const { ch2_orientation: O, ch2_theories: T, ch2_shifts: S } = await evMany(["ch2_orientation", "ch2_theories", "ch2_shifts"]);
  const ready = O.status === "ready";
  const Y1 = T.years.at(-1);
  const nAbs = T.n_abstract.reduce((a, b) => a + b, 0);
  const ser = (k) => T.series.find((s) => s.key === k);
  const peak = (k) => { const r = ser(k).rate; const v = Math.max(...r.filter((x) => x != null)); return [f1(v), T.years[r.indexOf(v)]]; };
  const featured = T.series.filter((s) => s.featured);
  const others = T.series.filter((s) => !s.featured);
  const neg = S.topics.filter((t) => t.change <= -S.threshold_pp), pos = S.topics.filter((t) => t.change >= S.threshold_pp).reverse();
  const list = (arr, k) => arr.slice(0, k).map((t) => t.label).join(", ").replace(/, ([^,]*)$/, " and $1");
  const pend = `<span class="pending-note">This chart fills in once the LLM labels are generated (see Data &amp; Methods).</span>`;

  let punch;
  if (S.orientation_status === "ready") {
    const cnt = (arr, o) => arr.filter((t) => t.orientation === o).length;
    const gp = cnt(pos, "phenomenon") / pos.length, dp = cnt(neg, "phenomenon") / neg.length;
    const tally = (arr) => `${cnt(arr, "theory")} theory-oriented, ${cnt(arr, "phenomenon")} phenomenon-oriented and ${cnt(arr, "mixed")} mixed`;
    punch = gp - dp > 0.2
      ? `The pattern is suggestive: the sub-areas that grew are more often phenomenon-oriented (${tally(pos)}) than those that shrank (${tally(neg)}).`
      : `Unlike in strategy research, orientation does not separate the winners from the losers. The ${pos.length} growing sub-areas are ${tally(pos)}; the ${neg.length} declining ones are ${tally(neg)}. What grew is a set of problems, such as co-production, trust and frontline discretion, studied with and without big theories.`;
  } else {
    punch = `The pattern is suggestive: attention has moved from the structure of the state toward citizens, frontline work and behaviour. Once the LLM labels are in, the bar colours show whether the growing areas are also more phenomenon-driven.`;
  }
  // orientation summaries for the text
  const decade = (arr, a, b) => { const v = arr.filter((x, i) => O.years?.[i] >= a && O.years?.[i] <= b && x != null); return v.reduce((s2, x) => s2 + x, 0) / v.length; };
  const th80 = ready ? Math.round(decade(O.theory, 1980, 1989)) : null;
  const minPhen = ready ? Math.round(Math.min(...O.phenomenon.filter((x) => x != null))) : null;

  return {
    title: "The fading of the grand frameworks",
    dek: `Public administration research once leaned on a few big frameworks: New Public Management, principal–agent theory and institutional theory. Today they are named in far fewer abstracts, and no single framework has taken their place.`,
    stats: ready
      ? [[`~${Math.round(O.recent_phenomenon)}%`, "phenomenon-driven today"], [fmt(O.n), "papers classified"]]
      : [[`${f1(T.featured_peak.rate)}% → ${f1(T.featured_latest)}%`, "abstracts naming the three frameworks"], [fmt(nAbs), "abstracts analysed"]],
    sections: [
      {
        title: "Theory vs. Phenomenon",
        make: (el, ctx) => twoLine(el, ctx, O),
        steps: [
          { id: "tvp-method", state: {}, html: `I used an LLM${ready ? ` (${O.model})` : ""} to read each of the ${fmt(ready ? O.n : nAbs)} abstracts and classify every paper as primarily <strong>theory-driven</strong> or <strong>phenomenon-driven</strong>. The chart shows the share of each type over time, smoothed with a 3-year rolling average.${ready ? "" : " " + pend}` },
          { id: "tvp-peak", state: ready ? { emph: "theory", marker: O.peak.year } : { emph: "theory" }, html: ready
            ? `Using a 3-year rolling average, theory-driven work rose from about ${th80}% of papers in the 1980s to a peak of roughly <strong>${Math.round(O.peak.theory)}% around ${O.peak.year}</strong>.`
            : `Once the labels are in, this step marks the year theory-driven work peaked.` },
          { id: "tvp-shift", state: { emph: "phenomenon" }, html: ready
            ? `Since then, <strong>phenomenon-driven research</strong> has climbed back to about ${Math.round(O.recent_phenomenon)}% of papers in 2020–${Y1}. ${minPhen >= 50 ? `In public administration it has always been the majority: its share never fell below ${minPhen}%.` : `It has been the majority in almost every year; only around ${O.peak.year} did it dip to ${minPhen}% and let theory-driven work edge ahead.`}`
            : `…and this step the recent share of <strong>phenomenon-driven research</strong>.` },
          { id: "tvp-meaning", state: {}, html: `In public administration, a phenomenon-driven paper typically starts from a reform, a policy or a service, such as a performance-pay scheme, a digital benefits portal or a pandemic response, rather than from a general theory it sets out to test.` },
        ],
      },
      { kind: "interlude", text: "Which theories rose and fell along the way?" },
      {
        title: "Theory Trajectories",
        make: (el, ctx) => stacked(el, ctx, {
          years: T.years, yLabel: "% of abstracts", toggle: true, counts: true, outline: false,
          series: [...featured, ...others].map((s) => ({ key: s.key, label: s.label, color: THEORY_COLORS[s.key] || "#94a3b8", values: s.rate, counts: s.count })),
        }),
        steps: [
          { id: "tt-intro", state: {}, html: `The map in the previous chapter shows a field that diversified. But for much of its history, public administration research was organised around a small number of <strong>big frameworks</strong>.` },
          { id: "tt-method", state: {}, html: `I searched each paper's abstract for explicit mentions of six frameworks, including "new public management", "principal–agent" and "institutional theory". The chart shows the <strong>mention rate</strong>, the share of abstracts naming each framework, smoothed with a 5-year rolling average.` },
          { id: "tt-npm", state: { emph: "npm" }, html: `<strong>New Public Management</strong> recast government agencies as organisations to be run like firms, through contracts, targets and competition. Its mention rate peaked at ${peak("npm")[0]}% of abstracts in ${peak("npm")[1]}.` },
          { id: "tt-pa", state: { emph: "principal_agent" }, html: `<strong>Principal–agent theory</strong> framed bureaucracy as a delegation problem: how elected principals control the agents who carry out policy. It peaked at ${peak("principal_agent")[0]}% in ${peak("principal_agent")[1]}.` },
          { id: "tt-inst", state: { emph: "institutional" }, html: `<strong>Institutional theory</strong> explained why public organisations look and change alike, through rules, norms and path dependence. It peaked at ${peak("institutional")[0]}% in ${peak("institutional")[1]}.` },
          { id: "tt-peak", state: { emph: featured.map((s) => s.key), marker: T.featured_peak.year }, html: `Together, these frameworks were named in about ${f1(T.featured_peak.rate)}% of abstracts around ${T.featured_peak.year}.` },
          { id: "tt-decline", state: { marker: Y1 }, html: `But their prevalence has faded, to ${f1(T.featured_latest)}% in ${Y1}. Newer frameworks such as public service motivation, public value and network governance have grown, but none has matched New Public Management's peak.` },
        ],
      },
      { kind: "interlude", text: "If the grand frameworks no longer organise the field, what replaced them?" },
      {
        title: "Growing vs. Declining Sub-Areas",
        make: (el, ctx) => diverging(el, ctx, S, D),
        steps: [
          { id: "ps-intro", state: {}, html: `I tracked ${D.topics.sub.length} sub-areas and compared their share of published papers between ${S.early.join("–")} and ${S.late.join("–")}.` },
          { id: "ps-declining", state: { side: "neg" }, html: `The areas that <strong>declined</strong> tend to be about institutions and the discipline itself: ${list(neg, 4)}.` },
          { id: "ps-growing", state: { side: "pos" }, html: `The areas that <strong>grew</strong> tend to be organised around how government meets citizens: ${list(pos, 5)}.` },
          { id: "ps-punchline", state: {}, html: punch },
        ],
      },
    ],
  };
}
export { COLORS };
