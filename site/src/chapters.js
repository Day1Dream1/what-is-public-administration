export const CHAPTERS = [
  {
    id: "field-map",
    label: "The field over time",
    summary: "Start with the research map and compare how the share of selected themes changed between two periods.",
  },
  {
    id: "ideas",
    label: "Ideas and theories",
    summary: "Follow the title language of reform, motivation and representation over time.",
  },
  {
    id: "journals",
    label: "Five journals, one field",
    summary: "Hold the map steady, switch journals and see their different emphases.",
  },
  {
    id: "methods-in-titles",
    label: "Methods in titles",
    summary: "Trace when authors put case studies, experiments and evidence syntheses in their titles.",
  },
  {
    id: "methods-and-questions",
    label: "Methods and questions",
    summary: "Compare where case-study and experiment wording appears across research themes.",
  },
];

export function chapterRoute(id) {
  return `chapters/${id}`;
}

export function chapterHref(id) {
  return `#/${chapterRoute(id)}`;
}

export function chapterList() {
  return `<ol class="chapter-index" role="list">
    ${CHAPTERS.map((chapter, i) => `
      <li>
        <a class="chapter-index-link" href="${chapterHref(chapter.id)}">
          <span class="chapter-number" aria-hidden="true">${i + 1}</span>
          <span class="chapter-index-copy"><strong>${chapter.label}</strong><span>${chapter.summary}</span></span>
          <span class="chapter-index-arrow" aria-hidden="true">→</span>
        </a>
      </li>`).join("")}
  </ol>`;
}

export function renderChapterIndex(root) {
  root.innerHTML = `<section class="section">
    <div class="container">
      <h1 class="title">Chapters</h1>
      <p class="section-sub">Start with the field as a whole, then read what the five journals reveal about ideas and methods.</p>
      ${chapterList()}
    </div>
  </section>`;
}
