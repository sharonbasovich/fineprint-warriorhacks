# Fineprint — WarriorHacks 2.0 submission packet (draft)

> Repository draft for the coordinator — not an external submission.
> Fields that need coordinator confirmation (entrant/team details, legal
> attestations, final event forms) are marked **[coordinator]**.

## Title & tagline

**Fineprint** — *A confusing letter arrived. One missed date could matter.
Fineprint shows you the letter's own words — organized, source-linked, never
decided for you.*

**Intended track:** WarriorHacks 2.0 — Hackathon track.

## The problem

Benefit renewal letters bury the parts that matter — a due date, a checked
box, a conditional document — inside dense bureaucratic text. Miss a
procedural requirement, and coverage can lapse for paperwork reasons alone.
The person holding the letter shouldn't need to interpret it under pressure;
they need to find what it actually says and check each claim against the
source.

## The solution

Fineprint is an **evidence reader**: it turns a renewal notice into an
organized index where every entry is linked to the exact sentence and page it
came from. It presents source-linked excerpts without deciding deadlines
or eligibility — there is no "your deadline is X" card, no verdict on
whether a document is required. It quotes the letter, highlights what to
look at, and says honestly what it could not find.

## What was built

- **Paste or drop a notice** (text or PDF) — analyzed entirely in the browser;
  nothing is uploaded and no AI service is called at runtime.
- **Dates & timing index:** selected timing excerpts — the sentences around
  dates and timing instructions — quoted verbatim in source order, each with
  a jump back to that line in the letter pane. Multiple clauses stay visible
  side by side with a generic "check for conflicting instructions" reminder;
  when none are found, the tool says so without asserting no deadline exists.
- **Program check-marks:** which benefits are actually checked on the form
  (vector marks in PDFs, `[x]`/`☒` in text); unreadable marks degrade to
  "not readable" instead of being filled in.
- **Document requirements:** requested vs. conditional documents, with
  conditions quoted verbatim ("only if you are applying for SNAP").
- **Renewal steps and contacts:** only when an exact supporting quote exists.
- **Honest boundaries:** scanned image-only PDFs get an explicit "can't read
  this" warning; text without renewal-notice vocabulary gets an "unsupported"
  view, not a confident checklist.

## Technical implementation

- Static client-side app: Vite + TypeScript (strict) + pdf.js. No backend,
  no runtime AI — all parsing is deterministic rules over extracted text.
- PDF pipeline extracts text plus vector checkbox-mark detection from the
  pdf.js operator list; pasted text uses the same document model.
- Evidence model: every emitted item carries verbatim quotes that are
  verified word-for-word against source lines by the QA harness — a
  paraphrased citation fails the test suite.
- Sentence-aware excerpting: timing mentions expand to their full sentence
  context across soft line wraps; the implementation preserves complete
  sentence context in the tested wrapped-negation cases — users still need
  to check the full letter — and overlapping spans merge into larger
  context blocks.
- Deployed via GitHub Pages (Actions), repo CI runs lint, typecheck, unit
  tests, the regression corpus, browser E2E, and the production build on
  every push.

## Challenges & lessons

The central design risk was **unsafe inferred conclusions**. Early versions
read dates in context and emitted deadline cards — and independent review
kept finding cases where that was wrong: a historical "was reviewed on
09/01/2026" became "Respond by 09/01/2026"; a negated "you do not need to
return… by 10/20" clipped the negation at a line wrap and quoted the date as
an instruction. Each round of phrase-level fixes shifted the failure
elsewhere.

The lesson: the safest design was to stop deciding. Fineprint removed
automatic deadline conclusions entirely — the deadline statuses were deleted
from the type system so emitting one is now a compile error — and replaced
them with a quote-first evidence index. A product that says *"here is what
the letter says; check it yourself"* degrades honestly; one that decides
degrades dangerously.

## Evidence & limitations

**Evidence (regression coverage, not accuracy):** 90 unit tests, a
69-case author-built corpus with 201 expected findings (coverage,
abstention, citation-integrity, and annotation-leak checks all run in CI),
and 14 browser E2E tests (mobile, 200% zoom, file rejection, scroll/error
resets). The corpus was written by the project and was visible while the
parser was tuned — it demonstrates the tool behaves as designed on those
inputs; it is **not** held-out or population-accuracy evidence.
See `qa/report/QA-REPORT.md` and `qa/report/REPAIR-REPORT.md` (which records
the review-driven failure history and fixes).

**Limitations:** deterministic rules tuned to renewal-notice structure —
novel layouts may yield fewer excerpts where a human would see more; excerpt
coverage can be incomplete and users are told to check the full letter; no
OCR; scope is a stated intended-use limit, not a reliable classifier; no
eligibility, legal, or medical determinations of any kind. Known accepted
limitations: contact text may remain inside a document excerpt; one source
line is highlighted per evidence click; and lines beginning "Source:" may be
omitted by annotation filtering even when they are part of a real letter.

## AI & tooling attribution

Fineprint was built for Sharon Basovich with AI-led assistance from dot and
Devin (Cognition), including project planning, implementation, tests, review
coordination, documentation, and demo preparation. Sharon authorized the
project and its submission campaign. This description does not imply that
Sharon personally implemented or reviewed the code. The walkthrough
voiceover uses ElevenLabs text-to-speech. The application itself runs
deterministic TypeScript without a runtime AI service.

## Sample document source & rights

The bundled demo letter is the **official blank Texas HHSC form H1830-R
marked "SAMPLE"** (December 2018 edition), retrieved from a public HHS page;
the repo ships only the extracted **text**, not the PDF, and no
redistribution license has been confirmed — the source is linked and
credited in `SOURCE-MANIFEST.md`. It is a historical blank sample shown for
document comprehension, not current policy guidance, and the date printed on
it is presented only as a date on the form. All other demo letters are
original, clearly-labeled synthetic documents written for this project.

## Assets

- **Live demo:** https://sharonbasovich.github.io/fineprint-warriorhacks/
- **Repository:** https://github.com/sharonbasovich/fineprint-warriorhacks
- **Walkthrough video (~2:14, narrated):**
  [docs/video/fineprint-walkthrough.mp4](video/fineprint-walkthrough.mp4) —
  https://github.com/sharonbasovich/fineprint-warriorhacks/blob/main/docs/video/fineprint-walkthrough.mp4
- **Screenshots:** [docs/screenshots/](screenshots/) —
  https://github.com/sharonbasovich/fineprint-warriorhacks/tree/main/docs/screenshots
- **QA / repair reports:**
  [qa/report/QA-REPORT.md](../qa/report/QA-REPORT.md) ·
  [qa/report/REPAIR-REPORT.md](../qa/report/REPAIR-REPORT.md)

## Suggested judge demo path (~2 min)

1. Open the live demo → **"Try it with the sample letter"** — the official
   blank 2018 H1830-R loads: program check-marks read, document conditions
   quoted verbatim.
2. Open the **"Dates & timing mentioned"** card — timing excerpts appear as
   verbatim quotes in letter order; click one to jump the letter pane to
   that exact line.
3. Open **"Housing costs (only if you are applying for SNAP)"** — the
   conditional document keeps its full condition and both page-2 evidence
   quotes.
4. Paste any non-notice text (e.g. a utility bill) — the honest
   "Unsupported document" view appears instead of a confident checklist.

## For the coordinator

- Entrant/team fields: **[coordinator]** — not asserted here.
- Devpost/track-selection forms, Terms/CAPTCHA, and final submission:
  **[coordinator]** — intentionally untouched by the build session.
