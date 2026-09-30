import { describe, expect, it } from "vitest";
import { extractText } from "../src/core/textdoc";
import { analyze } from "../src/core/analyze";
import { findDatesInText, allDateMentions } from "../src/core/dates";
import { readFileSync } from "node:fs";

function loadSample(file: string) {
  return extractText(readFileSync(`public/samples/${file}`, "utf8"), file);
}

describe("date extraction", () => {
  it("parses numeric and long-form dates to ISO", () => {
    const m = findDatesInText("due by 04/03/2027 and also June 5, 2027");
    expect(m.map((x) => x.iso)).toEqual(["2027-04-03", "2027-06-05"]);
  });

  it("rejects impossible dates", () => {
    expect(findDatesInText("13/45/2027")[0]!.iso).toBeNull();
  });

  it("captures 'within N days' as relative, not a deadline", () => {
    const m = findDatesInText("we will tell you within 30 days");
    expect(m[0]!.relative).toBe(true);
    expect(m[0]!.iso).toBeNull();
  });
});

describe("date classification", () => {
  it("separates deadline vs benefit-end on the SAME line", () => {
    const doc = extractText(
      "Due dates:\nYour renewal is due by 04/03/2027. If we don't get it in time, your benefits might end on 04/30/2027.",
      "t"
    );
    const mentions = allDateMentions(doc.pages[0]!.lines);
    const kinds = Object.fromEntries(mentions.map((d) => [d.iso, d.kind]));
    expect(kinds["2027-04-03"]).toBe("response-deadline");
    expect(kinds["2027-04-30"]).toBe("benefit-end");
  });

  it("labels the header DATE: as notice-date, never deadline", () => {
    const doc = extractText("DATE: 01/23/2019\nIt is time to renew.", "t");
    expect(allDateMentions(doc.pages[0]!.lines)[0]!.kind).toBe("notice-date");
  });
});

describe("abstention", () => {
  it("official sample with blank due-date field yields deadline-unknown, not a fabricated date", () => {
    const r = analyze(loadSample("h1830r-official-sample.txt"));
    const deadline = r.items.find((i) => i.status === "deadline-unknown");
    expect(deadline).toBeDefined();
    expect(r.items.filter((i) => i.status === "deadline" && i.title.includes("01/23")).length).toBe(0);
  });

  it("conflicting due dates produce a conflict item, never a chosen one", () => {
    const r = analyze(loadSample("synthetic-conflicting-dates.txt"));
    expect(r.items.some((i) => i.status === "deadline-conflict")).toBe(true);
    expect(r.items.some((i) => i.status === "deadline" && i.title.startsWith("Respond by"))).toBe(false);
  });

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
      "Items we need from you: send copies.\n• Housing costs (only if you are applying for SNAP): recent rent receipts.",
      "t"
    );
    const r = analyze(doc);
    const housing = r.items.find((i) => i.category === "documents" && i.title.includes("Housing"));
    expect(housing?.status).toBe("conditional");
    expect(housing?.detail).toContain("only if you are applying for SNAP");
  });
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
});
