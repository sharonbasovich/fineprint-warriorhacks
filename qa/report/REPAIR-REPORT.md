# Fineprint — narrow repair report (for independent re-review)

Head: `1aeda63` — repo https://github.com/sharonbasovich/fineprint-warriorhacks
Reviewed base was `86abaf7`; this repair is commits `a4f5da9` + `1aeda63`.
CI: https://github.com/sharonbasovich/fineprint-warriorhacks/actions/runs/36666513569 (test + deploy green).
Live: https://sharonbasovich.github.io/fineprint-warriorhacks/ — deployed `index-22J78Hbq.js` is byte-identical to the build of `1aeda63` (sha256 `078f3b118dc3067c0adefafeae67d2ff156a03dab5d8dd5284c79763e1aa3011`).

## Engine fixes (`src/core/dates.ts`, `src/core/analyze.ts`, `src/core/types.ts`)

| Finding | Fix |
|---|---|
| "Printed 10/01/2026" under Due dates invented a Respond-by deadline | Notice-date labels extended to `date/printed/issued/mailed/postmarked` immediately preceding a date; only `response-deadline`-classified mentions can become deadlines — untied `other` dates in the due section no longer qualify (`hardDue` requires `kind === "response-deadline"`). |
| "Return/Send/Respond within N days" misclassified as processing window | `within N days` matches now split by subject: action verbs (`return/send/submit/respond/…`) → `response-deadline` emitted as **"Respond within N days"** with a caution that no calendar date is printed; agency subjects (`we will…`, `the office will…`, `tell you`) stay `review-window`. |
| Yearless "October 15" / ISO "2026-10-15" claimed "no date printed" | ISO `YYYY-MM-DD` parsed; yearless month+day matched with `(?!\d)` guards and flagged `yearless`. Ambiguous due-section dates now emit a new **`deadline-unclear`** status ("Response deadline: unclear in this notice") naming the raw text — never silently resolved, never "not stated". |
| Deadline scan limited to "Due dates" section | `hardDue`/`relDue` scan the **whole letter**; the due-section block is only used for `deadline-unknown`/`deadline-unclear` context. |
| Online vs paper dates flagged as contradiction | Per-date clause-scoped method attribution (`methodLabel`): distinct labels (online/paper) produce **separate labeled deadline cards** ("Online renewal due…" / "Paper form due…"); unlabeled competing dates still emit `deadline-conflict`. The bundled conflicting-dates fixture was rewritten to be genuinely ambiguous (same action, no method words). |
| "if you pay rent" / "if anyone has a job" conditions dropped | `conditionOf` now also matches generic `if (you|anyone|any person|…)` clauses in document bullets, preserving the condition in the item detail. |
| Page-heading contrast 3.66:1 | `.source-view .page-head` `#8a7b52` → `#6e6140` (≈5.4:1 on `#f4f0e6`, ≥4.5:1 AA). |

## Regression coverage

- 7 new held-out corpus cases: `printed-date-not-deadline`, `response-within-days`, `yearless-due-date`, `iso-date-format`, `method-scoped-deadlines`, `deadline-outside-due-section`, `conditional-if-phrasing`. Corpus total: **15 cases / 51 checks — all pass, 0 abstention violations, 0 citation errors** (`npm run eval`).
- 6 new unit tests in `tests/analyze.test.ts` (17/17 pass). Official H1830-R blank-deadline refusal retained and verified (`official-blank-deadline` case + unit test + live check).
- The QA report now states the corpus is **author-built regression coverage, not independent verification** — the earlier "38/38" framing is corrected in both the generated report and README.

## Docs & claims

- H1830-R is now described everywhere as the **official blank 2018 sample** (not a "real recipient notice"): sample selector, hero button, footer copy, README, manifest.
- Texas license claim softened: manifest now states **no explicit redistribution license was located**; we link the official source and bundle only extracted text.
- **ElevenLabs TTS** voiceover disclosed in README "AI attribution" and SOURCE-MANIFEST "Media generated" section.
- README limitations gained the self-authored-QA caveat; hook/premise kept concise.

## Re-recorded demo (`docs/video/fineprint-walkthrough.mp4`, 2:22)

- New script: "official 2018 sample" (not "real notice"), no scanned-PDF claim (not demonstrated), online/paper presented as **separate labeled deadlines**, and a live paste-in demo showing both cards.
- Recorded at 1.3x zoom for readability; narration regenerated per segment and aligned to on-screen cards (the ~1:26 mismatch is gone — narration names the card actually shown).
