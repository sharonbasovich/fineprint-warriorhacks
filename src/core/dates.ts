import type { DateKind, DateMention, Evidence, SourceLine } from "./types";

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12
};

export interface RawDateMatch {
  raw: string;
  iso: string | null;
  index: number;
  relative: boolean;
  /** matched a month+day with no year — ambiguous, never resolved silently */
  yearless?: boolean;
}

const MONTHS_RE =
  "January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec";
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
const ISO_DATE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
const LONG = new RegExp(
  `\\b(${MONTHS_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
  "gi"
);
// month+day with NO year following — kept as an ambiguous match, not dropped.
// (?<!\d) / (?!\d) guards stop "December 2018" matching as "December 20".
const LONG_NO_YEAR = new RegExp(
  `\\b(${MONTHS_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?![\\s,]*\\d{4}\\b)`,
  "gi"
);
const RELATIVE = /\bwithin\s+(\d{1,3})\s+days?\b/gi;
// spelled-out day counts without "within": "you have 10 days … to return",
// "10 days to respond" — reader deadlines all the same
const REL_HAVE = /\byou\s+(?:will\s+|still\s+)?have\s+(\d{1,3})\s+days?\b/gi;
const REL_DAYS_TO =
  /\b(\d{1,3})\s+days?\s+to\s+(?:return|send|submit|respond|reply|complete|provide|file|sign|renew|turn\s+in|mail|get|give|bring|take)\b/gi;
const DAY_MONTH_YEAR = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS_RE})\\.?\\s*,?\\s*(\\d{4})\\b`,
  "gi"
);
// day+month with NO year following
const DAY_MONTH_NO_YEAR = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)\\s+(${MONTHS_RE})\\.?(?![\\s,]*\\d{4}\\b)`,
  "gi"
);

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const yy = y < 100 ? (y < 50 ? 2000 + y : 1900 + y) : y;
  return `${yy}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function findDatesInText(text: string): RawDateMatch[] {
  const out: RawDateMatch[] = [];
  for (const m of text.matchAll(NUMERIC)) {
    out.push({
      raw: m[0],
      iso: toIso(Number(m[3]), Number(m[1]), Number(m[2])),
      index: m.index ?? 0,
      relative: false
    });
  }
  for (const m of text.matchAll(ISO_DATE)) {
    out.push({
      raw: m[0],
      iso: toIso(Number(m[1]), Number(m[2]), Number(m[3])),
      index: m.index ?? 0,
      relative: false
    });
  }
  for (const m of text.matchAll(LONG)) {
    const month = MONTHS[m[1]!.toLowerCase()];
    out.push({
      raw: m[0],
      iso: month ? toIso(Number(m[3]), month, Number(m[2])) : null,
      index: m.index ?? 0,
      relative: false
    });
  }
  for (const m of text.matchAll(DAY_MONTH_YEAR)) {
    const month = MONTHS[m[2]!.toLowerCase()];
    out.push({
      raw: m[0],
      iso: month ? toIso(Number(m[3]), month, Number(m[1])) : null,
      index: m.index ?? 0,
      relative: false
    });
  }
  for (const m of text.matchAll(DASH_NUMERIC)) {
    out.push({
      raw: m[0],
      iso: toIso(Number(m[3]), Number(m[1]), Number(m[2])),
      index: m.index ?? 0,
      relative: false
    });
  }
  // yearless month+day forms — surfaced as ambiguous, never silently resolved
  const covered = (i: number) =>
    out.some((d) => i >= d.index && i < d.index + d.raw.length);
  for (const m of text.matchAll(LONG_NO_YEAR)) {
    if (covered(m.index ?? 0)) continue;
    out.push({
      raw: m[0],
      iso: null,
      index: m.index ?? 0,
      relative: false,
      yearless: true
    });
  }
  for (const m of text.matchAll(DAY_MONTH_NO_YEAR)) {
    if (covered(m.index ?? 0)) continue;
    out.push({
      raw: m[0],
      iso: null,
      index: m.index ?? 0,
      relative: false,
      yearless: true
    });
  }
  for (const m of text.matchAll(RELATIVE)) {
    out.push({ raw: m[0], iso: null, index: m.index ?? 0, relative: true });
  }
  // "you have N days" / "N days to <act>" — normalized to "within N days" so
  // downstream titles read consistently; evidence quotes stay verbatim
  for (const m of text.matchAll(REL_HAVE)) {
    if (covered(m.index ?? 0)) continue;
    out.push({
      raw: `within ${m[1]} days`,
      iso: null,
      index: m.index ?? 0,
      relative: true
    });
  }
  for (const m of text.matchAll(REL_DAYS_TO)) {
    if (covered(m.index ?? 0)) continue;
    out.push({
      raw: `within ${m[1]} days`,
      iso: null,
      index: m.index ?? 0,
      relative: true
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// "10-15-2026" — dashes with the year last (ISO "2026-10-15" is handled above
// and can't collide: its first group is 4 digits, so \b keeps this out)
const DASH_NUMERIC = /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g;
const NOTICE_DATE_LABEL =
  /\b(?:date|dated|printed|issued|mailed|postmarked|sent)\b\s*:?\s*(?:(?:on|of)\s+)?$/i;
const DEADLINE_WORDS =
  /\b(due|deadline|return|respond|reply|send (your|it|the)|as soon as|no later than|submit)\b/i;
// a bare "by" means nothing ("reviewed by your caseworker on …") — a deadline
// needs an action verb tied to the date: "return your form by X",
// "must be received by X", "postmarked by X"
const BY_ACTION =
  /\b(?:due|return(?:ed)?|respond(?:ed)?|repl(?:y|ied)|send|sent|submit(?:ted)?|renew(?:ed)?|complete(?:d)?|filed?|sign(?:ed)?|postmark(?:ed)?|receiv(?:e|ed)|reach(?:ed)?|get|got|deliver(?:ed)?|turn(?:ed)?\s+in|mail(?:ed)?|back)\b[^.]{0,40}\bby\s*$/i;
// a date tied to something already done is history, not a deadline:
// "was reviewed on 09/01/2026", "you returned it by 03/01/2025", "last year"
const PAST_EVENT =
  /\b(?:was|were|has|have|had)\s+(?:been\s+)?\w+(?:ed|en)\b|\b(?:you|we|i)\s+(?:returned|sent|submitted|filed|signed|mailed|completed|provided|received|got|brought|gave)\b|\blast\s+(?:year|month|week|time)\b|\bpreviously\b|\balready\s+(?:returned|sent|submitted|filed|signed|mailed|completed|provided|received|brought)\b/i;
const END_WORDS = /\b(benefits?\s+(might|may|will|could)\s+end|end\s+on|end\s+date|termination|expire)/i;
const APPT_WORDS = /\b(interview|appointment|meeting|scheduled)\b/i;
const REVIEW_WORDS = /\breview\s+date\b/i;
// verbs meaning the READER must act — a "within N days" after these is a real deadline
const REL_ACTION =
  /\b(return|send|submit|respond|reply|turn in|mail|complete|provide|bring|file|sign|fill out|give us|renew)\b/i;
// the AGENCY as subject — a "within N days" after these is a processing window,
// not the reader's deadline ("we will tell you", "the office will review")
const REL_AGENCY =
  /\b(we|the office|the agency|your caseworker|hhsc|they)\b[^.]{0,40}\b(will|shall|must|may|can|should)\b|\bwe'?ll\b|\b(?:tell|notify|let) you\b/i;
// agency grammar that still puts the burden on the READER:
// "the office must receive your signed form within 10 days",
// "your form must be postmarked within 10 days"
const REL_OBLIGATION =
  /\b(?:office|agency|we|us|caseworker|hhsc)\b[^.]{0,30}\b(?:must|needs?\s+to|has\s+to|have\s+to|should|shall)\s+(?:receive|get)\b|\b(?:must|needs?\s+to|has\s+to|have\s+to|should|shall)\s+(?:be\s+)?(?:returned|received|submitted|sent|postmarked|completed|filed|signed|back)\b/i;

/** classify one match using ONLY the local context around it */
export function classifyDate(m: RawDateMatch, lineText: string, line: SourceLine): DateMention {
  const ev: Evidence = { page: line.page, lineIndex: line.lineIndex, quote: line.text };
  const end = m.index + m.raw.length;
  const ctx = lineText.slice(Math.max(0, m.index - 45), end + 45);
  const bIdx = (i: number) =>
    Math.max(
      lineText.lastIndexOf(".", i - 1),
      lineText.lastIndexOf(";", i - 1),
      lineText.lastIndexOf("!", i - 1),
      lineText.lastIndexOf("?", i - 1),
      lineText.lastIndexOf("\n", i - 1)
    );
  // the current clause only — "…was reviewed on 09/01. Return your form by
  // 10/15" must not let the past-tense clause swallow the real deadline
  const preClause = lineText.slice(bIdx(m.index) + 1, m.index);
  // post-context ends at the next sentence boundary OR where the next date's
  // clause begins: "by 10/15 or your benefits will end on 12/31" keeps
  // "benefits will end" out of 10/15's scope and in 12/31's
  let clauseEnd = lineText.length;
  const nextB = lineText.slice(end).search(/[.;!?\n]/);
  if (nextB >= 0) clauseEnd = end + nextB;
  for (const x of findDatesInText(lineText)) {
    if (x.index > m.index) {
      clauseEnd = Math.min(clauseEnd, Math.max(bIdx(x.index) + 1, end));
    }
  }
  const postClause = lineText.slice(end, clauseEnd);
  // keyword tests see the tail of this clause plus what follows the date in
  // the same clause — an earlier clause's "interview" or "within N days"
  // can't relabel this date
  const wordScope = `${preClause.slice(-35)}${m.raw}${postClause.slice(0, 60)}`;
  let kind: DateKind = "other";
  if (m.relative) {
    // "return/send/… within N days" is your deadline; "we will … within N
    // days" is theirs — unless the agency wording obligates the reader
    // ("the office must receive your form within 10 days"). Action verbs can
    // follow the count ("you have 10 days to return"), so scan both sides.
    kind =
      REL_OBLIGATION.test(preClause) ||
      (REL_ACTION.test(ctx) && !REL_AGENCY.test(preClause))
        ? "response-deadline"
        : "review-window";
  } else if (REVIEW_WORDS.test(wordScope)) {
    kind = "review-window";
  } else if (APPT_WORDS.test(wordScope)) {
    kind = "appointment";
  } else if (END_WORDS.test(wordScope)) {
    kind = "benefit-end";
  } else if (PAST_EVENT.test(preClause)) {
    kind = "other";
  } else if (NOTICE_DATE_LABEL.test(preClause)) {
    kind = "notice-date";
  } else if (
    (m.iso !== null || m.yearless) &&
    (BY_ACTION.test(preClause) || DEADLINE_WORDS.test(wordScope))
  ) {
    kind = "response-deadline";
  }
  return {
    raw: m.raw,
    iso: m.iso,
    kind,
    evidence: ev,
    ...(m.relative ? { relative: true } : {}),
    ...(m.yearless ? { yearless: true } : {})
  };
}

export function allDateMentions(lines: SourceLine[]): DateMention[] {
  const out: DateMention[] = [];
  for (const line of lines) {
    for (const m of findDatesInText(line.text)) {
      out.push(classifyDate(m, line.text, line));
    }
  }
  return out;
}
