# Fineprint QA report

Regression corpus: 69 cases · generated 2026-10-01T10:38:43Z

| Case | Coverage | Abstention violations | Program misses | Citation errors |
|---|---|---|---|---|
| agency-within-window | 3/3 | 0 | 0 | 0 |
| conditional-if-phrasing | 4/4 | 0 | 0 | 0 |
| conditional-no-income-statement | 3/3 | 0 | 0 | 0 |
| deadline-outside-due-section | 3/3 | 0 | 0 | 0 |
| doc-even-if-variant | 2/2 | 0 | 0 | 0 |
| doc-even-if | 2/2 | 0 | 0 | 0 |
| doc-if-cant-get | 2/2 | 0 | 0 | 0 |
| doc-if-no-fallback | 2/2 | 0 | 0 | 0 |
| doc-later-sentence-condition | 3/3 | 0 | 0 | 0 |
| hist-clause-scoped | 3/3 | 0 | 0 | 0 |
| hist-form-due-processed | 2/2 | 0 | 0 | 0 |
| hist-last-year | 2/2 | 0 | 0 | 0 |
| hist-reviewed-by | 2/2 | 0 | 0 | 0 |
| hist-signed-on | 2/2 | 0 | 0 | 0 |
| hist-was-processed | 2/2 | 0 | 0 | 0 |
| hist-we-received | 2/2 | 0 | 0 | 0 |
| iso-date-format | 2/2 | 0 | 0 | 0 |
| mailed-on-not-deadline | 3/3 | 0 | 0 | 0 |
| malformed-input | 3/3 | 0 | 0 | 0 |
| method-scoped-deadlines | 3/3 | 0 | 0 | 0 |
| mixed-historical-and-deadline | 3/3 | 0 | 0 | 0 |
| multi-date-types | 5/5 | 0 | 0 | 0 |
| must-be-returned-by | 2/2 | 0 | 0 | 0 |
| official-blank-deadline | 10/10 | 0 | 0 | 0 |
| pasted-text-no-checkmarks | 6/6 | 0 | 0 | 0 |
| printed-date-not-deadline | 3/3 | 0 | 0 | 0 |
| printed-on-no-conflict | 3/3 | 0 | 0 | 0 |
| printed-on-own-line | 3/3 | 0 | 0 | 0 |
| rel-days-to-respond | 2/2 | 0 | 0 | 0 |
| rel-must-receive-within | 2/2 | 0 | 0 | 0 |
| rel-postmarked-within | 2/2 | 0 | 0 | 0 |
| rel-you-have-days | 2/2 | 0 | 0 | 0 |
| relative-due-days-from-letter | 2/2 | 0 | 0 | 0 |
| relative-hear-from-within | 2/2 | 0 | 0 | 0 |
| response-within-days | 3/3 | 0 | 0 | 0 |
| scanned-pdf | 3/3 | 0 | 0 | 0 |
| synthetic-conflict | 7/7 | 0 | 0 | 0 |
| synthetic-dated | 9/9 | 0 | 0 | 0 |
| synthetic-no-deadline | 5/5 | 0 | 0 | 0 |
| unsupported-csv | 3/3 | 0 | 0 | 0 |
| yearless-due-date | 2/2 | 0 | 0 | 0 |
| adv-agency-review-within | 3/3 | 0 | 0 | 0 |
| adv-appointment-and-deadline | 3/3 | 0 | 0 | 0 |
| adv-benefit-end-and-deadline | 3/3 | 0 | 0 | 0 |
| adv-dash-date | 2/2 | 0 | 0 | 0 |
| adv-even-if-and-real-if | 3/3 | 0 | 0 | 0 |
| adv-intro-no-later-than | 2/2 | 0 | 0 | 0 |
| adv-mixed-one-line | 3/3 | 0 | 0 | 0 |
| adv-no-dates-at-all | 2/2 | 0 | 0 | 0 |
| adv-true-conflict | 4/4 | 0 | 0 | 0 |
| adv-unless-doc | 2/2 | 0 | 0 | 0 |
| adv-will-have-days | 2/2 | 0 | 0 | 0 |
| adv-yearless-past | 3/3 | 0 | 0 | 0 |
| agency-window-quoted | 2/2 | 0 | 0 | 0 |
| doc-contact-line-not-doc | 3/3 | 0 | 0 | 0 |
| mixed-send-return-one-line | 3/3 | 0 | 0 | 0 |
| negated-do-not-return | 2/2 | 0 | 0 | 0 |
| no-invented-method-steps | 4/4 | 0 | 0 | 0 |
| provenance-not-evidence | 2/2 | 0 | 0 | 0 |
| two-instructions-stay-visible | 4/4 | 0 | 0 | 0 |
| unsupported-utility-bill | 3/3 | 0 | 0 | 0 |
| wrap-across-page-break | 2/2 | 0 | 0 | 0 |
| wrap-condition-leadin | 2/2 | 0 | 0 | 0 |
| wrap-list-item | 2/2 | 0 | 0 | 0 |
| wrap-multi-date-context | 2/2 | 0 | 0 | 0 |
| wrap-negation-colon | 2/2 | 0 | 0 | 0 |
| wrap-negation-two-line | 2/2 | 0 | 0 | 0 |
| wrap-punctuation-stop | 3/3 | 0 | 0 | 0 |
| wrap-uppercase-ocr | 2/2 | 0 | 0 | 0 |

**Aggregate** — coverage (recall on expected findings): 201/201 = 100.0% · abstention violations: 0 · abstention precision: 100.0% · citation errors: 0

Citation integrity: every evidence quote is checked verbatim against the source lines. A quote that does not appear word-for-word in the document counts as an error — paraphrased citations are failures, not features.

Scope note: this corpus is authored by the project team, and cases were visible during parser development and tuning. These numbers are regression coverage — evidence the parser behaves as designed on these inputs — not independent, held-out, or third-party verification of accuracy.

All cases passed.
