// Chapter 1 · What is public administration — and how has the field evolved?
// Reference: whatisstrategy.org/chapters/what-is-strategy (map 6 steps + small multiples 7 steps).
// Theme IDs below refer to pipeline/labels/topics.csv (v0.1). After re-clustering, re-check them.
import * as d3 from "d3";
import { fmt } from "../data.js";
import { smallMultiples } from "./charts.js";
import { f1, periodShare } from "./evidence.js";
import { mountMapControls, storyMap } from "./storymap.js";

const DECLINE = 2, EXPLOSIVE = 3, STEADY = 1, ARRIVAL = 6, FOUNDATION = 5, REFORM = 0, RISER = 4;

export default async function (D) {
  const n = D.papers.length;
  const Y0 = d3.min(D.papers, (p) => p.year), Y1 = d3.max(D.papers, (p) => p.year);
  const years = d3.range(Y0, Y1 + 1);
  const L = (id) => D.macroById.get(id).label;
  const S = (id, a, b) => f1(periodShare(D, id, a, b));
  const nYear = (y) => D.papers.filter((p) => p.year === y).length;
  const jStart = (code) => D.manifest.journals.find((j) => j.code === code)?.start;
  const early = D.manifest.journals.filter((j) => j.start <= Y0).map((j) => `<em>${j.code === "PAR" ? "Public Administration Review" : j.name}</em>`);
  const later = D.manifest.journals.filter((j) => j.start > Y0).sort((a, b) => a.start - b.start);
  const found = [FOUNDATION].map((id) => [1980, 1990, 2000, 2010, 2020].map((a) => periodShare(D, id, a, a === 2020 ? 2025 : a + 9)))[0];

  // small-multiple series: share of all papers per year, sorted by total papers
  const tot = years.map(nYear);
  const series = D.topics.macro.map((t) => {
    const count = years.map((y) => D.papers.filter((p) => p.year === y && p.macro === t.id).length);
    return { id: t.id, label: t.label, color: t.color, count, share: count.map((c, i) => (tot[i] ? (100 * c) / tot[i] : null)), total: d3.sum(count) };
  }).sort((a, b) => b.total - a.total);

  return {
    title: "What is public administration — and how has the field evolved?",
    dek: `A map of the field built from ${fmt(n)} article titles and abstracts: ${D.topics.macro.length} themes, ${D.topics.sub.length} subtopics and ${Y1 - Y0 + 1} years of research in five journals.`,
    stats: [[fmt(n), "papers"], [D.topics.macro.length, "macro themes"], [D.topics.sub.length, "subtopics"], [Y1 - Y0 + 1, "years"]],
    sections: [
      {
        title: "Semantic Map of the Field",
        make: (el, ctx) => storyMap(el, ctx, D),
        steps: [
          { id: "map-hook", state: {}, html: `I collected <strong>${fmt(n)} research articles</strong> published between ${Y0} and ${Y1} in five journals (<em>JPART</em>, <em>Public Administration Review</em>, <em>Public Administration</em>, <em>Public Management Review</em> and <em>Governance</em>). I embedded each paper's title and abstract with SPECTER2, a language model trained on scientific papers, to map what the field actually studies.` },
          { id: "map-read", state: {}, html: `Each dot is a paper. Papers with similar titles and abstracts sit near each other in this semantic space. I clustered them into <strong>${D.topics.macro.length} macro themes</strong>, shown by colour.` },
          { id: "map-1980", state: {}, html: `In ${Y0}, only <strong>${nYear(Y0)} articles</strong> appeared in these journals, all of them in ${early.join(" and ")}. ${later.map((j) => `<em>${j.code}</em> (${j.start})`).join(", ").replace(/, ([^,]*)$/, " and $1")} came later.` },
          { id: "map-reform", state: { halos: true }, html: `Then came reform. <strong>${L(REFORM)}</strong> grew from ${S(REFORM, 1980, 1989)}% of papers in the 1980s to ${S(REFORM, 1990, 1999)}% in the 1990s and ${S(REFORM, 2000, 2009)}% in the 2000s, the era of New Public Management. Meanwhile <strong>${L(DECLINE)}</strong>, the largest theme of the 1980s at ${S(DECLINE, 1980, 1989)}%, began to shrink.` },
          { id: "map-diversify", state: { halos: true }, html: `But the field didn't stay there. Over the next two decades, new areas grew: <strong>${L(EXPLOSIVE)}</strong>, <strong>${L(RISER)}</strong>, <strong>${L(ARRIVAL)}</strong> and <strong>${L(STEADY)}</strong>.` },
          { id: "map-explore", state: { controls: true }, html: `Today the field spans <strong>${D.topics.macro.length} distinct areas</strong>. Press play to watch the full evolution, or drag the slider to any year.`, mount: (card, viz) => mountMapControls(card, viz) },
        ],
      },
      { kind: "interlude", text: "How did each theme grow and change over time?" },
      {
        title: "Research Themes: Individual Trajectories",
        make: (el, ctx) => smallMultiples(el, ctx, { years, series, counts: tot }),
        steps: [
          { id: "sm-overview", state: {}, html: `Each chart shows a theme's share of all articles published that year. I computed these as simple proportions: the number of papers assigned to each theme divided by the total published that year.` },
          { id: "sm-decline", state: { highlight: DECLINE }, html: `<strong>${L(DECLINE)}</strong> was the field's largest theme in the 1980s, with ${S(DECLINE, 1980, 1989)}% of papers. Its share has fallen steadily, to ${S(DECLINE, 2020, Y1)}% in 2020–${Y1}.` },
          { id: "sm-explosive", state: { highlight: EXPLOSIVE }, html: `<strong>${L(EXPLOSIVE)}</strong> accounted for only ${S(EXPLOSIVE, 1980, 1989)}% of papers in the 1980s. It has grown into the field's largest area, at ${S(EXPLOSIVE, 2020, Y1)}% in 2020–${Y1}.` },
          { id: "sm-steady", state: { highlight: STEADY }, html: `<strong>${L(STEADY)}</strong> has grown steadily, from ${S(STEADY, 1980, 1989)}% of papers in the 1980s to ${S(STEADY, 2020, Y1)}% in 2020–${Y1}.` },
          { id: "sm-arrivals", state: { highlight: ARRIVAL }, html: `<strong>${L(ARRIVAL)}</strong> held about ${S(ARRIVAL, 1980, 1999)}% of papers through the 1980s and 1990s. It has grown since 2000 and now accounts for ${S(ARRIVAL, 2020, Y1)}%.` },
          { id: "sm-foundation", state: { highlight: FOUNDATION }, html: `<strong>${L(FOUNDATION)}</strong> has been a consistent presence throughout, between ${f1(d3.min(found))}% and ${f1(d3.max(found))}% of papers in every decade.` },
          { id: "sm-shift", state: { highlight: [EXPLOSIVE, RISER, DECLINE] }, html: `Today, both <strong>${L(EXPLOSIVE)}</strong> (${S(EXPLOSIVE, 2020, Y1)}%) and <strong>${L(RISER)}</strong> (${S(RISER, 2020, Y1)}%) account for a larger share of published research than <strong>${L(DECLINE)}</strong> (${S(DECLINE, 2020, Y1)}%).` },
        ],
      },
    ],
  };
}
