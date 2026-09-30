/** Shared data model for Fineprint. */

export interface SourceLine {
  page: number;
  /** index of the line within its page */
  lineIndex: number;
  text: string;
  /** approximate x/y position in PDF user space when known */
  x?: number;
  y?: number;
}

export interface NoticePage {
  pageNumber: number;
  lines: SourceLine[];
}

export interface NoticeDocument {
  sourceName: string;
  pages: NoticePage[];
  /** warnings surfaced to the user (e.g. scanned document) */
  warnings: string[];
}

export interface Evidence {
  page: number;
  lineIndex: number;
  /** exact quote taken from the source text */
  quote: string;
}

export type DateKind =
  | "notice-date"
  | "response-deadline"
  | "benefit-end"
  | "appointment"
  | "review-window"
  | "other";

export interface DateMention {
  raw: string;
  /** ISO yyyy-mm-dd when the raw text parses to one unambiguous calendar date */
  iso: string | null;
  kind: DateKind;
  evidence: Evidence;
}

export type ProgramState = "checked" | "unchecked" | "undetermined";

export interface ProgramEntry {
  name: string;
  state: ProgramState;
  evidence: Evidence | null;
}

export type ItemStatus =
  | "action"
  | "deadline"
  | "deadline-unknown"
  | "deadline-conflict"
  | "conditional"
  | "info"
  | "warning"
  | "unknown";

export type ItemCategory =
  | "do"
  | "dates"
  | "documents"
  | "rights"
  | "contacts"
  | "not-said";

export interface ChecklistItem {
  id: string;
  category: ItemCategory;
  status: ItemStatus;
  title: string;
  detail?: string;
  evidence: Evidence[];
}

export interface AnalysisResult {
  formTitle: string | null;
  noticeDate: DateMention | null;
  programs: ProgramEntry[];
  dates: DateMention[];
  items: ChecklistItem[];
  warnings: string[];
}
