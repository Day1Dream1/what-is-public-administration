// Scroll-story engine shared by the six chapters (pattern from What is Strategy?):
// hero → [sticky visual with step cards scrolling over it] → interlude question → … → Up Next.
// A step becomes active when its card crosses the viewport midline; the visual gets set(state, i).
// Visuals may also receive progress(p) (0–1 through their section) for continuous animation.
import { SITE } from "../config.js";
import { CHAPTERS, chapterHref } from "../chapters.js";
import { esc } from "../data.js";

export async function renderChapter(root, D, index) {
  const chapter = CHAPTERS[index];
  const mod = await chapter.load();
  const spec = await mod.default(D);
  const prev = CHAPTERS[index - 1], next = CHAPTERS[index + 1];
  let n = 0;

  root.innerHTML = `
  <article class="chapter" data-chapter="${chapter.id}">
    <section class="hero"><div class="container hero-inner chapter-hero">
      <p class="kicker">Chapter ${index + 1}</p>
      <h1 class="title">${spec.title}</h1>
      <p class="dek">${spec.dek}</p>
      <div class="stats">${spec.stats.map(([v, l]) => `<div class="stat"><b class="num">${v}</b><span>${l}</span></div>`).join("")}</div>
    </div></section>
    ${spec.sections.map((s, si) => {
      if (s.kind === "interlude") return `<div class="interlude" data-interlude><div class="q"><p>${s.text}</p></div></div>`;
      if (s.kind === "prose") return `<section class="story-prose"><div class="container prose">${s.html}</div></section>`;
      return `<section class="story ${s.layout === "split" ? "story-split" : ""}" data-sec="${si}" aria-label="${esc(s.title)}">
        <div class="story-sticky">
          <div class="viz-bar"><div class="vb-left"><h3 class="vt">${s.title}</h3><div class="vb-extra"></div></div><span class="vy" aria-live="polite"></span></div>
          <div class="viz"></div>
          <div class="progress-dots" aria-hidden="true">${s.steps.map(() => "<i></i>").join("")}</div>
        </div>
        <div class="steps">${s.steps.map((st, i) => `<div class="step" data-step="${i}" data-id="${st.id}">
          <div class="step-card"><span class="n">${String(i + 1).padStart(2, "0")}</span><div class="step-text">${st.html}</div></div></div>`).join("")}
        </div>
      </section>`;
    }).join("")}
    <footer class="upnext">
      ${next ? `<p class="kicker-sm">Up next</p><h2>Chapter ${index + 2}: ${next.nav}</h2>
        <a class="btn" href="${chapterHref(next.id)}">Continue reading <span aria-hidden="true">→</span></a>`
        : `<p class="kicker-sm">You've reached the end</p><h2>Explore the data yourself</h2>
        <a class="btn" href="#/explore">Open the field map <span aria-hidden="true">→</span></a>`}
      <div class="links">
        ${prev ? `<a href="${chapterHref(prev.id)}">Ch. ${index}: ${prev.nav}</a>` : ""}
        <a href="#/explore">Explore the data</a><a href="#/about">About this project</a>
      </div>
      <p class="credit">Created by <strong>${esc(SITE.author)}</strong>${SITE.affiliation ? ` · ${esc(SITE.affiliation)}` : ""} · Data ${esc(D.manifest.data_version)}</p>
    </footer>
  </article>`;

  const cleanups = [];
  const stories = [];
  root.querySelectorAll(".story").forEach((el) => {
    const s = spec.sections[+el.dataset.sec];
    const valueEl = el.querySelector(".vy");
    const ctx = {
      D, extra: el.querySelector(".vb-extra"),
      setValue: (v) => { valueEl.textContent = v ?? ""; },
    };
    const viz = s.make(el.querySelector(".viz"), ctx);
    cleanups.push(() => viz.destroy?.());
    const cards = [...el.querySelectorAll(".step-card")];
    const dots = [...el.querySelectorAll(".progress-dots i")];
    let active = -1;
    const activate = (i) => {
      if (i === active) return;
      active = i;
      cards.forEach((c, k) => c.classList.toggle("active", k === i));
      dots.forEach((d, k) => d.classList.toggle("on", k === i));
      viz.set(s.steps[i].state || {}, i);
    };
    s.steps.forEach((st, i) => st.mount?.(cards[i], viz, ctx));
    activate(0);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) activate(+e.target.dataset.step);
    }, { rootMargin: "-50% 0px -50% 0px" });
    el.querySelectorAll(".step").forEach((st) => io.observe(st));
    cleanups.push(() => io.disconnect());
    stories.push({ el, viz });
  });

  // continuous progress + interlude fades + immersive mode while a question is centred
  const inter = [...root.querySelectorAll("[data-interlude]")];
  let raf = 0;
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      for (const { el, viz } of stories) {
        if (!viz.progress) continue;
        const r = el.getBoundingClientRect();
        viz.progress(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight))));
      }
      let immersive = false;
      for (const el of inter) {
        const r = el.getBoundingClientRect();
        const prog = -r.top / Math.max(1, r.height - innerHeight);
        const o = prog < 0 ? Math.max(0, 1 + prog * 2.5) : prog > 1 ? Math.max(0, 1 - (prog - 1) * 2.5) : 1;
        el.querySelector("p").style.opacity = o.toFixed(2);
        if (prog > 0.05 && prog < 0.95) immersive = true;
      }
      document.body.classList.toggle("immersive", immersive);
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  cleanups.push(() => { removeEventListener("scroll", onScroll); document.body.classList.remove("immersive"); });
  return () => cleanups.forEach((f) => f());
}
