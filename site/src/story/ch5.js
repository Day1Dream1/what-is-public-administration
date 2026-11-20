// Chapter 5 · Are our methods shaping the questions we ask?
// Reference: whatisstrategy.org/chapters/methods-shaping-questions (5 + 4 steps).
import { fmt } from "../data.js";
import { boxPlots, periphery } from "./charts.js";
import { evMany } from "./evidence.js";

const p = (v) => (v < 0.001 ? "< 0.001" : `= ${v.toFixed(v < 0.01 ? 3 : 2)}`);

export default async function (D) {
  const { ch5_periphery: P, ch5_importance: I, paper_codes: codes } = await evMany(["ch5_periphery", "ch5_importance", "paper_codes"]);
  const t = P.test, sig = t.p < 0.05;
  const farther = P.mean_causal > P.mean_noncausal;
  const ready = I.status === "ready";
  const cmp = (k) => {
    const d = I[k];
    return `${d.causal_mean > d.noncausal_mean ? "higher" : "lower"} on question ${k} (${d.causal_mean.toFixed(2)} vs ${d.noncausal_mean.toFixed(2)}, p ${p(d.p)}, Cohen's d = ${d.cohens_d.toFixed(2)})`;
  };
  const pend = `<span class="pending-note">The scores have not been generated yet; this panel fills in after <code>python -m pa_map classify</code>.</span>`;

  return {
    title: "Are our methods shaping the questions we ask?",
    dek: `The lamppost problem: does methodological rigour push researchers toward peripheral, easier questions? I tested it directly. In these journals, causal papers sit ${farther ? "slightly farther from" : "no farther from"} the centre of the field than other papers${sig ? ", and the difference is small" : ""}.`,
    stats: [[fmt(P.n_causal), "causal papers tested"], [`p ${p(t.p)}`, `${sig ? "small" : "no sig."} difference in centrality (d = ${t.cohens_d.toFixed(2)})`]],
    sections: [
      {
        title: "Papers in Semantic Space",
        make: (el, ctx) => periphery(el, ctx, D, codes, P),
        steps: [
          { id: "ps-lamppost", state: { show: "both" }, html: `The rise of causal methods raises a concern often heard in methods debates: does the push for rigour drive researchers toward questions where clean identification is possible, rather than the field's most important questions? This is sometimes called the <strong>"lamppost problem"</strong>. I tested it two ways.` },
          { id: "ps-noncausal", state: { show: "non" }, html: `First, I plotted each paper's position in the field's semantic landscape, based on its title and abstract. Here are the <strong>${fmt(P.n_noncausal)} papers</strong> that name no causal method. Each dot is a paper. Dashed rings mark distance from the field's centre.` },
          { id: "ps-causal", state: { show: "causal" }, html: `Now the <strong>${fmt(P.n_causal)} causal papers</strong> alone. If causal methods pushed researchers toward peripheral questions, these points would cluster at the edges of the map.` },
          { id: "ps-both", state: { show: "both" }, html: `Together, the two groups overlap across most of the map. Causal papers are not confined to the margins, though they are denser in some regions than others.` },
          { id: "ps-distance", state: { show: "both" }, html: `Quantitatively, the mean distance from the centre is <strong>${P.mean_causal.toFixed(3)}</strong> for causal papers and <strong>${P.mean_noncausal.toFixed(3)}</strong> for the rest (map units). ${sig ? `The difference is statistically significant (p ${p(t.p)}) but small (Cohen's d = ${t.cohens_d.toFixed(2)}): causal papers sit ${farther ? "slightly farther out" : "slightly closer in"}.` : `The difference is not statistically significant (p ${p(t.p)}).`}` },
        ],
      },
      { kind: "interlude", text: `Causal papers are ${farther && sig ? "only slightly off-centre" : "not at the periphery"}. But are they studying important questions?` },
      {
        title: "Question Importance & Scope",
        make: (el, ctx) => boxPlots(el, ctx, I),
        steps: [
          { id: "qi-setup", state: {}, html: `I took the test further. Using an LLM${ready ? ` (${I.model})` : ""}, I scored every paper's research question on two dimensions: <strong>importance</strong> (practical and theoretical significance) and <strong>scope</strong> (breadth of applicability). Each paper received a score from 1 to 10.${ready ? "" : " " + pend}${ready && I.validation ? ` A human check of ${I.validation.n} articles found that the model ranks scope roughly as a person would (ρ = ${I.validation.scope_rho.toFixed(2)}) but importance only weakly (ρ = ${I.validation.importance_rho.toFixed(2)}), so treat these scores as rough.` : ""}` },
          { id: "qi-importance", state: { emph: "importance" }, html: ready ? `Causal papers score ${cmp("importance")}.` : `This step will compare <strong>importance</strong> scores for causal and other papers.` },
          { id: "qi-scope", state: { emph: "scope" }, html: ready ? `They score ${cmp("scope")}.` : `…and this one <strong>scope</strong> scores.` },
          { id: "qi-verdict", state: {}, html: ready
            ? `${I.importance.causal_mean >= I.importance.noncausal_mean && I.scope.causal_mean >= I.scope.noncausal_mean ? "The lamppost problem is not reflected in the scores. Causal papers address questions that are at least as important and as broad as other papers'." : "The scores give some support to the lamppost concern, but the effect sizes are small."} These are model ratings of an observational sample, so they describe associations, not causes.`
            : `Until the scores are in, the answer to the lamppost question rests on the map: causal papers are spread across the field, with a small tilt toward its edges.` },
        ],
      },
    ],
  };
}
