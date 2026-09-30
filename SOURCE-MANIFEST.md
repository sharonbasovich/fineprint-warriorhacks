# Source manifest

## Bundled sample documents

| File | What it is | Source | Notes |
|---|---|---|---|
| `public/samples/h1830r-official-sample.txt` | Extracted text of Texas HHSC **Form H1830-R, "Texas Works Renewal Notice" (Dec 2018)** | Official page: https://fhb.hhs.texas.gov/forms/1000-1999/form-h1830-r-texas-works-renewal-notice — PDF: https://fhb.hhs.texas.gov/sites/default/files/documents/laws-regulations/forms/H1830-R/H1830-R.pdf | Public government form marked "SAMPLE". Retrieved 2026-09-30 (PDF: 492,131 bytes, 2 pages, issued 01/23/2019). Text extracted locally by `tools/extract-official-sample.ts` (pdf.js); `[x]`/`[ ]` markers transcribed deterministically from the form's own vector check-marks (only "Health Care" is marked). Due-date field is blank in the original. Texas state publications are public documents; we link the source rather than redistribute the PDF binary. The 01/23/2019 date is the **issue date**, not a deadline. |
| `public/samples/synthetic-*.txt` | Original invented notices written for this project | — | Clearly labeled "SYNTHETIC DEMO DOCUMENT — NOT a real government notice". Fictional agencies, numbers, and dates. |

## Third-party code

| Package | Version | License | Use |
|---|---|---|---|
| pdfjs-dist | 5.4.624 | Apache-2.0 | Local in-browser PDF text + vector-mark extraction |
| vite, vitest, typescript, eslint, typescript-eslint, tsx, @types/node, globals | see package.json | MIT | Build/test tooling |

## Generated during the event window

All application code, tests, QA corpus, synthetic samples, README, and this manifest were created 2026-09-30 in-session for WarriorHacks 2.0. No code or assets were reused from other projects.

## Not included

- No real beneficiary letters, no PII, no credentials.
- No redistribution of the source PDF binary; the sample text is an extracted derivative of a public government form with its origin linked above. The app also supports loading the original PDF locally for anyone who downloads it themselves.
