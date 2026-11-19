// The six chapters, mirroring What is Strategy?'s chapter structure one-to-one.
// `nav` is the question shown in the sidebar; the chapter page's H1 can be an answer.
export const CHAPTERS = [
  { id: "what-is-public-administration", nav: "What is public administration — and how has the field evolved?", load: () => import("./story/ch1.js") },
  { id: "big-theories", nav: "What happened to the big theories?", load: () => import("./story/ch2.js") },
  { id: "fracturing", nav: "Is the public administration field fracturing?", load: () => import("./story/ch3.js") },
  { id: "methods", nav: "What methods do scholars use?", load: () => import("./story/ch4.js") },
  { id: "methods-shaping-questions", nav: "Are our methods shaping the questions we ask?", load: () => import("./story/ch5.js") },
  { id: "conclusion", nav: "What we learned", load: () => import("./story/ch6.js") },
];

// Earlier chapter routes keep working.
export const LEGACY_CHAPTER_ROUTES = {
  findings: "chapters/what-is-public-administration",
  "chapters/field-map": "chapters/what-is-public-administration",
  "chapters/ideas": "chapters/big-theories",
  "chapters/journals": "explore/journals",
  "chapters/methods-in-titles": "chapters/methods",
  "chapters/methods-and-questions": "chapters/methods-shaping-questions",
  trends: "explore/topics",
  methods: "about",
};

export const chapterRoute = (id) => `chapters/${id}`;
export const chapterHref = (id) => `#/${chapterRoute(id)}`;

export function chapterList() {
  return `<ol class="chapter-index" role="list">
    ${CHAPTERS.map((c, i) => `<li><a class="chapter-index-link" href="${chapterHref(c.id)}">
      <span class="chapter-number" aria-hidden="true">${i + 1}</span>
      <span class="chapter-index-copy"><strong>${c.nav}</strong></span>
      <span class="chapter-index-arrow" aria-hidden="true">→</span></a></li>`).join("")}
  </ol>`;
}

export function renderChapterIndex(root) {
  root.innerHTML = `<section class="hero"><div class="container hero-inner" style="padding:56px 0 40px">
      <p class="kicker">Chapters</p>
      <h1 class="title">Six questions about public administration research</h1>
      <p class="dek">Each chapter asks one question and answers it with a different kind of evidence from the same corpus.</p>
    </div></section>
    <section class="section"><div class="container">${chapterList()}</div></section>`;
}
