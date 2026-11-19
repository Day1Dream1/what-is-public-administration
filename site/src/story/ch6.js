// Chapter 6 · What we learned
// Reference: whatisstrategy.org/chapters/conclusion (6 + 5 steps, then a static close).
import * as d3 from "d3";
import { synthesis } from "./charts.js";
import { evMany, f1 } from "./evidence.js";

export default async function (D) {
  const E = await evMany(["ch6_synthesis", "ch2_theories", "ch2_orientation", "ch3_citations", "ch3_fragmentation", "ch4_methods", "ch5_periphery", "ch5_importance"]);
  const S = E.ch6_synthesis, T = E.ch2_theories, O = E.ch2_orientation, C = E.ch3_citations, F = E.ch3_fragmentation, M = E.ch4_methods;
  const ready = O.status === "ready";
  const Y = S.years, Y1 = Y.at(-1);
  const npm = T.series.find((s) => s.key === "npm");
  const npmPeak = d3.max(npm.rate);
  const eff = F.metrics.effective.values;
  const mean = (vals, a, b) => d3.mean(Y.map((y, i) => (y >= a && y <= b ? vals[i] : null)).filter((x) => x != null));
  const cross = C.status === "ready" ? Math.round(100 * C.cross_share) : null;
  const imp = E.ch5_importance;
  const split = (make) => ({ layout: "split", title: "Four trends, 1980–" + Y1, make });

  return {
    title: "What we learned",
    dek: `Four trends: fading grand frameworks, ${ready ? "rising phenomenon-driven research" : "a turn toward concrete public problems"}, more causal methods, persistent coherence. What they tell us about where public administration is headed.`,
    stats: [[String(Y.length), "years of data"], ["4", "converging trends"]],
    sections: [
      {
        ...split((el, ctx) => synthesis(el, ctx, S)),
        steps: [
          { id: "syn-intro", state: {}, html: `The previous chapters each traced a single thread: how public administration research frames its questions, what methods it uses, and whether the field holds together as it grows. Each thread revealed a distinct shift. Viewed together, <strong>four trends converged over ${Y.length} years</strong> to reshape the field in ways no single trend captures.` },
          { id: "syn-theory", state: { emph: "theory" }, html: ready
            ? `The role of grand theory followed a rise-and-fall path. <strong>Theory-driven papers</strong> peaked around ${O.peak.year} at roughly ${Math.round(O.peak.theory)}% of papers and have fallen since. The field did not abandon theory so much as change the work theory is asked to do.`
            : `The role of grand theory followed a rise-and-fall path. Explicit mentions of New Public Management, principal–agent theory and institutional theory peaked at <strong>${f1(T.featured_peak.rate)}% of abstracts around ${T.featured_peak.year}</strong> and fell to ${f1(T.featured_latest)}% by ${Y1}. <span class="pending-note">The amber theory-driven line appears once the LLM labels are generated.</span>` },
          { id: "syn-phenomenon", state: { emph: "phenomenon" }, html: ready
            ? `As the theory-driven share receded, <strong>phenomenon-driven research</strong> rose to about ${Math.round(O.recent_phenomenon)}% of recent papers. These studies begin from reforms, services and public problems rather than from the predictions of a framework.`
            : `As those frameworks receded, the growing sub-areas were organised around concrete public problems: co-production, trust and corruption, frontline discretion, representation. <span class="pending-note">The blue phenomenon-driven line appears once the LLM labels are generated.</span>` },
          { id: "syn-methods", state: { emph: "causal" }, html: `The methodological transformation is visible in the orange line. <strong>Causal identification methods</strong> rose from almost nothing before 2000 to ${f1(mean(M.any_causal, 2021, Y1))}% of abstracts in 2021–${Y1}, led by survey and field experiments. Adoption remains uneven across research areas.` },
          { id: "syn-coherence", state: { emph: "coherence" }, html: `One might expect these shifts to fragment the field, but the evidence suggests otherwise. ${cross != null ? `Roughly <strong>${cross}% of citations cross area boundaries</strong>, and ` : ""}<strong>semantic coherence</strong> has held steady since the 1980s, even as the number of effective paradigms grew from ${f1(eff[0])} to ${f1(d3.max(eff))} at its peak. That growth reflects the expanding scope of the field, not its dissolution.` },
          { id: "syn-together", state: {}, html: `Taken together, these trends describe one structural change. Public administration moved from a field organised around a few <strong>grand frameworks</strong> toward one organised around <strong>concrete public problems</strong>, studied with more experimental and quasi-experimental designs, yet still intellectually connected. Whether this is progress depends on one's philosophy of science. The data describe the shift; they do not evaluate it.` },
        ],
      },
      { kind: "interlude", text: "How should we understand this transformation?" },
      {
        ...split((el, ctx) => synthesis(el, ctx, S)),
        steps: [
          { id: "phil-kuhn", state: {}, html: `Thomas Kuhn argued that scientific fields advance through <strong>paradigm shifts</strong>: a dominant framework enters crisis and a new one replaces it. The decline of New Public Management, from ${f1(npmPeak)}% of abstracts at its peak to ${f1(npm.rate.at(-1))}% in ${Y1}, looks at first like such a crisis. But no single framework took its place. What we observe is less a paradigm shift than a move from theoretical consolidation to theoretical pluralism.` },
          { id: "phil-lamppost", state: {}, html: `A persistent worry, the <strong>lamppost effect</strong>, holds that causal methods pull researchers toward questions that are convenient rather than important. In these journals, causal papers sit only slightly farther from the centre of the map (Cohen's d = ${E.ch5_periphery.test.cohens_d.toFixed(2)}). ${imp.status === "ready" ? `Their question-importance scores are ${imp.importance.causal_mean >= imp.importance.noncausal_mean ? "no lower" : "slightly lower"} than other papers'.` : "The question-importance scores will test the concern more directly."} The analysis is observational, so the right conclusion is that the evidence does not show a strong effect, not that the concern has been refuted.` },
          { id: "phil-new-paradigm", state: {}, html: `If the field has not adopted a new grand theory, it may have adopted something else: a <strong>methodological commitment to credible evidence</strong>. Experiments, panel designs and natural experiments give scholars studying very different questions a shared standard for what counts as a convincing answer.` },
          { id: "phil-trading", state: {}, html: `If shared theory no longer unifies the field, what does? Peter Galison described <strong>"trading zones"</strong>, where communities with different theories coordinate through shared tools and practices. ${cross != null ? `Cross-area citation (${cross}%) and ` : ""}steady semantic coherence suggest public administration works in this way.` },
          { id: "phil-stokes", state: {}, html: `Donald Stokes distinguished research driven by curiosity (Bohr's quadrant), by application (Edison's) and by both (<strong>Pasteur's quadrant</strong>). Public administration has always sat close to Pasteur's quadrant. The turn toward concrete public problems makes that position more explicit. Whether the field can keep both rigour and relevance is a question these data cannot settle.` },
        ],
      },
      { kind: "prose", html: `<p>These ${Y.length} years of research describe a field that broadened its topics, loosened its attachment to a few big frameworks and raised its standard of evidence, without breaking apart.</p>
        <p>What the data cannot show is whether the field now knows more. Cumulative knowledge depends on how findings add up across studies, which is beyond what titles, abstracts and citation counts can measure.</p>
        <p class="muted" style="font-size:14px">Every chart on this site can be explored further. The map, theme trajectories, journal profiles, citation flows and methods data are in Explore.</p>` },
    ],
  };
}
