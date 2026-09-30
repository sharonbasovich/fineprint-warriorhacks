import type { NoticeDocument, NoticePage, SourceLine } from "./types";

export const PAGE_BREAK = /^-{2,}\s*page break\s*-{2,}$/im;

/** Build a NoticeDocument from plain text (pasted or bundled sample).
 *  Lines matching `--- page break ---` split the text into pages. */
export function extractText(raw: string, sourceName: string): NoticeDocument {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const pageChunks = normalized.split(new RegExp(PAGE_BREAK.source, "m"));
  const pages: NoticePage[] = [];
  pageChunks.forEach((chunk, i) => {
    const lines: SourceLine[] = [];
    for (const rawLine of chunk.split("\n")) {
      const text = rawLine.replace(/\s+/g, " ").trim();
      if (text.length === 0) continue;
      lines.push({ page: i + 1, lineIndex: lines.length, text });
    }
    if (lines.length > 0 || pageChunks.length === 1) {
      pages.push({ pageNumber: i + 1, lines });
    }
  });
  const warnings: string[] = [];
  const total = pages.reduce((n, p) => n + p.lines.length, 0);
  if (total < 3) {
    warnings.push("Very little text was found — this does not look like a notice Fineprint can read.");
  }
  return { sourceName, pages, warnings };
}
