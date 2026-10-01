import { describe, expect, it } from "vitest";
import { extractText } from "../src/core/textdoc";
import { analyze, isAnnotationText } from "../src/core/analyze";
import { findDatesInText } from "../src/core/dates";
import { readFileSync, readdirSync } from "node:fs";

function loadSample(file: string) {
  return extractText(readFileSync(`public/samples/${file}`, "utf8"), file);
}

const FRAME =
  "CEDAR COUNTY BENEFITS\nIt is time to renew your benefits.\nThe benefits you need to renew have a check-mark next to them:\n[x] SNAP\nDue dates:\n";

/** phrases that must never appear in output — Fineprint is an evidence
 *  reader; it quotes the letter and never asserts a deadline */
const FORBIDDEN_ASSERTIONS =
  /respond\s+(by|within)|deadline\s*:|not\s+stated\s+in\s+this\s+notice|conflicting\s+due\s+dates|past\s+date\s+mentioned|benefits\s+may\s+end|letter\s+printed|processing\s+window|only\s+response\s+date/i;

function expectNoDeadlineAssertions(r: ReturnType<typeof analyze>) {
  for (const it of r.items) {
    expect(it.title).not.toMatch(FORBIDDEN_ASSERTIONS);
    expect(it.detail ?? "").not.toMatch(FORBIDDEN_ASSERTIONS);
  }
}

function excerpts(r: ReturnType<typeof analyze>) {
  return r.items.filter((i) => i.category === "dates" && i.status === "excerpt");
}

function excerptText(r: ReturnType<typeof analyze>) {
  return excerpts(r)
    .flatMap((i) => i.evidence.map((e) => e.quote))
    .join("\n");
}

describe("date extraction (internal mention parsing)", () => {
  it("parses numeric and long-form dates to ISO", () => {
    const m = findDatesInText("due by 04/03/2027 and also June 5, 2027");
    expect(m.map((x) => x.iso)).toEqual(["2027-04-03", "2027-06-05"]);
  });

  it("rejects impossible dates", () => {
    expect(findDatesInText("13/45/2027")[0]!.iso).toBeNull();
  });

  it("captures 'within N days' as relative, never a concrete date", () => {
    const m = findDatesInText("we will tell you within 30 days");
    expect(m[0]!.relative).toBe(true);
    expect(m[0]!.iso).toBeNull();
  });

  it("yearless 'October 15' is captured as ambiguous, not a concrete date", () => {
    const m = findDatesInText("Return the form by October 15.");
    expect(m[0]!.iso).toBeNull();
    expect(m[0]!.yearless).toBe(true);
  });

  it("ISO 2027-10-15 parses like any printed date", () => {
    expect(findDatesInText("due by 2027-10-15")[0]!.iso).toBe("2027-10-15");
  });

  it("dash-format '10-15-2026' parses like the slash form", () => {
    expect(findDatesInText("due by 10-15-2026")[0]!.iso).toBe("2026-10-15");
  });
});

describe("quote-first timing index (product contract)", () => {
  it("official blank sample: timing clauses are quoted, no deadline is asserted", () => {
    const r = analyze(loadSample("h1830r-official-sample.txt"));
    const text = excerptText(r);
    expect(text).toContain("as soon as you can");
    expect(excerpts(r).length).toBeGreaterThan(0);
    expectNoDeadlineAssertions(r);
  });

  it("every timing excerpt is verbatim and carries a source jump", () => {
    const r = analyze(loadSample("h1830r-official-sample.txt"));
    const src = new Set(r.dates.flatMap((d) => [d.evidence.quote]));
    const lines = new Set(
      loadSample("h1830r-official-sample.txt").pages.flatMap((p) => p.lines.map((l) => l.text))
    );
    for (const i of excerpts(r)) {
      expect(i.evidence.length).toBeGreaterThan(0);
      for (const e of i.evidence) expect(lines.has(e.quote)).toBe(true);
    }
    expect(src.size).toBeGreaterThan(0);
  });

  it("a negated instruction is quoted whole — 'do not need to return' stays in the excerpt", () => {
    const doc = extractText(FRAME + "You do not need to return anything by 10/20/2026.", "t");
    const r = analyze(doc);
    expect(excerptText(r)).toContain("You do not need to return anything by 10/20/2026");
    expectNoDeadlineAssertions(r);
  });

  it("an agency-side window is quoted whole — 'we will mail you a decision within 14 days'", () => {
    const doc = extractText(
      FRAME + "We will mail you a decision within 14 days after we get your form.",
      "t"
    );
    const r = analyze(doc);
    expect(excerptText(r)).toContain("within 14 days");
    expectNoDeadlineAssertions(r);
  });

  it("a mixed send/return sentence keeps both dates in one verbatim excerpt", () => {
    const doc = extractText(
      FRAME + "We sent this on 09/20/2026, and you must return it by 10/20/2026.",
      "t"
    );
    const r = analyze(doc);
    const text = excerptText(r);
    expect(text).toContain("09/20/2026");
    expect(text).toContain("10/20/2026");
    expectNoDeadlineAssertions(r);
  });

  it("two different date instructions stay visible with a conflict-check reminder", () => {
    const doc = extractText(
      FRAME + "Return your form by 10/15/2026. The form is due 10/30/2026.",
      "t"
    );
    const r = analyze(doc);
    const text = excerptText(r);
    expect(text).toContain("10/15/2026");
    expect(text).toContain("10/30/2026");
    expect(
      r.items.some((i) => i.category === "dates" && i.status === "warning" && /conflicting/i.test(i.detail ?? ""))
    ).toBe(true);
    expectNoDeadlineAssertions(r);
  });

  it("a notice with no timing words gets an honest 'no timing excerpt' item", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nThe benefits you need to renew have a check-mark next to them:\n[x] SNAP\nItems we need from you: send copies.\n\u2022 Proof of income.",
      "t"
    );
    const r = analyze(doc);
    expect(
      r.items.some((i) => i.category === "dates" && i.title.includes("No timing excerpt"))
    ).toBe(true);
    expectNoDeadlineAssertions(r);
  });
});

describe("scope gate", () => {
  it("a utility bill is not treated as a supported renewal notice", () => {
    const doc = extractText(
      "ACME ELECTRICITY\nAccount 554433\nAmount due: $120.43\nDue date: 10/01/2026\nPay online at acme.example.com",
      "t"
    );
    const r = analyze(doc);
    expect(r.supported).toBe(false);
    expect(r.items.some((i) => /not look like/i.test(i.title))).toBe(true);
    expectNoDeadlineAssertions(r);
  });

  it("non-notice pasted data (CSV) is unsupported", () => {
    const r = analyze(extractText("name,amount,month\nrent,900.00,January", "t"));
    expect(r.supported).toBe(false);
  });

  it("renewal-notice vocabulary is supported", () => {
    const r = analyze(extractText(FRAME + "Return your form by 11/01/2026.", "t"));
    expect(r.supported).toBe(true);
  });
});

describe("abstention", () => {
  it("program names without checkbox marks are undetermined, not inferred", () => {
    const doc = extractText(
      "The benefits you need to renew have a check-mark next to them:\nSNAP TANF Health Care",
      "t"
    );
    const r = analyze(doc);
    expect(r.programs.every((p) => p.state === "undetermined")).toBe(true);
    expect(r.items.some((i) => i.category === "not-said")).toBe(true);
  });
});

describe("checkbox reading", () => {
  it("[x]/[ ] markers map to the right program on one line", () => {
    const doc = extractText(
      "The benefits you need to renew have a check-mark next to them:\n[x] SNAP [ ] TANF [x] Health Care",
      "t"
    );
    const r = analyze(doc);
    const st = Object.fromEntries(r.programs.map((p) => [p.name, p.state]));
    expect(st).toEqual({ SNAP: "checked", TANF: "unchecked", "Health Care": "checked" });
  });
});

describe("conditional documents", () => {
  it("preserves 'only if' conditions verbatim-ish", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nItems we need from you: send copies.\n\u2022 Housing costs (only if you are applying for SNAP): recent rent receipts.",
      "t"
    );
    const r = analyze(doc);
    const housing = r.items.find((i) => i.category === "documents" && i.title.includes("Housing"));
    expect(housing?.status).toBe("conditional");
    expect(housing?.detail).toContain("only if you are applying for SNAP");
  });
});

describe("document condition edge cases", () => {
  it("'even if your income did not change' does not make a document conditional", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nItems we need from you: send copies.\n\u2022 Proof of income: send pay stubs even if your income did not change.",
      "t"
    );
    const r = analyze(doc);
    const docItem = r.items.find((i) => i.category === "documents" && i.title.includes("Proof of income"));
    expect(docItem?.status).toBe("info");
  });

  it("'if you do not have one, bring any photo ID' is a fallback, not a condition", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nItems we need from you: bring copies.\n\u2022 Driver's license. If you do not have one, bring any photo ID.",
      "t"
    );
    const r = analyze(doc);
    const docItem = r.items.find((i) => i.category === "documents" && i.title.includes("Driver"));
    expect(docItem?.status).toBe("info");
  });

  it("'unless you are self-employed' is a real condition", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nItems we need from you: send copies.\n\u2022 Proof of income unless you are self-employed: last 4 pay stubs.",
      "t"
    );
    const r = analyze(doc);
    const docItem = r.items.find((i) => i.category === "documents" && i.title.includes("Proof of income"));
    expect(docItem?.status).toBe("conditional");
  });

  it("'If no one has income, sign the No Income Statement' keeps the document name and the condition", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nItems we need from you:\n\u2022 If no one in your home has income, sign the No Income Statement.\n\u2022 Proof of income: last 4 pay stubs.",
      "t"
    );
    const r = analyze(doc);
    const d = r.items.find((i) => i.category === "documents" && i.title.includes("No Income Statement"));
    expect(d?.status).toBe("conditional");
  });

  it("'Proof of address. If you moved, send a new lease.' keeps the doc and quotes the condition", () => {
    const doc = extractText(
      "It is time to renew your benefits.\nItems we need from you:\n\u2022 Proof of address. If you moved, send a new lease.\n\u2022 Photo ID.",
      "t"
    );
    const r = analyze(doc);
    const d = r.items.find((i) => i.category === "documents" && i.title.includes("Proof of address"));
    expect(d?.status).toBe("info");
    expect(d?.detail).toContain("If you moved, send a new lease");
  });
});

describe("structural contract — no authoritative deadline output on any input", () => {
  const dirs = ["qa/corpus", "qa/adversarial"];
  const files = dirs.flatMap((d) =>
    readdirSync(d)
      .filter((f) => f.endsWith(".json"))
      .map((f) => `${d}/${f}`)
  );
  for (const file of files) {
    const c = JSON.parse(readFileSync(file, "utf8")) as {
      id: string;
      input: { kind: string; text?: string; id?: string };
    };
    if (c.input.kind !== "text") continue;
    it(`${c.id} produces only quoted excerpts, never deadline assertions`, () => {
      const r = analyze(extractText(c.input.text ?? "", c.id));
      expectNoDeadlineAssertions(r);
    });
  }
});

describe("citation integrity", () => {
  it("every evidence quote is verbatim from the source", () => {
    const doc = loadSample("h1830r-official-sample.txt");
    const r = analyze(doc);
    const src = new Set(doc.pages.flatMap((p) => p.lines.map((l) => l.text)));
    for (const it of r.items) {
      for (const e of it.evidence) {
        expect(src.has(e.quote)).toBe(true);
      }
    }
  });

  it("provenance notes are never cited as letter evidence on any path", () => {
    const doc = loadSample("h1830r-official-sample.txt");
    const r = analyze(doc);
    for (const it of r.items) {
      for (const e of it.evidence) {
        expect(isAnnotationText(e.quote), `annotation cited: ${e.quote}`).toBe(false);
      }
    }
    for (const d of r.dates) {
      expect(isAnnotationText(d.raw), `annotation date: ${d.raw}`).toBe(false);
    }
    // the renew summary must cite the real intro line, not the SOURCE: note
    const renew = r.items.find((i) => i.title.includes("asks you to renew"));
    expect(
      renew?.evidence.some((e) => e.quote.includes("time to renew your benefits"))
    ).toBe(true);
  });
});
