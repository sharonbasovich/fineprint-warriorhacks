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
}

const NUMERIC = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
const LONG =
  /\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
const RELATIVE = /\bwithin\s+(\d{1,3})\s+days?\b/gi;
const DAY_MONTH_YEAR =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)\.?\s*,?\s*(\d{4})\b/gi;

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
  for (const m of text.matchAll(RELATIVE)) {
    out.push({ raw: m[0], iso: null, index: m.index ?? 0, relative: true });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

const NOTICE_DATE_LABEL = /\bdate\s*:/i;
const DEADLINE_WORDS =
  /\b(due|deadline|return|respond|reply|send (your|it|the)|as soon as|no later than|by)\b/i;
const END_WORDS = /\b(benefits?\s+(might|may|will|could)\s+end|end\s+on|end\s+date|termination|expire)/i;
const APPT_WORDS = /\b(interview|appointment|meeting|scheduled)\b/i;
const REVIEW_WORDS = /\b(review date|within\s+\d+\s+days)/i;

/** classify one match using ONLY the local ±45-char window around it */
export function classifyDate(m: RawDateMatch, lineText: string, line: SourceLine): DateMention {
  const ev: Evidence = { page: line.page, lineIndex: line.lineIndex, quote: line.text };
  const ctx = lineText.slice(Math.max(0, m.index - 45), m.index + m.raw.length + 45);
  let kind: DateKind = "other";
  if (m.relative || REVIEW_WORDS.test(ctx)) {
    kind = "review-window";
  } else if (APPT_WORDS.test(ctx)) {
    kind = "appointment";
  } else if (END_WORDS.test(ctx)) {
    kind = "benefit-end";
  } else if (NOTICE_DATE_LABEL.test(lineText.slice(Math.max(0, m.index - 45), m.index))) {
    kind = "notice-date";
  } else if (DEADLINE_WORDS.test(ctx) && m.iso !== null) {
    kind = "response-deadline";
  }
  return { raw: m.raw, iso: m.iso, kind, evidence: ev };
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
