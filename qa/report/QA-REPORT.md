# Fineprint QA report

Regression corpus: 53 cases · generated 2026-10-01T09:01:00Z

| Case | Coverage | Abstention violations | Program misses | Citation errors |
|---|---|---|---|---|
| agency-within-window | 2/2 | 0 | 0 | 0 |
| conditional-if-phrasing | 3/3 | 0 | 0 | 0 |
| conditional-no-income-statement | 2/2 | 0 | 0 | 0 |
| deadline-outside-due-section | 2/2 | 0 | 0 | 0 |
| doc-even-if-variant | 1/1 | 0 | 0 | 0 |
| doc-even-if | 1/1 | 0 | 0 | 0 |
| doc-if-cant-get | 1/1 | 0 | 0 | 0 |
| doc-if-no-fallback | 1/1 | 0 | 0 | 0 |
| doc-later-sentence-condition | 2/2 | 0 | 0 | 0 |
| hist-clause-scoped | 1/1 | 0 | 0 | 0 |
| hist-form-due-processed | 2/2 | 0 | 0 | 0 |
| hist-last-year | 2/2 | 0 | 0 | 0 |
| hist-reviewed-by | 2/2 | 0 | 0 | 0 |
| hist-signed-on | 2/2 | 0 | 0 | 0 |
| hist-was-processed | 2/2 | 0 | 0 | 0 |
| hist-we-received | 2/2 | 0 | 0 | 0 |
| iso-date-format | 1/1 | 0 | 0 | 0 |
| mailed-on-not-deadline | 1/1 | 0 | 0 | 0 |
| malformed-input | 2/2 | 0 | 0 | 0 |
| method-scoped-deadlines | 2/2 | 0 | 0 | 0 |
| mixed-historical-and-deadline | 2/2 | 0 | 0 | 0 |
| multi-date-types | 4/4 | 0 | 0 | 0 |
| must-be-returned-by | 1/1 | 0 | 0 | 0 |
| official-blank-deadline | 9/9 | 0 | 0 | 0 |
| pasted-text-no-checkmarks | 5/5 | 0 | 0 | 0 |
| printed-date-not-deadline | 2/2 | 0 | 0 | 0 |
| printed-on-no-conflict | 2/2 | 0 | 0 | 0 |
| printed-on-own-line | 2/2 | 0 | 0 | 0 |
| rel-days-to-respond | 1/1 | 0 | 0 | 0 |
| rel-must-receive-within | 1/1 | 0 | 0 | 0 |
| rel-postmarked-within | 1/1 | 0 | 0 | 0 |
| rel-you-have-days | 1/1 | 0 | 0 | 0 |
| relative-due-days-from-letter | 1/1 | 0 | 0 | 0 |
| relative-hear-from-within | 1/1 | 0 | 0 | 0 |
| response-within-days | 2/2 | 0 | 0 | 0 |
| scanned-pdf | 2/2 | 0 | 0 | 0 |
| synthetic-conflict | 4/4 | 0 | 0 | 0 |
| synthetic-dated | 8/8 | 0 | 0 | 0 |
| synthetic-no-deadline | 4/4 | 0 | 0 | 0 |
| unsupported-csv | 2/2 | 0 | 0 | 0 |
| yearless-due-date | 1/1 | 0 | 0 | 0 |
| adv-agency-review-within | 2/2 | 0 | 0 | 0 |
| adv-appointment-and-deadline | 2/2 | 0 | 0 | 0 |
| adv-benefit-end-and-deadline | 2/2 | 0 | 0 | 0 |
| adv-dash-date | 1/1 | 0 | 0 | 0 |
| adv-even-if-and-real-if | 2/2 | 0 | 0 | 0 |
| adv-intro-no-later-than | 1/1 | 0 | 0 | 0 |
| adv-mixed-one-line | 1/1 | 0 | 0 | 0 |
| adv-no-dates-at-all | 1/1 | 0 | 0 | 0 |
| adv-true-conflict | 1/1 | 0 | 0 | 0 |
| adv-unless-doc | 1/1 | 0 | 0 | 0 |
| adv-will-have-days | 1/1 | 0 | 0 | 0 |
| adv-yearless-past | 1/1 | 0 | 0 | 0 |

**Aggregate** — coverage (recall on expected findings): 106/106 = 100.0% · abstention violations: 0 · abstention precision: 100.0% · citation errors: 0

Citation integrity: every evidence quote is checked verbatim against the source lines. A quote that does not appear word-for-word in the document counts as an error — paraphrased citations are failures, not features.

Scope note: this corpus is authored by the project team, and cases were visible during parser development and tuning. These numbers are regression coverage — evidence the parser behaves as designed on these inputs — not independent, held-out, or third-party verification of accuracy.

All cases passed.
