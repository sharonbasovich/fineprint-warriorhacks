/**
 * Deterministic, source-grounded analysis of a benefits-renewal notice.
 * Every emitted claim carries evidence (page + line + exact quote).
 * When the notice does not state something, we say so — we never infer it.
 */
import { allDateMentions } from "./dates";
import type {
  AnalysisResult,
  ChecklistItem,
  Evidence,
  ItemCategory,
  ItemStatus,
  NoticeDocument,
  ProgramEntry,
  ProgramState,
  SourceLine
} from "./types";

let nextId = 0;
function item(
  category: ItemCategory,
  status: ItemStatus,
  title: string,
  evidence: Evidence[],
  detail?: string
): ChecklistItem {
  return { id: `it-${nextId++}`, category, status, title, evidence, ...(detail ? { detail } : {}) };
}

function ev(line: SourceLine): Evidence {
  return { page: line.page, lineIndex: line.lineIndex, quote: line.text };
}

const CHECK_MARK_SENTENCE = /check[\s-]?mark|check(ed)?\s+next|benefits you need to renew/i;
const DUE_SECTION = /\bdue\s*dates?\b|\bdeadline\b|\bdue\s+by\b|\brespond\s+by\b/i;
const NEED_ITEMS =
  /items we need|things we need|verifications? (we need|you (must|need) (to )?(send|provide))|documents? (we need|you (must|need) (to )?(send|provide))|proof we need/i;
const RIGHTS = /\byour rights\b/i;
const CONSEQUENCE =
  /(might|may|could|will) not get (your )?benefits|benefits? (might|may|could|will) (end|stop)|lose (your )?benefits/i;
const RENEW_INTRO = /time to renew|renew your benefits|renewal notice/i;
const ONLINE_METHOD = /online|\.gov|\.com\b|website|log\s?in/i;
const MAIL_METHOD = /\bby mail|mail (the|this|your)|pre-paid envelope|return (the|this|your) form/i;
const FAX_METHOD = /\bfax/i;
const PHONE = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d-\d-\d\b|\b\d-\d{3}-\d{3}-\d{4}\b)/;
const NOTICE_DATE_LINE = /^date\s*:/i;

const KNOWN_PROGRAMS = [
  "CHIP Perinatal",
  "Health Care",
  "Medicaid",
  "Medicare Savings",
  "Healthy Texas Women",
  "Long-Term Care",
  "Food Stamps",
  "TANF",
  "SNAP",
  "CHIP",
  "SSI",
  "WIC"
];

const CHECKED_MARK = /(?:\[\s*[xX✓✔]\s*\]|\(\s*[xX✓✔]\s*\)|[☒☑✅])\s*$/;
const UNCHECKED_MARK = /(?:\[\s*\]|\(\s*\)|[☐□◻])\s*$/;

const BULLET = /^\s*(?:[•◦▪*‣·]|–|-(?=\s)|\d{1,2}[.)])\s+/;

function isBullet(text: string): boolean {
  return BULLET.test(text);
}

function stripBullet(text: string): string {
  return text.replace(BULLET, "").trim();
}

function looksLikeSectionHeader(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 60) return false;
  if (isBullet(t)) return false;
  return /:\s*$/.test(t) || /^[A-Z][A-Za-z ]{3,50}$/.test(t);
}

function collectLines(lines: SourceLine[], startIdx: number, maxLines: number): SourceLine[] {
  return lines.slice(startIdx, Math.min(lines.length, startIdx + maxLines));
}

/** gather bullet items starting after `startIdx` until a new section header */
function collectBullets(
  lines: SourceLine[],
  startIdx: number,
  maxLines = 60
): { text: string; lines: SourceLine[] }[] {
  const bullets: { text: string; lines: SourceLine[] }[] = [];
  let cur: { text: string; lines: SourceLine[] } | null = null;
  let consumed = 0;
  for (let i = startIdx; i < lines.length && consumed < maxLines; i++) {
    const line = lines[i]!;
    consumed++;
    if (isBullet(line.text)) {
      if (cur) bullets.push(cur);
      cur = { text: stripBullet(line.text), lines: [line] };
    } else if (cur) {
      if (
        CONTACT_LABEL.test(line.text.trim()) ||
        (looksLikeSectionHeader(line.text) &&
          !/^(and|or|the|a|an|that|which|to|for|if|you|it|in|of|must)\b/i.test(line.text))
      ) {
        break;
      }
      cur.text += " " + line.text.trim();
      cur.lines.push(line);
    } else {
      if (looksLikeSectionHeader(line.text)) break;
      if (consumed > 8) break;
    }
  }
  if (cur) bullets.push(cur);
  return bullets;
}

/** Extract "(only if ...)" conditions, counting paren depth so nested parens work. */
function conditionOf(text: string): string | null {
  const start = text.search(/\(\s*only\b/i);
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) {
          return text.slice(start + 1, i).trim();
        }
      }
    }
    return text.slice(start + 1).replace(/\)+$/, "").trim();
  }
  const m2 = text.match(/\b(only\s+(if|when|for)\b[^.:]*)/i);
  if (m2) return m2[1]!.trim();
  // "X if you pay rent", "proof of earnings if anyone has a job", …
  // but NOT "even if …" (required regardless of the condition) and NOT
  // fallback alternatives like "if you do not have one, bring any photo ID" —
  // those don't gate the document, they rescue it
  const IF_CLAUSE =
    /\b(?:even\s+)?if\s+(?:not\b|you\b|your\b|anyone\b|any person\b|a person\b|someone\b|they\b|them\b|the child\b|children\b|it\b|no\s+one\b|nobody\b|everyone\b)[^.:]{0,120}/gi;
  const NEGATED_FALLBACK =
    /^if\s+(?:you|anyone|any person|a person|someone|they|them|it|the child|children)\s+(?:do\s+not|don'?t|cannot|can'?t|can\s+not|will\s+not|won'?t|have\s+no|lack)\b/i;
  for (const m3 of text.matchAll(IF_CLAUSE)) {
    const clause = m3[0];
    if (/^even\s+if\b/i.test(clause)) continue;
    if (/^if\s+not\b/i.test(clause)) continue;
    if (NEGATED_FALLBACK.test(clause)) continue;
    return clause.trim();
  }
  // "…unless you are self-employed" gates a document the same way "if" does —
  // but "unless you do not have one" is again a fallback, not a gate
  const m4 = text.match(
    /\bunless\s+(?:you|your|anyone|any person|a person|someone|they|them|it|the child|children)\b[^.:]{0,120}/i
  );
  if (m4 && !NEGATED_FALLBACK.test(m4[0].replace(/^unless/i, "if"))) {
    return m4[0].trim();
  }
  return null;
}

function docItemTitle(text: string): string {
  // bullet starting with a condition — the document name is in the clause
  // after it: "If no one has income, sign the No Income Statement"
  if (/^(?:if|unless|even if)\b/i.test(text)) {
    const rest = text
      .replace(/^(?:if|unless|even if)\b[^,.;:]*[,]\s*/i, "")
      .replace(/^(?:sign|send|bring|complete|fill out|provide|show|include|attach|mail|give)\s+/i, "")
      .replace(/^(?:the|a|an|your|any|one|a new)\s+/i, "")
      .replace(/[,.;:]+$/, "")
      .trim();
    if (rest.length >= 3 && rest.length <= 80) return rest;
  }
  // "Proof of address. If you moved, send a new lease." — the document name
  // is the first sentence, not the conditional instruction after it
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  const colon = sentence.indexOf(":");
  const paren = sentence.indexOf("(");
  let cut = -1;
  for (const c of [colon, paren]) {
    if (c > 0 && (cut < 0 || c < cut)) cut = c;
  }
  if (cut > 0 && cut < 80) return sentence.slice(0, cut).trim();
  return sentence.split(/\s+/).slice(0, 8).join(" ").replace(/[,.;:!?]+$/, "");
}

/** a condition gates the document only when it sits in the doc's own clause —
 *  "Proof of address. If you moved, send a new lease." keeps the doc required
 *  and the later sentence stays verbatim in the detail instead */
function gateCondition(bullet: string): string | null {
  if (/^(?:if|unless|even if)\b/i.test(bullet)) {
    const m = bullet.match(/^(if|unless)\b[^,.;:]*/i);
    return m ? m[0].trim() : conditionOf(bullet);
  }
  const firstSentence = bullet.split(/(?<=[.!?])\s+/)[0] ?? bullet;
  return conditionOf(firstSentence);
}

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Find program names in a line and read the checkbox marker that precedes
 * each occurrence (e.g. "[x] SNAP [ ] TANF"). No marker => undetermined.
 */
function findProgramsInLine(text: string): { name: string; state: ProgramState }[] {
  const out: { name: string; state: ProgramState }[] = [];
  for (const name of KNOWN_PROGRAMS) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b`, "gi");
    for (const m of text.matchAll(re)) {
      const idx = m.index ?? 0;
      const prefix = text.slice(Math.max(0, idx - 12), idx);
      let state: ProgramState = "undetermined";
      if (CHECKED_MARK.test(prefix)) state = "checked";
      else if (UNCHECKED_MARK.test(prefix)) state = "unchecked";
      out.push({ name, state });
      break; // first occurrence only
    }
  }
  return out;
}

/**
 * Words that make a line a timing excerpt: a date anywhere, or an explicit
 * timing/instruction word. The excerpt index quotes these clauses verbatim —
 * it never decides which one is "the" deadline.
 */
const TIMING_WORDS =
  /\b(?:due|deadline|postmark\w*|within\s+\d+\s+days?|\d+\s+(?:calendar\s+|business\s+)?days?\b|as\s+soon\s+as|in\s+time\b|hear\s+from\s+you|appointment|interview|expir\w*|respond\s+by|reply\s+by|return\s+\w+\s+by|no\s+later\s+than|on\s+or\s+before|ends?|begin|start|close)\b/i;

const TIMING_HEADER = /^\s*(?:due\s*dates?|important\s*dates?|deadlines?|key\s*dates?)\s*:?\s*$/i;

// Provenance lines we add to bundled samples (source links, "SAMPLE" notes,
// extraction disclaimers) are metadata, not letter content — never quote them.
const ANNOTATION =
  /^source:|official public sample|text extracted locally|this is a sample form|synthetic demo document|invented for fineprint|not a real government notice|all names, dates|markers transcribed|document-comprehension demonstration|pasted below/i;

/** Is this line one of our own provenance notes rather than letter content? */
export function isAnnotationText(text: string): boolean {
  return ANNOTATION.test(text.trim());
}
// Record-style lines that start a new entry rather than continuing a
// sentence: "Call: 1-800…", "DATE: 01/23/2019", "CASE NO 123".
const FIELD_LABEL = /^[A-Za-z][A-Za-z0-9 ./#()'-]{0,20}:/;
// Short lines where every word is capitalized or all-caps ("CEDAR COUNTY
// BENEFITS", "Questions And Answers") are headers/letterhead — not wrapped
// sentence fragments. Limited to 5 words so a 6+-word all-caps OCR wrap
// lead-in like "YOU DO NOT NEED TO RETURN" still joins its date line.
const SHORT_CAPS_HEADER =
  /^([A-Z][a-z]+|[A-Z]{2,})(\s+([A-Z][a-z]+|[A-Z]{2,}))*$/;
// Contact-field lines — a trailing "Call: 1-800…" line after a document
// bullet is a new record, not part of the document requirement.
const CONTACT_LABEL = /^(call|fax|mail|phone|tty|email|visit|online|text)\s*[:#]/i;
const RECORD_LINE = /^[A-Z][A-Z .]*\s*[#:]?\s*[\d(]/;
const TERMINAL = /[.!?]["'”)]*\s*$/;

/** True when the line begins a new record/sentence rather than continuing
 *  the previous one (bullet, field label, section header). */
function startsNewRecord(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return isBullet(t) || FIELD_LABEL.test(t) || RECORD_LINE.test(t) || looksLikeSectionHeader(t);
}

export function analyze(doc: NoticeDocument): AnalysisResult {
  nextId = 0;
  // Shared boundary for EVERY output path: provenance lines we add to bundled
  // samples (SOURCE:, "This is a SAMPLE form…", extraction disclaimers) are
  // metadata about the document, not letter content. They stay visible in the
  // source pane, but are ineligible for evidence citations, summaries, scope
  // detection, and date mentions — nothing Fineprint emits may quote them.
  const lines = doc.pages
    .flatMap((p) => p.lines)
    .filter((l) => !isAnnotationText(l.text));
  const items: ChecklistItem[] = [];
  const warnings = [...doc.warnings];
  const allText = lines.map((l) => l.text).join(" ");

  // scope gate — Fineprint reads benefits renewal notices (H1830-R-style).
  // The gate requires renewal/benefits vocabulary, not just notice-shaped
  // structure, so an unrelated letter (a utility bill with a "due date", an
  // office memo) does not produce a renewal checklist. Anything else gets an
  // honest unsupported view: the text is shown as-is, and the reader is told
  // to check the full letter for timing instructions.
  const RENEWAL_VOCAB =
    /\b(renew\w*|renewal|benefit\w*|assistance|coverage|eligib\w*|SNAP|TANF|Medicaid|CHIP|WIC|SSI\b|HHSC|caseworker|case\s*(?:no\.?|number|worker))\b/i;
  const supported = RENEWAL_VOCAB.test(allText);
  if (!supported) {
    warnings.unshift(
      "Unsupported document: this text does not look like a benefits renewal notice — no checklist generated."
    );
    items.push(
      item("not-said", "warning", "This does not look like a benefits renewal notice", [],
        "Fineprint is scoped to renewal notices like Texas form H1830-R — it did not find renewal-notice structure here. The letter text is shown as-is; read it directly, and check for a deadline yourself.")
    );
    for (const w of warnings.slice(1)) {
      items.push(item("not-said", "warning", "Unreadable content", [], w));
    }
    return {
      supported: false,
      formTitle: null,
      noticeDate: null,
      programs: [],
      dates: allDateMentions(lines),
      items,
      warnings
    };
  }

  const dateMentions = allDateMentions(lines);

  // ---- form title / notice date ----
  const formLine = lines.find((l) => /\bform\s+[a-z]*\d/i.test(l.text));
  const formTitle = formLine ? formLine.text.trim() : null;
  const noticeDate =
    dateMentions.find((d) => d.kind === "notice-date") ??
    lines
      .filter((l) => NOTICE_DATE_LINE.test(l.text))
      .flatMap((l) => allDateMentions([l]))[0] ??
    null;

  // ---- programs ----
  const programs: ProgramEntry[] = [];
  const markIdx = lines.findIndex((l) => CHECK_MARK_SENTENCE.test(l.text));
  if (markIdx >= 0) {
    const window = collectLines(lines, markIdx, 6);
    const seen = new Map<string, ProgramState>();
    const evByName = new Map<string, Evidence>();
    for (const l of window) {
      for (const p of findProgramsInLine(l.text)) {
        // first definite state wins; undetermined never overwrites a real mark
        const prev = seen.get(p.name);
        if (!prev || (prev === "undetermined" && p.state !== "undetermined")) {
          seen.set(p.name, p.state);
          evByName.set(p.name, ev(l));
        }
      }
    }
    for (const [name, state] of seen) {
      programs.push({ name, state, evidence: evByName.get(name) ?? null });
    }
  }

  // ---- renewal action items ----
  const renewIdx = lines.findIndex((l) => RENEW_INTRO.test(l.text));
  const dueIdx = lines.findIndex((l) => DUE_SECTION.test(l.text));
  const methodEnd = dueIdx > renewIdx ? dueIdx : lines.length;
  const methodLines =
    renewIdx >= 0 ? lines.slice(renewIdx, methodEnd) : lines.slice(0, Math.min(lines.length, 40));

  if (renewIdx >= 0) {
    items.push(item("do", "action", "This letter asks you to renew your benefits", [ev(lines[renewIdx]!)]));
  }
  // method steps only appear inside a section a renewal intro opened, and
  // only on lines whose own words name renewing/form-work — a matched line
  // can never promote unrelated text (a bill's "pay online", "mail payment")
  // into a renewal step.
  const online =
    renewIdx >= 0
      ? methodLines.find(
          (l) => ONLINE_METHOD.test(l.text) && /renew|log|manage|account/i.test(l.text)
        )
      : undefined;
  if (online) {
    const extra = methodLines.filter(
      (l) => l.page === online.page && l.lineIndex > online.lineIndex && l.lineIndex <= online.lineIndex + 2
    );
    items.push(
      item("do", "action", "Renew online through the website named in the letter", [ev(online), ...extra.map(ev)],
        "Follow the letter's own steps — Fineprint links you to the exact sentences, not to an outside site.")
    );
  }
  const mailOrFax =
    renewIdx >= 0
      ? methodLines.find(
          (l) =>
            /form|renew/i.test(l.text) &&
            (MAIL_METHOD.test(l.text) || (FAX_METHOD.test(l.text) && /form|return|send/i.test(l.text)))
        )
      : undefined;
  if (mailOrFax) {
    const extra = methodLines.filter(
      (l) => l.page === mailOrFax.page && l.lineIndex > mailOrFax.lineIndex && l.lineIndex <= mailOrFax.lineIndex + 2
    );
    items.push(
      item("do", "action", "Or return the paper form by mail or fax", [ev(mailOrFax), ...extra.map(ev)],
        "The letter says the form must be signed — see the quoted lines.")
    );
  }

  // ---- dates & timing mentioned — a quote-first evidence index ----
  // Product contract: Fineprint NEVER decides which date is your deadline.
  // Every clause that contains a date or timing instruction is quoted
  // verbatim, in the order it appears, with a jump to the source line. The
  // reader decides which — if any — apply to them.
  //
  // Excerpts are sentence-aware: a date line is expanded to the whole
  // sentence it sits in (soft line wraps are joined, and a preceding
  // conditional/negative lead-in like "You do not need to return" stays
  // attached), because clipping a wrapped line can invert its meaning.
  const timingIdx = new Set<number>();
  const dateLines = new Set(
    dateMentions.map((d) => `${d.evidence.page}:${d.evidence.lineIndex}`)
  );
  lines.forEach((l, i) => {
    if (ANNOTATION.test(l.text)) return; // our notes are not letter evidence
    if (TIMING_HEADER.test(l.text)) return; // section header alone is not timing
    if (TIMING_WORDS.test(l.text) || dateLines.has(`${l.page}:${l.lineIndex}`)) {
      timingIdx.add(i);
    }
  });
  // the few lines under a "Due dates:"-style header are timing context even
  // when they carry no date word — include the whole block
  if (dueIdx >= 0) {
    for (let k = dueIdx + 1; k < Math.min(lines.length, dueIdx + 5); k++) {
      const l = lines[k]!;
      if (looksLikeSectionHeader(l.text) || ANNOTATION.test(l.text)) break;
      timingIdx.add(k);
    }
  }

  /** Expand line idx to the full sentence/paragraph span it belongs to. */
  function sentenceSpan(idx: number): [number, number] {
    let s = idx;
    while (s > 0) {
      const prev = lines[s - 1]!;
      const cur = lines[s]!;
      if (ANNOTATION.test(prev.text) || ANNOTATION.test(cur.text)) break;
      // cur is only a sentence-start on a strong signal — ALL-CAPS wrapped
      // lines (OCR output) must still join their lead-in
      if (isBullet(cur.text) || FIELD_LABEL.test(cur.text) || looksLikeSectionHeader(cur.text))
        break;
      const pt = prev.text.trim();
      if (
        TERMINAL.test(pt) ||
        pt.endsWith(":") ||
        TIMING_HEADER.test(pt) ||
        FIELD_LABEL.test(pt) ||
        (pt.split(/\s+/).length <= 5 && SHORT_CAPS_HEADER.test(pt))
      )
        break;
      s--;
    }
    let e = idx;
    while (e < lines.length - 1) {
      const last = lines[e]!;
      const next = lines[e + 1]!;
      const lt = last.text.trim();
      if (
        TERMINAL.test(lt) ||
        lt.endsWith(":") ||
        FIELD_LABEL.test(lt) ||
        RECORD_LINE.test(lt)
      )
        break;
      if (ANNOTATION.test(next.text) || startsNewRecord(next.text)) break;
      e++;
    }
    return [s, e];
  }

  // merge overlapping or directly-adjacent spans into context-block groups
  const excerptGroups: SourceLine[][] = [];
  {
    let cur: [number, number] | null = null;
    for (const i of [...timingIdx].sort((a, b) => a - b)) {
      const [s, e] = sentenceSpan(i);
      if (cur && s <= cur[1] + 1) {
        cur[1] = Math.max(cur[1], e);
      } else {
        if (cur) excerptGroups.push(lines.slice(cur[0], cur[1] + 1));
        cur = [s, e];
      }
    }
    if (cur) excerptGroups.push(lines.slice(cur[0], cur[1] + 1));
  }

  if (excerptGroups.length === 0) {
    items.push(
      item("dates", "unknown", "No timing excerpt found by this tool — check the full letter",
        [],
        "This tool only surfaces dates and timing words it can see; it may miss unusual wording. Do not assume there is no deadline — check the full letter.")
    );
  } else {
    items.push(
      item("dates", "info", "Dates and timing mentioned — quoted, not interpreted",
        excerptGroups.flatMap((g) => g.slice(0, 1).map(ev)).slice(0, 6),
        "Every excerpt below is copied word-for-word from the letter, in the order it appears. Excerpts show the lines around each timing mention — read them inside the full letter. Check which, if any, apply to you.")
    );
    for (const g of excerptGroups) {
      const text = g.map((l) => l.text.trim()).join(" ");
      const title = text.length > 110 ? `${text.slice(0, 107)}…` : text;
      items.push(item("dates", "excerpt", title, g.map(ev),
        "Verbatim excerpt — meaning depends on the letter's full context."));
    }
    const timingDateCount = dateMentions.filter((d) =>
      timingIdx.has(
        lines.findIndex((l) => l.page === d.evidence.page && l.lineIndex === d.evidence.lineIndex)
      )
    ).length;
    if (excerptGroups.length > 1 || timingDateCount > 1) {
      items.push(
        item("dates", "warning", "More than one timing instruction appears in this letter",
          excerptGroups.flatMap((g) => g.slice(0, 1).map(ev)),
          "Check for conflicting instructions — the letter mentions several dates or timing phrases. Fineprint does not pick one; check the full letter and the agency contact listed in it.")
      );
    }
  }

  // ---- required / conditional documents ----
  const needIdx = lines.findIndex((l) => NEED_ITEMS.test(l.text));
  if (needIdx >= 0) {
    items.push(item("do", "action", "Gather the papers the letter lists below", [ev(lines[needIdx]!)]));
    const bullets = collectBullets(lines, needIdx + 1);
    for (const b of bullets) {
      if (RIGHTS.test(b.text)) break;
      const cond = gateCondition(b.text);
      const title = docItemTitle(b.text);
      const evis = b.lines.slice(0, 3).map(ev);
      const hasCondWords = /\b(?:if|unless|only|even if)\b/i.test(b.text);
      const verbatim = `The letter's full wording: "${b.text}"`;
      const readNote = hasCondWords
        ? " Read the condition in the letter — Fineprint quotes it rather than deciding it for you."
        : "";
      if (cond) {
        items.push(
          item("documents", "conditional", title, evis,
            `${verbatim} The letter ties this document to a condition — it may not apply to you.${readNote}`)
        );
      } else {
        items.push(item("documents", "info", title, evis, `${verbatim}${readNote}`));
      }
    }
  }

  // ---- consequences (merged into one warning item) ----
  const consequenceLines = lines.filter((l) => CONSEQUENCE.test(l.text));
  if (consequenceLines.length > 0) {
    const evs: Evidence[] = [];
    for (const l of consequenceLines.slice(0, 3)) {
      evs.push(ev(l));
      const nxt = lines.find((x) => x.page === l.page && x.lineIndex === l.lineIndex + 1);
      if (nxt && evs.length < 5) evs.push(ev(nxt));
    }
    items.push(
      item("rights", "warning", "What happens if you miss it", evs,
        "Quoted word-for-word — including conditions and exceptions.")
    );
  }

  // ---- rights ----
  const rightsIdx = lines.findIndex((l) => RIGHTS.test(l.text));
  if (rightsIdx >= 0) {
    const bullets = collectBullets(lines, rightsIdx + 1);
    const evs = bullets.slice(0, 4).flatMap((b) => b.lines.slice(0, 2).map(ev));
    items.push(
      item("rights", "info",
        `Your rights — ${bullets.length} point${bullets.length === 1 ? "" : "s"} listed in the letter`,
        evs.length ? evs : [ev(lines[rightsIdx]!)],
        "Summaries come straight from the letter's own 'Your Rights' section; open a quote to read it in full.")
    );
  }

  // ---- contacts ----
  const contactSeen = new Set<string>();
  for (const l of lines.slice(0, Math.min(lines.length, 25))) {
    const label = /^fax\s*:/i.test(l.text) ? "Fax" : /^mail\s*:/i.test(l.text) ? "Write to" : "Call";
    const phones = l.text.match(new RegExp(PHONE.source, "g")) ?? [];
    for (const ph of phones) {
      const clean = ph.trim();
      if (clean.length < 3 || contactSeen.has(clean)) continue;
      contactSeen.add(clean);
      items.push(item("contacts", "info", `${label} ${clean}`, [ev(l)]));
    }
  }
  const mailLine = lines.find(
    (l) => l.lineIndex < 25 && (/\bmail\s*:/i.test(l.text) || /p\s*o\s*box/i.test(l.text))
  );
  if (mailLine) {
    const extra = lines.filter(
      (x) => x.page === mailLine.page && x.lineIndex > mailLine.lineIndex && x.lineIndex <= mailLine.lineIndex + 1
    );
    items.push(item("contacts", "info", "Mailing address in the letter", [ev(mailLine), ...extra.map(ev)]));
  }

  // ---- honest unknowns ----
  if (programs.some((p) => p.state === "undetermined")) {
    const undet = programs.filter((p) => p.state === "undetermined");
    items.push(
      item("not-said", "unknown", "Which benefits are being renewed is not readable",
        undet.map((p) => p.evidence!).filter(Boolean),
        `The letter names ${undet.map((p) => p.name).join(", ")} but its check-marks could not be read. Do not assume any program is covered — confirm with the agency.`)
    );
  }
  if (markIdx < 0) {
    items.push(
      item("not-said", "unknown", "No program check-list found in the text we could read",
        [],
        "If your letter has checked boxes, open the original PDF rather than pasted text so the check-marks can be read.")
    );
  }
  for (const w of warnings) {
    items.push(item("not-said", "warning", "Unreadable content", [], w));
  }

  return { supported: true, formTitle, noticeDate, programs, dates: dateMentions, items, warnings };
}
