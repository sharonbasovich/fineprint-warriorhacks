/**
 * Deterministic, source-grounded analysis of a benefits-renewal notice.
 * Every emitted claim carries evidence (page + line + exact quote).
 * When the notice does not state something, we say so — we never infer it.
 */
import { allDateMentions } from "./dates";
import type {
  AnalysisResult,
  ChecklistItem,
  DateMention,
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
const METHOD_ONLINE = /\bonline|website|internet|log\s?in|\.gov\b|\.com\b/i;
const METHOD_PAPER = /\bpaper|by mail|in the mail|mailed\b|envelope|by fax|fax\b/i;

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
        looksLikeSectionHeader(line.text) &&
        !/^(and|or|the|a|an|that|which|to|for|if|you|it|in|of|must)\b/i.test(line.text)
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
 * Does a date's own clause scope it to a response method (online vs paper)?
 * Uses the clause containing the date (split on . , ; ! ?), not the whole line,
 * so "online due X, paper due Y" attributes each date to its own method.
 */
function methodLabel(d: { raw: string; evidence: Evidence }, lines: SourceLine[]): "online" | "paper" | null {
  const line = lines.find(
    (l) => l.page === d.evidence.page && l.lineIndex === d.evidence.lineIndex
  );
  if (!line) return null;
  const idx = line.text.indexOf(d.raw);
  if (idx < 0) return null;
  const before = line.text.slice(0, idx);
  const after = line.text.slice(idx + d.raw.length);
  const segStart =
    Math.max(
      ...[".", ",", ";", "?", "!"].map((c) => before.lastIndexOf(c))
    ) + 1;
  const afterIdxs = [".", ",", ";", "?", "!"]
    .map((c) => after.indexOf(c))
    .filter((i) => i >= 0);
  const segEnd = afterIdxs.length ? Math.min(...afterIdxs) : after.length;
  const clause = before.slice(segStart) + d.raw + after.slice(0, segEnd);
  const on = METHOD_ONLINE.test(clause);
  const pap = METHOD_PAPER.test(clause);
  if (on && !pap) return "online";
  if (pap && !on) return "paper";
  return null;
}

export function analyze(doc: NoticeDocument): AnalysisResult {
  nextId = 0;
  const lines = doc.pages.flatMap((p) => p.lines);
  const items: ChecklistItem[] = [];
  const warnings = [...doc.warnings];
  const allText = lines.map((l) => l.text).join(" ");

  // scope gate — Fineprint reads benefits renewal notices (H1830-R-style) or
  // notice-shaped letters (renewal / benefits / due-date / check-mark /
  // items-we-need structure). Anything else gets an honest unsupported view,
  // not a confident checklist.
  const supported =
    RENEW_INTRO.test(allText) ||
    NEED_ITEMS.test(allText) ||
    DUE_SECTION.test(allText) ||
    CHECK_MARK_SENTENCE.test(allText) ||
    /\b(renew|renewal|benefit|coverage|assistance|eligib|SNAP|TANF|Medicaid)\b/i.test(allText);
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
  const online = methodLines.find(
    (l) => ONLINE_METHOD.test(l.text) && /renew|log|manage|account/i.test(l.text)
  );
  if (online) {
    const extra = methodLines.filter(
      (l) => l.page === online.page && l.lineIndex > online.lineIndex && l.lineIndex <= online.lineIndex + 2
    );
    items.push(
      item("do", "action", "Renew online through the website named in the letter", [ev(online), ...extra.map(ev)],
        "Follow the letter's own steps — Fineprint links you to the exact sentences, not to an outside site.")
    );
  }
  const mailOrFax = methodLines.find(
    (l) => MAIL_METHOD.test(l.text) || (FAX_METHOD.test(l.text) && /form|return|send/i.test(l.text))
  );
  if (mailOrFax) {
    const extra = methodLines.filter(
      (l) => l.page === mailOrFax.page && l.lineIndex > mailOrFax.lineIndex && l.lineIndex <= mailOrFax.lineIndex + 2
    );
    items.push(
      item("do", "action", "Or return the paper form by mail or fax", [ev(mailOrFax), ...extra.map(ev)],
        "The letter says the form must be signed — see the quoted lines.")
    );
  }

  // ---- deadlines ----
  // Whole-letter scan: an action deadline can appear anywhere, not only inside
  // a "Due dates" block. Only dates the wording ties to your response qualify —
  // print/issue dates and untied dates never become deadlines.
  const dueContextLines = dueIdx >= 0 ? collectLines(lines, dueIdx, 5) : null;
  const inDue = (pg: number, li: number) =>
    dueContextLines?.some((l) => l.page === pg && l.lineIndex === li) ?? false;

  const hardDue = dateMentions.filter(
    (d) => d.kind === "response-deadline" && d.iso !== null && !d.yearless
  );
  const relDue = dateMentions.filter(
    (d) => d.kind === "response-deadline" && d.relative === true
  );
  // dates the letter shows but that can't be turned into a concrete deadline:
  // yearless ("October 15") or printed in the due section untied to an action
  const ambigDue = dateMentions.filter(
    (d) =>
      d.kind === "possible-deadline" ||
      (d.kind === "response-deadline" && d.yearless === true) ||
      (d.kind === "other" && !d.historical && inDue(d.evidence.page, d.evidence.lineIndex))
  );
  const consumed = new Set<DateMention>();

  const dueIsos = [...new Set(hardDue.map((d) => d.iso!))];
  if (dueIsos.length === 1) {
    const ds = hardDue.filter((d) => d.iso === dueIsos[0]);
    const d = ds[0]!;
    const method = methodLabel(d, lines);
    items.push(
      item("dates", "deadline",
        `Respond by ${d.raw}${method ? ` — ${method}` : ""}`,
        ds.map((x) => x.evidence),
        "The only calendar date the letter ties to your response.")
    );
    ds.forEach((x) => consumed.add(x));
  } else if (dueIsos.length > 1) {
    const labels = dueIsos.map((iso) =>
      methodLabel(hardDue.find((d) => d.iso === iso)!, lines)
    );
    const methodScoped =
      labels.every((l) => l !== null) && new Set(labels).size === labels.length;
    if (methodScoped) {
      // separate method-scoped dates (online vs paper) are not a conflict —
      // each applies to its own way of responding
      for (let i = 0; i < dueIsos.length; i++) {
        const d = hardDue.find((x) => x.iso === dueIsos[i])!;
        const lab = labels[i] === "online" ? "Online renewal" : "Paper form";
        items.push(
          item("dates", "deadline", `${lab} due ${d.raw}`, [d.evidence],
            "The letter prints a separate date for this way of responding — each date applies to its own method.")
        );
      }
    } else {
      items.push(
        item("dates", "deadline-conflict", "Conflicting due dates in this notice",
          hardDue.map((d) => d.evidence),
          `The letter ties more than one date to your response (${hardDue
            .map((d) => d.raw)
            .join(" vs ")}). Fineprint does not pick one — confirm the real deadline by phone.`)
      );
    }
    hardDue.forEach((x) => consumed.add(x));
  }

  // action-worded "within N days" deadlines — real deadlines with no calendar date
  const seenRel = new Set<string>();
  for (const d of relDue) {
    if (seenRel.has(d.raw)) continue;
    seenRel.add(d.raw);
    const all = relDue.filter((x) => x.raw === d.raw).map((x) => x.evidence);
    items.push(
      item("dates", "deadline", `Respond ${d.raw}`, all,
        `The letter sets a "${d.raw}" deadline but prints no calendar date and does not say what day the count starts from — confirm it by phone.`)
    );
  }
  relDue.forEach((x) => consumed.add(x));

  if (
    dueIsos.length === 0 &&
    relDue.length === 0 &&
    ambigDue.length > 0
  ) {
    const raws = ambigDue.map((d) => `"${d.raw}"`).join(", ");
    const why = ambigDue.some((d) => d.yearless)
      ? "at least one of them is missing a year"
      : "the wording around them is not an unambiguous present-tense deadline instruction";
    items.push(
      item("dates", "deadline-unclear", "Response deadline: unclear in this notice",
        ambigDue.map((d) => d.evidence),
        `The letter prints ${raws} where a response deadline might live, but ${why}. Each quoted sentence is shown verbatim — read it and confirm the real deadline by phone.`)
    );
    ambigDue.forEach((x) => consumed.add(x));
  }

  if (dueContextLines && dueIsos.length === 0 && relDue.length === 0 && ambigDue.length === 0) {
    items.push(
      item("dates", "deadline-unknown", "Response deadline: not stated in this notice",
        dueContextLines.map(ev).slice(0, 3),
        "The letter tells you to respond soon, but no due date is printed there. Missing a deadline can end benefits — confirm the date by phone before relying on it.")
    );
  }

  if (noticeDate) {
    items.push(
      item("dates", "info", `Letter printed on ${noticeDate.raw}`, [noticeDate.evidence],
        "This is the date the notice was issued — it is not a deadline.")
    );
  }

  // other dates — surfaced so none is silently treated as a deadline
  const seenWindow = new Set<string>();
  for (const d of dateMentions) {
    if (d === noticeDate) continue;
    if (consumed.has(d)) continue; // already covered by a deadline item above
    if (d.kind === "benefit-end" && d.iso) {
      items.push(item("dates", "deadline", `Benefits may end ${d.raw}`, [d.evidence]));
    } else if (d.kind === "appointment") {
      items.push(item("dates", "deadline", `Possible appointment / interview date: ${d.raw}`, [d.evidence]));
    } else if (d.kind === "review-window") {
      const key = `${d.raw}`;
      if (seenWindow.has(key)) continue;
      seenWindow.add(key);
      const all = dateMentions.filter((x) => x.kind === "review-window" && x.raw === d.raw).map((x) => x.evidence);
      items.push(item("dates", "info", `Processing window mentioned: "${d.raw}"`, all,
        "A 'within N days' rule is an agency processing window, not your deadline."));
    } else if (d.iso !== null && d.historical) {
      items.push(item("dates", "info", `Past date mentioned in the letter: ${d.raw}`, [d.evidence],
        "The letter ties this date to something already done — it is history, not a current deadline. Read the quoted sentence yourself."));
    } else if (d.iso !== null) {
      items.push(item("dates", "info", `Date seen in the letter: ${d.raw}`, [d.evidence],
        "Listed so you can see it — the letter does not clearly tie this date to an action you must take."));
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
  if (!dueContextLines && dueIsos.length === 0 && relDue.length === 0 && ambigDue.length === 0) {
    items.push(
      item("not-said", "unknown", "No due-date section was found",
        [],
        "The notice did not contain recognizable 'due date' wording. That does not mean there is no deadline — confirm by phone.")
    );
  }
  for (const w of warnings) {
    items.push(item("not-said", "warning", "Unreadable content", [], w));
  }

  return { supported: true, formTitle, noticeDate, programs, dates: dateMentions, items, warnings };
}
