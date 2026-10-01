/**
 * Held-out QA harness.
 *
 * Each corpus case asserts:
 *  - expected items exist with the right category/status/title/detail/evidence
 *  - forbidden items do NOT exist (abstention tests)
 *  - expected program checkbox states
 *  - citation integrity: every evidence quote emitted must verbatim equal a
 *    real source line — nothing the checklist cites may be paraphrased or invented
 *
 * Reports per-case + aggregate coverage/precision/abstention metrics and
 * writes qa/report/QA-REPORT.md. Exits non-zero on any failure.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { extractText } from "../src/core/textdoc";
import { extractPdf } from "../src/core/pdf";
import { analyze } from "../src/core/analyze";
import { SAMPLES } from "../src/core/samples";
import type { ChecklistItem, NoticeDocument } from "../src/core/types";

interface ItemExpectation {
  category?: string;
  status?: string;
  titleContains?: string;
  detailContains?: string;
  evidenceContains?: string;
}
interface ProgramExpectation {
  name: string;
  state: string;
}
interface CorpusCase {
  id: string;
  description: string;
  input:
    | { kind: "sample"; id: string }
    | { kind: "text"; text: string }
    | { kind: "pdf"; path: string };
  expect: {
    supported?: boolean;
    programs?: ProgramExpectation[];
    items?: ItemExpectation[];
    forbidden?: ItemExpectation[];
    docWarningsContains?: string;
  };
}

/** Phrases that would constitute an authoritative deadline/dating claim —
 *  none may ever appear in output on any input. */
const AUTHORITATIVE_PHRASES =
  /respond\s+(by|within)|deadline\s*:|not\s+stated\s+in\s+this\s+notice|conflicting\s+due\s+dates|past\s+date\s+mentioned|benefits\s+may\s+end|letter\s+printed|processing\s+window|only\s+response\s+date|must\s+return\s+by/i;

function matches(it: ChecklistItem, e: ItemExpectation): boolean {
  if (e.category && it.category !== e.category) return false;
  if (e.status && it.status !== e.status) return false;
  if (e.titleContains && !it.title.toLowerCase().includes(e.titleContains.toLowerCase())) return false;
  if (e.detailContains && !(it.detail ?? "").toLowerCase().includes(e.detailContains.toLowerCase()))
    return false;
  if (
    e.evidenceContains &&
    !it.evidence.some((ev) => ev.quote.toLowerCase().includes(e.evidenceContains!.toLowerCase()))
  )
    return false;
  return true;
}

async function loadInput(c: CorpusCase): Promise<NoticeDocument> {
  const input = c.input;
  if (input.kind === "sample") {
    const def = SAMPLES.find((s) => s.id === input.id);
    if (!def) throw new Error(`unknown sample ${input.id}`);
    const doc = extractText(readFileSync(`public/${def.file}`, "utf8"), def.label);
    if (def.tag === "synthetic") doc.warnings.push("Synthetic demonstration document — not a real notice.");
    return doc;
  }
  if (input.kind === "text") {
    return extractText(input.text, "case input");
  }
  const data = new Uint8Array(readFileSync(input.path));
  return extractPdf(data, input.path);
}

interface CaseResult {
  id: string;
  expected: number;
  found: number;
  forbiddenViolations: number;
  programMisses: number;
  citationErrors: number;
  errors: string[];
  warningsOk: boolean;
}

async function runCase(c: CorpusCase): Promise<CaseResult> {
  const res: CaseResult = {
    id: c.id,
    expected: 0,
    found: 0,
    forbiddenViolations: 0,
    programMisses: 0,
    citationErrors: 0,
    errors: [],
    warningsOk: true
  };
  let doc: NoticeDocument;
  try {
    doc = await loadInput(c);
  } catch (e) {
    res.errors.push(`input load failed: ${(e as Error).message}`);
    return res;
  }
  const r = analyze(doc);

  // Structural contract: no item may ever assert a deadline, date type, or
  // currency status — the dates section only carries verbatim excerpts.
  res.expected++;
  const leaked = r.items.filter((i) =>
    AUTHORITATIVE_PHRASES.test(`${i.title}\n${i.detail ?? ""}`)
  );
  if (leaked.length === 0) {
    res.found++;
  } else {
    res.errors.push(
      `ASSERTION LEAK: ${leaked.map((i) => `"${i.title}"`).join(", ")}`
    );
    res.forbiddenViolations++;
  }

  if (c.expect.supported !== undefined) {
    res.expected++;
    if (r.supported === c.expect.supported) {
      res.found++;
    } else {
      res.errors.push(`SUPPORTED: expected ${c.expect.supported}, got ${r.supported}`);
    }
  }

  // expected items
  for (const exp of c.expect.items ?? []) {
    res.expected++;
    if (r.items.some((it) => matches(it, exp))) {
      res.found++;
    } else {
      res.errors.push(`MISSING expected item ${JSON.stringify(exp)}`);
    }
  }

  // forbidden items = abstention violations
  for (const f of c.expect.forbidden ?? []) {
    const violators = r.items.filter((it) => matches(it, f));
    if (violators.length > 0) {
      res.forbiddenViolations += violators.length;
      for (const v of violators) {
        res.errors.push(`FORBIDDEN item emitted: [${v.category}/${v.status}] ${v.title}`);
      }
    }
  }

  // program states
  for (const p of c.expect.programs ?? []) {
    res.expected++;
    const actual = r.programs.find((x) => x.name === p.name);
    if (actual && actual.state === p.state) {
      res.found++;
    } else {
      res.programMisses++;
      res.errors.push(`PROGRAM ${p.name}: expected ${p.state}, got ${actual?.state ?? "missing"}`);
    }
  }

  // doc warnings
  if (c.expect.docWarningsContains) {
    res.expected++;
    if (doc.warnings.some((w) => w.toLowerCase().includes(c.expect.docWarningsContains!.toLowerCase()))) {
      res.found++;
    } else {
      res.warningsOk = false;
      res.errors.push(`expected doc warning containing "${c.expect.docWarningsContains}"`);
    }
  }

  // citation integrity: each evidence quote must verbatim match a source line
  const srcLines = new Set(doc.pages.flatMap((p) => p.lines.map((l) => l.text)));
  const cited = new Set<string>();
  for (const it of r.items) {
    for (const ev of it.evidence) {
      if (!srcLines.has(ev.quote)) {
        res.citationErrors++;
        if (!cited.has(ev.quote)) {
          cited.add(ev.quote);
          res.errors.push(`EVIDENCE quote not found verbatim in source: "${ev.quote.slice(0, 80)}"`);
        }
      }
    }
  }
  return res;
}

async function main() {
  const CASE_DIRS = ["qa/corpus", "qa/adversarial"];
  const files = CASE_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => `${dir}/${f}`)
  );
  const results: CaseResult[] = [];
  for (const f of files) {
    const c = JSON.parse(readFileSync(f, "utf8")) as CorpusCase;
    results.push(await runCase(c));
  }

  const totExpected = results.reduce((n, r) => n + r.expected, 0);
  const totFound = results.reduce((n, r) => n + r.found, 0);
  const totViol = results.reduce((n, r) => n + r.forbiddenViolations, 0);
  const totCitErr = results.reduce((n, r) => n + r.citationErrors, 0);
  const coverage = totExpected ? ((totFound / totExpected) * 100).toFixed(1) : "n/a";
  const abstentionPrecision = totViol === 0 ? "100.0" : ((totExpected - totViol) / Math.max(1, totExpected) * 100).toFixed(1);

  const lines: string[] = [];
  lines.push(`# Fineprint QA report`);
  lines.push(``);
  lines.push(`Regression corpus: ${files.length} cases · generated ${new Date().toISOString().slice(0, 19)}Z`);
  lines.push(``);
  lines.push(`| Case | Coverage | Abstention violations | Program misses | Citation errors |`);
  lines.push(`|---|---|---|---|---|`);
  for (const r of results) {
    const cov = r.expected ? `${r.found}/${r.expected}` : "—";
    lines.push(`| ${r.id} | ${cov} | ${r.forbiddenViolations} | ${r.programMisses} | ${r.citationErrors} |`);
  }
  lines.push(``);
  lines.push(`**Aggregate** — coverage (recall on expected findings): ${totFound}/${totExpected} = ${coverage}% · abstention violations: ${totViol} · abstention precision: ${abstentionPrecision}% · citation errors: ${totCitErr}`);
  lines.push(``);
  lines.push(`Citation integrity: every evidence quote is checked verbatim against the source lines. A quote that does not appear word-for-word in the document counts as an error — paraphrased citations are failures, not features.`);
  lines.push(``);
  lines.push(`Scope note: this corpus is authored by the project team, and cases were visible during parser development and tuning. These numbers are regression coverage — evidence the parser behaves as designed on these inputs — not independent, held-out, or third-party verification of accuracy.`);
  lines.push(``);
  const anyErr = results.some((r) => r.errors.length > 0);
  if (anyErr) {
    lines.push(`## Errors`);
    for (const r of results) {
      for (const e of r.errors) lines.push(`- **${r.id}**: ${e}`);
    }
  } else {
    lines.push(`All cases passed.`);
  }

  mkdirSync("qa/report", { recursive: true });
  writeFileSync("qa/report/QA-REPORT.md", lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  if (anyErr || totViol > 0 || totCitErr > 0) process.exit(1);
}

main();
