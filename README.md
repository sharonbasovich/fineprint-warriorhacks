# Fineprint

**A confusing letter arrived. One missed date could matter. Fineprint shows you exactly what it asks — and admits what it doesn't say.**

Fineprint turns a benefits-renewal notice into a plain-language action checklist where **every answer is linked to the exact sentence and page it came from**. Built for **WarriorHacks 2.0 (Hackathon track)**.

## Why

Benefit renewal letters bury the important parts — a due date, a checked box, a conditional document — in dense bureaucratic text. Miss it, and coverage can lapse for procedural reasons alone. Fineprint doesn't decide anything for you. It makes the letter's asks visible and *honest*: if the notice doesn't print a deadline, Fineprint says "not stated" instead of inventing one.

## What it does

- Reads a renewal notice **entirely in your browser** — text or PDF, nothing is uploaded, no AI service is called.
- Extracts: renewal methods, **the response deadline** (or a visible "not stated" / "conflicting dates" card), which benefit programs are actually **check-marked**, required vs. *conditional* documents, contact info, and consequence wording.
- Every checklist item carries a **clickable evidence quote** that jumps to the exact line in the source pane.
- Distinguishes date types: notice date ≠ response deadline ≠ benefit end date ≠ appointment ≠ "within N days" processing windows.
- Scanned/image-only PDFs get an explicit "can't read this" warning — no OCR guessing, no silent failure.

## Demo

- **Video walkthrough (2:06, narrated):** [docs/video/fineprint-walkthrough.mp4](docs/video/fineprint-walkthrough.mp4) — hero → the real Texas H1830-R sample (its due-date field is blank: Fineprint says *not stated*, quotes verbatim) → evidence click-through → conditional documents → synthetic conflicting-dates flag.
- **Live demo:** https://sharonbasovich.github.io/fineprint-warriorhacks/ — deployed by GitHub Pages from `main`.

| | |
|---|---|
| ![hero](docs/screenshots/hero.png) | ![official checklist](docs/screenshots/official-checklist.png) |
| ![blank due date refused](docs/screenshots/deadline-not-stated.png) | ![synthetic conflict flagged](docs/screenshots/synthetic-conflict.png) |

## Run it

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + production build to dist/
npm test           # unit tests
npm run eval       # held-out QA corpus → qa/report/QA-REPORT.md
npm run lint
```

## Project layout

```
src/core/pdf.ts       PDF → text + vector checkbox-mark detection (pdf.js operator list)
src/core/textdoc.ts   pasted/bundled text → same document model
src/core/dates.ts     date extraction + per-date classification (local ±45 char context)
src/core/analyze.ts   deterministic parser → checklist items with verbatim evidence
src/ui/render.ts      side-by-side source document + checklist UI
public/samples/       bundled samples (see SOURCE-MANIFEST.md)
qa/corpus/            held-out QA cases (expected findings + abstention assertions)
qa/run-eval.ts        eval harness: coverage, abstention violations, citation integrity
tests/                vitest unit tests
tools/                official-sample extraction script
```

## The honest part (limitations)

- **It's deterministic, not magic.** Rules are tuned to renewal-notice structure; a wildly different layout may produce "not stated" where a human would see more.
- **It reads, it does not decide.** No eligibility, medical, or legal determinations. No forms are submitted, no accounts touched, no government affiliation claimed.
- **Checkbox detection** reads vector marks in PDFs (and `[x]`/`[ ]`/`☒`/`☐` in text). If a PDF marks boxes in an unusual way, states degrade to "not readable" — flagged, never guessed.
- **No OCR.** Image-only scans are rejected loudly.
- Historical context: the bundled real sample is an official 2018 public form — shown for document comprehension, not current policy guidance. Dates inside it (e.g. Jan 23, 2019) are the letter's *issue* dates, never deadlines.

## AI attribution

Built by Sharon Basovich with AI assistance (Devin, by Cognition) for code generation, test authoring, and QA design. Parsing is deterministic TypeScript — **no LLM is used or simulated at runtime**; the "plain language" is templated phrasing always paired with the verbatim quote it came from.

## License

MIT (see LICENSE). Third-party libraries and the sample document are listed in [SOURCE-MANIFEST.md](SOURCE-MANIFEST.md).
