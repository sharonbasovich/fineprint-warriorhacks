import type { AnalysisResult, ChecklistItem, ItemCategory, ItemStatus, NoticeDocument } from "../core/types";

const CATEGORY_META: Record<ItemCategory, { heading: string; order: number }> = {
  do: { heading: "Do this", order: 0 },
  dates: { heading: "Dates & timing mentioned", order: 1 },
  documents: { heading: "Papers the letter may ask for", order: 2 },
  rights: { heading: "Good to know", order: 3 },
  contacts: { heading: "Who to call or write", order: 4 },
  "not-said": { heading: "What this letter does not say", order: 5 }
};

const STATUS_LABEL: Record<ItemStatus, { label: string; cls: string }> = {
  action: { label: "Action", cls: "chip-action" },
  excerpt: { label: "Quoted timing", cls: "chip-info" },
  conditional: { label: "Only if…", cls: "chip-cond" },
  info: { label: "Info", cls: "chip-info" },
  warning: { label: "Watch out", cls: "chip-warning" },
  unknown: { label: "Check letter", cls: "chip-unknown" }
};

const PROGRAM_LABEL = { checked: "marked", unchecked: "listed, not marked", undetermined: "not readable" } as const;

let selectedSource: HTMLElement | undefined;
let originatingQuote: HTMLElement | undefined;
let returnToQuote: HTMLButtonElement | undefined;

export function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

export function clearSourceSelection(): void {
  selectedSource?.classList.remove("selected-source", "flash");
  selectedSource?.removeAttribute("aria-current");
  returnToQuote?.remove();
  selectedSource = undefined;
  originatingQuote = undefined;
  returnToQuote = undefined;
  document.querySelector<HTMLElement>("#source-selection")!.textContent = "No source passage selected.";
}

function readSourceButton(page: number, lineIndex: number, quote: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "source-link";
  button.textContent = "Read source";
  button.setAttribute("aria-label", `Read source, page ${page}, line ${lineIndex + 1}`);
  button.addEventListener("click", () => {
    scrollToLine(page, lineIndex, quote);
    selectedSource?.focus({ preventScroll: true });
  });
  return button;
}

export function renderResult(doc: NoticeDocument, result: AnalysisResult): void {
  renderSource(doc);
  renderChecklist(result);
  renderHeader(doc, result);
}

function renderHeader(doc: NoticeDocument, result: AnalysisResult): void {
  const title = document.querySelector<HTMLHeadingElement>("#doc-title")!;
  const sub = document.querySelector<HTMLElement>("#doc-sub")!;
  title.textContent = result.supported
    ? `What the letter says — “${doc.sourceName}”`
    : `Unsupported document — “${doc.sourceName}”`;
  const parts: string[] = [];
  if (result.formTitle) parts.push(result.formTitle);
  if (result.noticeDate) parts.push(`date on form: ${result.noticeDate.raw}`);
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
      const go = () => scrollToLine(p.evidence!.page, p.evidence!.lineIndex, chip);
      chip.addEventListener("click", go);
      chip.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }
    chips.appendChild(chip);
    if (p.evidence) chips.appendChild(readSourceButton(p.evidence.page, p.evidence.lineIndex, chip));
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
  clearSourceSelection();
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
      div.tabIndex = -1;
      div.addEventListener("animationend", () => div.classList.remove("flash"));
      view.appendChild(div);
    }
  }
}

function scrollToLine(page: number, lineIndex: number, quote: HTMLElement): void {
  const el = document.getElementById(`src-${page}-${lineIndex}`);
  if (!el) return;
  clearSourceSelection();
  selectedSource = el;
  originatingQuote = quote;
  el.classList.add("selected-source");
  el.setAttribute("aria-current", "true");
  document.querySelector<HTMLElement>("#source-selection")!.textContent =
    `Selected source: page ${page}, line ${lineIndex + 1}.`;
  returnToQuote = document.createElement("button");
  returnToQuote.type = "button";
  returnToQuote.className = "source-link return-to-quote";
  returnToQuote.textContent = "Return to quote";
  returnToQuote.addEventListener("click", () => {
    if (!originatingQuote?.isConnected) return;
    const card = originatingQuote.closest("details");
    if (card) card.open = true;
    originatingQuote.focus({ preventScroll: true });
    originatingQuote.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  });
  el.after(returnToQuote);
  el.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
  if (preferredScrollBehavior() !== "instant") el.classList.add("flash");
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
      btn.type = "button";
      btn.dataset.sourceId = `src-${e.page}-${e.lineIndex}`;
      btn.innerHTML = `<span class="ev-page">p.${e.page}</span> “${escapeHtml(e.quote)}”`;
      btn.addEventListener("click", () => scrollToLine(e.page, e.lineIndex, btn));
      li.appendChild(btn);
      li.appendChild(readSourceButton(e.page, e.lineIndex, btn));
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
