import type { AnalysisResult, ChecklistItem, ItemCategory, ItemStatus, NoticeDocument } from "../core/types";

const CATEGORY_META: Record<ItemCategory, { heading: string; order: number }> = {
  do: { heading: "Do this", order: 0 },
  dates: { heading: "Dates & deadlines", order: 1 },
  documents: { heading: "Papers the letter may ask for", order: 2 },
  rights: { heading: "Good to know", order: 3 },
  contacts: { heading: "Who to call or write", order: 4 },
  "not-said": { heading: "What this letter does not say", order: 5 }
};

const STATUS_LABEL: Record<ItemStatus, { label: string; cls: string }> = {
  action: { label: "Action", cls: "chip-action" },
  deadline: { label: "Deadline", cls: "chip-deadline" },
  "deadline-unknown": { label: "Deadline: not stated", cls: "chip-unknown" },
  "deadline-unclear": { label: "Deadline: unclear", cls: "chip-unknown" },
  "deadline-conflict": { label: "Conflicting dates", cls: "chip-conflict" },
  conditional: { label: "Only if…", cls: "chip-cond" },
  info: { label: "Info", cls: "chip-info" },
  warning: { label: "Watch out", cls: "chip-warning" },
  unknown: { label: "Not stated", cls: "chip-unknown" }
};

const PROGRAM_LABEL = { checked: "marked", unchecked: "listed, not marked", undetermined: "not readable" } as const;

let flashTimer: number | undefined;

export function renderResult(doc: NoticeDocument, result: AnalysisResult): void {
  renderSource(doc);
  renderChecklist(result);
  renderHeader(doc, result);
}

function renderHeader(doc: NoticeDocument, result: AnalysisResult): void {
  const title = document.querySelector<HTMLHeadingElement>("#doc-title")!;
  const sub = document.querySelector<HTMLElement>("#doc-sub")!;
  title.textContent = `Checklist for “${doc.sourceName}”`;
  const parts: string[] = [];
  if (result.formTitle) parts.push(result.formTitle);
  if (result.noticeDate) parts.push(`issued ${result.noticeDate.raw}`);
  sub.textContent = parts.join(" · ");

  const chips = document.querySelector<HTMLElement>("#program-chips")!;
  chips.innerHTML = "";
  for (const p of result.programs) {
    const chip = document.createElement("span");
    chip.className = `prog prog-${p.state}`;
    chip.textContent = `${p.name}: ${PROGRAM_LABEL[p.state]}`;
    if (p.evidence) {
      chip.tabIndex = 0;
      chip.role = "button";
      chip.title = `“${p.evidence.quote}” — page ${p.evidence.page}`;
      const go = () => scrollToLine(p.evidence!.page, p.evidence!.lineIndex);
      chip.addEventListener("click", go);
      chip.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }
    chips.appendChild(chip);
  }

  const warn = document.querySelector<HTMLElement>("#warnings")!;
  warn.innerHTML = "";
  for (const w of result.warnings) {
    const div = document.createElement("div");
    div.className = "warn-banner";
    div.textContent = w;
    warn.appendChild(div);
  }
}

function renderSource(doc: NoticeDocument): void {
  const view = document.querySelector<HTMLElement>("#source-view")!;
  view.innerHTML = "";
  for (const page of doc.pages) {
    const h = document.createElement("h4");
    h.className = "page-head";
    h.textContent = `Page ${page.pageNumber}`;
    view.appendChild(h);
    for (const line of page.lines) {
      const div = document.createElement("div");
      div.className = "src-line";
      div.id = `src-${line.page}-${line.lineIndex}`;
      div.textContent = line.text;
      view.appendChild(div);
    }
  }
}

function scrollToLine(page: number, lineIndex: number): void {
  const el = document.getElementById(`src-${page}-${lineIndex}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  // restart animation
  void el.offsetWidth;
  el.classList.add("flash");
  if (flashTimer) window.clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => el.classList.remove("flash"), 2600);
}

function renderChecklist(result: AnalysisResult): void {
  const host = document.querySelector<HTMLElement>("#checklist")!;
  host.innerHTML = "";
  const groups = new Map<ItemCategory, ChecklistItem[]>();
  for (const it of result.items) {
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category)!.push(it);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => CATEGORY_META[a[0]].order - CATEGORY_META[b[0]].order
  );
  for (const [cat, its] of ordered) {
    const section = document.createElement("section");
    section.className = "cl-group";
    const h = document.createElement("h4");
    h.textContent = CATEGORY_META[cat].heading;
    section.appendChild(h);
    for (const it of its) {
      section.appendChild(renderItem(it));
    }
    host.appendChild(section);
  }
}

function renderItem(it: ChecklistItem): HTMLElement {
  const det = document.createElement("details");
  det.className = `cl-item st-${it.status}`;

  const sum = document.createElement("summary");
  const chip = document.createElement("span");
  const meta = STATUS_LABEL[it.status];
  chip.className = `chip ${meta.cls}`;
  chip.textContent = meta.label;
  const t = document.createElement("span");
  t.className = "cl-title";
  t.textContent = it.title;
  sum.appendChild(chip);
  sum.appendChild(t);
  det.appendChild(sum);

  const body = document.createElement("div");
  body.className = "cl-body";
  if (it.detail) {
    const d = document.createElement("p");
    d.className = "cl-detail";
    d.textContent = it.detail;
    body.appendChild(d);
  }
  if (it.evidence.length > 0) {
    const list = document.createElement("ul");
    list.className = "ev-list";
    for (const e of it.evidence) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "ev-quote";
      btn.innerHTML = `<span class="ev-page">p.${e.page}</span> “${escapeHtml(e.quote)}”`;
      btn.addEventListener("click", () => scrollToLine(e.page, e.lineIndex));
      li.appendChild(btn);
      list.appendChild(li);
    }
    body.appendChild(list);
  } else {
    const p = document.createElement("p");
    p.className = "muted small";
    p.textContent = "No matching sentence in the text we could read.";
    body.appendChild(p);
  }
  det.appendChild(body);
  return det;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
