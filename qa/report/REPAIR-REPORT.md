# Fineprint — repair report round 3 (for independent re-review)

Repo: https://github.com/sharonbasovich/fineprint-warriorhacks — head `9c417c3` (re-reviewed base).
This repair lands as a new commit on top of `9c417c3`.
Live: https://sharonbasovich.github.io/fineprint-warriorhacks/ (deployed SHA verified in the final message / CI run page).

## Re-review findings → fixes (`src/core/dates.ts`, `src/core/analyze.ts`)

All fixes are general parsing/semantic-attribution changes — no reviewer case is special-cased. Every fix is pinned by regression cases in `qa/corpus/` (author-built) and `qa/adversarial/` (predeclared fresh set, written before the final engine state).

| # | Failure reported | Fix |
|---|---|---|
| 1 | "Your case was reviewed by your caseworker on 09/01/2026" → invented "Respond by 09/01/2026" | `PAST_EVENT` pattern: passive past tense (`was/were/has/have/had been +Ved/Ven`), subject past tense (`you returned/sent/submitted/…`), `last year/month/week`, `previously`, `already returned…` → date classified `other`, never a deadline. |
| 2 | "Last year you returned your form by 03/01/2025" → same misread | Same `PAST_EVENT` rule; `BY_ACTION` still requires the clause to end in `… by <date>` *and* not be past-tense (checked earlier in the chain). |
| 3 | "send pay stubs **even if** your income did not change" → doc made conditional | `conditionOf`: `even if` clauses are skipped — they state the doc is required *regardless*, not a condition. |
| 4 | "Driver's license… **If you do not have one, bring any photo ID**" → conditional | `NEGATED_FALLBACK`: `if (you/…) do not / don't / cannot / can't / have no / lack …` clauses are fallbacks, not preconditions — document stays required (`info`), fallback stays in the detail text. |
| 5 | "You have 10 days … to return your form" → "not stated" | New matcher `REL_HAVE` (`you (will|still)? have N days`) → relative `response-deadline` → "Respond within 10 days" card. |
| 6 | "The office must receive your signed form within 10 days" → "not stated" | `REL_OBLIGATION` extended: agency must-receive AND passive obligations (`must be returned/received/postmarked/completed/…`) → `response-deadline`. |
| 7 | "Printed on 09/25/2026. Return your form by 10/15/2026" → false conflict | `NOTICE_DATE_LABEL` (printed/issued/mailed/dated/postmarked/sent/date) → `notice-date`; conflicts only form among multiple `response-deadline` dates, so printed-date + real deadline no longer conflicts. |
| 8 | Cross-clause contamination (fresh-set find): "due by 10/15 or your benefits will end on 12/31" mislabeled both dates; "we will review your case within 30 days … by 10/15" ate the deadline | Classification is now **clause-scoped**: each date match is judged only on its own sentence/clause (`preClause`/`postClause`/`wordScope`), and `postClause` stops at the next date's clause boundary. `REVIEW_WORDS` narrowed to literal "review date". |

Also landed this round: `must be returned by X` participle forms (`return(?:ed)?|submit(?:ted)?|…` in `BY_ACTION`), `MM-DD-YYYY` dash dates, `deadline-unclear` for ambiguous due dates, `no later than` in deadline words.

## Claim hygiene

- Absolute "never guesses / never invents" claims replaced with the stated–unclear–not-stated framing in `index.html` and `README.md` ("Each finding is marked as stated, unclear, or not said").
- Corpus described in README + generated QA report as **author-built regression coverage, not independent verification**.
- Texas H1830-R posture unchanged and verified: **link-only** — no PDF binary anywhere in repo, `dist/`, or demo assets (audited); the bundled file is extracted *text* of the blank SAMPLE-marked form; the only `.pdf` in the repo is a 431-byte self-generated blank fixture. No explicit redistribution license is claimed.

## Coverage added

- **19 reviewer-case regressions** in `qa/corpus/` (hist-*, doc-*, rel-*, printed-on-*, mailed-on, must-be-returned-by, agency-within-window).
- **12-case predeclared adversarial set** in `qa/adversarial/` (README inside declares it a fresh held-out set written before final tuning; it caught two real cross-clause bugs that are now fixed).
- **13 new unit tests** (`tests/analyze.test.ts` → 30 total).
- **9 browser E2E tests** (`tests/e2e/app.spec.ts`, Playwright + real build): bundled-sample flow, evidence click-through flash, paste, `.txt` upload, image-only-PDF honest warning, sample-switch reset, synthetic disclosure banner, 375px mobile no-horizontal-overflow, 200% zoom usability. Runs in CI (`npx playwright install --with-deps chromium` then `npm run test:e2e`).

## Media

- `docs/video/fineprint-walkthrough.mp4` re-recorded (2:22): the ~1:26–1:33 segment now scrolls to the **Housing costs** conditional card so screen matches narration ("Housing costs, only if you're applying for SNAP"). Old video showed the Identity card during Housing narration.
- `docs/screenshots/*.png` all recaptured against the new build (new privacy badge, printed-on info card, conflict card with dual quotes).
- Devin (AI) + ElevenLabs attribution retained in README and SOURCE-MANIFEST.
