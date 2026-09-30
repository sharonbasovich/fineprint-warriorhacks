# Fineprint QA report

Held-out corpus: 15 cases · generated 2026-09-30T03:48:03Z

| Case | Coverage | Abstention violations | Program misses | Citation errors |
|---|---|---|---|---|
| conditional-if-phrasing | 3/3 | 0 | 0 | 0 |
| deadline-outside-due-section | 2/2 | 0 | 0 | 0 |
| iso-date-format | 1/1 | 0 | 0 | 0 |
| malformed-input | 2/2 | 0 | 0 | 0 |
| method-scoped-deadlines | 2/2 | 0 | 0 | 0 |
| multi-date-types | 4/4 | 0 | 0 | 0 |
| official-blank-deadline | 9/9 | 0 | 0 | 0 |
| pasted-text-no-checkmarks | 5/5 | 0 | 0 | 0 |
| printed-date-not-deadline | 2/2 | 0 | 0 | 0 |
| response-within-days | 2/2 | 0 | 0 | 0 |
| scanned-pdf | 2/2 | 0 | 0 | 0 |
| synthetic-conflict | 4/4 | 0 | 0 | 0 |
| synthetic-dated | 8/8 | 0 | 0 | 0 |
| synthetic-no-deadline | 4/4 | 0 | 0 | 0 |
| yearless-due-date | 1/1 | 0 | 0 | 0 |

**Aggregate** — coverage (recall on expected findings): 51/51 = 100.0% · abstention violations: 0 · abstention precision: 100.0% · citation errors: 0

Citation integrity: every evidence quote is checked verbatim against the source lines. A quote that does not appear word-for-word in the document counts as an error — paraphrased citations are failures, not features.

Scope note: this corpus is authored by the same project session that built the parser. These numbers are regression coverage — evidence the parser behaves as designed on these inputs — not independent third-party verification.

All cases passed.
