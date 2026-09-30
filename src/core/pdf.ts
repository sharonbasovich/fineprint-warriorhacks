/**
 * Local PDF -> NoticeDocument extraction using pdf.js.
 * Runs fully client-side in the app and in Node for tooling/eval.
 * Never uploads anything; the caller supplies raw bytes.
 */
// legacy build: same engine, but also runs in Node (no DOMMatrix requirement)
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { NoticeDocument, NoticePage, SourceLine } from "./types";

export interface PdfExtractOptions {
  standardFontDataUrl?: string;
  cMapUrl?: string;
}

const OP_NAMES: Record<number, string> = {};
for (const [name, code] of Object.entries(OPS)) {
  OP_NAMES[code as number] = name;
}

type Matrix = [number, number, number, number, number, number];

function matMul(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}

function applyMat(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

interface MarkedBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  marked: boolean;
}

/** inner DrawOPS codes used inside pdf.js constructPath args */
const PATH_MOVE = 0;
const PATH_LINE = 1;
const PATH_CURVE = 2; // bezierCurveTo — 6 coords
const PATH_QCURVE = 3; // quadraticCurveTo — 4 coords
const PATH_CLOSE = 4;

interface Segment {
  pts: number[]; // flattened device-space coords
  closed: boolean;
}

function toFlatArray(el: unknown): number[] {
  // pdf.js path segments arrive either as a flat number array or as a
  // flattened dictionary object {0: op, 1: x, 2: y, 3: op, ...}
  if (Array.isArray(el)) return el as number[];
  if (el && typeof el === "object") {
    const rec = el as Record<string, number>;
    const out: number[] = [];
    for (let k = 0; rec[String(k)] !== undefined; k++) out.push(rec[String(k)]!);
    return out;
  }
  return [];
}

function decodePath(pathArg: unknown, ctm: Matrix): Segment[] {
  const segs: Segment[] = [];
  if (!Array.isArray(pathArg)) return segs;
  const asArray: number[] = [];
  for (const el of pathArg as unknown[]) {
    asArray.push(...toFlatArray(el));
  }
  let cur: Segment | null = null;
  for (let i = 0; i < asArray.length; ) {
    const op = asArray[i] as number;
    if (op === PATH_MOVE || op === PATH_LINE) {
      const x = asArray[i + 1] as number;
      const y = asArray[i + 2] as number;
      const [dx, dy] = applyMat(ctm, x, y);
      if (!cur || op === PATH_MOVE) {
        cur = { pts: [], closed: false };
        segs.push(cur);
      }
      cur.pts.push(dx, dy);
      i += 3;
    } else if (op === PATH_CURVE) {
      if (cur) {
        for (const idx of [1, 3, 5]) {
          const [dx, dy] = applyMat(ctm, asArray[i + idx] as number, asArray[i + idx + 1] as number);
          cur.pts.push(dx, dy);
        }
      }
      i += 7;
    } else if (op === PATH_QCURVE) {
      if (cur) {
        for (const idx of [1, 3]) {
          const [dx, dy] = applyMat(ctm, asArray[i + idx] as number, asArray[i + idx + 1] as number);
          cur.pts.push(dx, dy);
        }
      }
      i += 5;
    } else if (op === PATH_CLOSE) {
      if (cur) cur.closed = true;
      i += 1;
    } else {
      i += 1;
    }
  }
  return segs;
}

function bbox(pts: number[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]!);
    maxX = Math.max(maxX, pts[i]!);
    minY = Math.min(minY, pts[i + 1]!);
    maxY = Math.max(maxY, pts[i + 1]!);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Detect checkbox squares and whether each contains a mark (X or check strokes).
 * Works on the pdf.js operator list: small closed ~square paths are boxes;
 * open diagonal strokes fully inside a box make it "checked".
 */
export async function detectCheckboxes(page: {
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}): Promise<MarkedBox[]> {
  const ol = await page.getOperatorList();
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const boxes: MarkedBox[] = [];
  const markStrokes: { minX: number; minY: number; maxX: number; maxY: number }[] = [];

  for (let i = 0; i < ol.fnArray.length; i++) {
    const op = ol.fnArray[i]!;
    const name = OP_NAMES[op];
    const args = ol.argsArray[i] as unknown[] | null;
    if (name === "save") {
      stack.push([...ctm]);
    } else if (name === "restore") {
      ctm = stack.pop() ?? ctm;
    } else if (name === "transform" && args) {
      ctm = matMul(ctm, args as unknown as Matrix);
    } else if (name === "constructPath" && args) {
      const segs = decodePath(args[1], ctm);
      for (const seg of segs) {
        const b = bbox(seg.pts);
        const w = b.maxX - b.minX;
        const h = b.maxY - b.minY;
        if (seg.closed && w >= 5 && w <= 30 && h >= 5 && h <= 30 && Math.abs(w - h) <= Math.max(w, h) * 0.35) {
          // same box is often painted twice (fill + stroke) — dedupe by bbox
          if (!boxes.some((x) => Math.abs(x.minX - b.minX) < 0.5 && Math.abs(x.minY - b.minY) < 0.5)) {
            boxes.push({ ...b, marked: false });
          }
        } else if (!seg.closed && seg.pts.length >= 4) {
          const x0 = seg.pts[0]!;
          const y0 = seg.pts[1]!;
          const x1 = seg.pts[seg.pts.length - 2]!;
          const y1 = seg.pts[seg.pts.length - 1]!;
          const adx = Math.abs(x1 - x0);
          const ady = Math.abs(y1 - y0);
          // diagonal-ish stroke of checkbox-mark size (not a horizontal/vertical rule)
          if (adx > 2 && ady > 2 && adx < 40 && ady < 40) {
            markStrokes.push(b);
          }
        }
      }
    }
  }
  for (const box of boxes) {
    box.marked = markStrokes.some(
      (m) =>
        m.minX >= box.minX - 1 &&
        m.maxX <= box.maxX + 1 &&
        m.minY >= box.minY - 1 &&
        m.maxY <= box.maxY + 1
    );
  }
  return boxes;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width?: number;
}

export async function extractPdf(
  data: Uint8Array,
  sourceName: string,
  opts: PdfExtractOptions = {}
): Promise<NoticeDocument> {
  const doc = await getDocument({
    data,
    isEvalSupported: false,
    ...(opts.standardFontDataUrl ? { standardFontDataUrl: opts.standardFontDataUrl } : {}),
    ...(opts.cMapUrl ? { cMapUrl: opts.cMapUrl, cMapPacked: true } : {})
  }).promise;

  const pages: NoticePage[] = [];
  const warnings: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const boxes = await detectCheckboxes(page);

    const items = tc.items.filter(
      (it) => "str" in it && (it as { str: string }).str.trim().length > 0
    ) as unknown as TextItemLike[];

    // group items into visual lines by y (rounded), sorted top-to-bottom
    const rows = new Map<number, TextItemLike[]>();
    for (const it of items) {
      const y = Math.round(it.transform[5]!);
      let key = y;
      for (const k of rows.keys()) {
        if (Math.abs(k - y) <= 3) {
          key = k;
          break;
        }
      }
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(it);
    }
    const sortedRows = [...rows.entries()].sort((a, b) => b[0] - a[0]);

    const lines: SourceLine[] = [];
    for (const [rowY, rowItems] of sortedRows) {
      rowItems.sort((a, b) => a.transform[4]! - b.transform[4]!);
      const parts: string[] = [];
      let prevEnd: number | null = null;
      for (const it of rowItems) {
        const x = it.transform[4]!;
        if (prevEnd !== null && x - prevEnd > 4) parts.push(" ");
        parts.push(it.str);
        prevEnd = x + (it.width ?? it.str.length * 5);
      }
      let text = parts.join("").replace(/\s+/g, " ").trim();

      // insert checkbox markers for boxes on this row
      const rowBoxes = boxes
        .filter((b) => b.minY >= rowY - 4 && b.maxY <= rowY + 12)
        .sort((a, b) => a.minX - b.minX);
      for (const b of rowBoxes) {
        const label = rowItems.find(
          (it) => it.transform[4]! >= b.minX - 2 && it.transform[4]! <= b.maxX + 40
        );
        if (label && text.includes(label.str)) {
          const marker = b.marked ? "[x] " : "[ ] ";
          text = text.replace(label.str, marker + label.str);
        }
      }
      if (text.length > 0) {
        const x0 = rowItems[0]!.transform[4];
        lines.push({
          page: p,
          lineIndex: lines.length,
          text,
          y: rowY,
          ...(x0 !== undefined ? { x: x0 } : {})
        });
      }
    }

    const totalChars = items.reduce((n, it) => n + it.str.trim().length, 0);
    if (totalChars < 20) {
      warnings.push(
        `Page ${p} has little or no extractable text — it is probably a scanned image. Fineprint does not run OCR, so it cannot read this page.`
      );
    }
    pages.push({ pageNumber: p, lines });
  }
  return { sourceName, pages, warnings };
}
