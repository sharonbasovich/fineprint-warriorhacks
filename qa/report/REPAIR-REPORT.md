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

---

# Repair report round 4 — conservative scope narrowing

Repo head `a96cce1` (re-reviewed base). This repair lands as a new commit on top.
Round-4 review: old 10/10 and prior 19/19 pass, but 17/24 fresh adversarial
notices pass. Rather than continue a phrase-pattern patch loop, the product is
now **narrowed to an evidence reader for Texas H1830-R-style renewal notices**.

## Scope change (explicit, not silently redefined)

- `AnalysisResult.supported`: text without renewal-notice structure
  (renewal/benefits/check-mark/due-dates/items-we-need wording) returns an
  honest unsupported view — warning + source text, **no checklist**.
- `response-deadline` now requires an **explicit present-tense action + by /
  no later than / on or before** clause, or an explicit relative window
  ("within N days", "you have N days", "due N days from…", "if we don't hear
  from you within N days").
- A date near bare deadline words ("due", "deadline") without an action clause
  classifies as **possible-deadline** → "Deadline: unclear" card quoting the
  sentence verbatim.
- **Historical/mixed context abstains**: past-tense events get a
  "Past date mentioned" info card with the full quote — never "Respond by".
- Document items keep the letter's **complete wording verbatim** in the detail;
  `if/unless/only/even if` anywhere in the bullet appends
  *"Read the condition in the letter — Fineprint quotes it rather than
  deciding it for you."* A condition gates the document only when it leads the
  bullet or sits in the document's own first sentence; a named document's
  title is never dropped.

## Findings → fixes

| # | Failure reported | Fix |
|---|---|---|
| 1 | "previous form was due by 03/15/2026 and was processed" → Respond by | `PAST_EVENT` extended (`was due`, `was processed`, passive Ved/Ven); strict tier requires `BY_ACTION`; → "Past date" info + deadline not stated. Case: `hist-form-due-processed`, `mixed-historical-and-deadline`. |
| 2 | "If no one… sign the No Income Statement" → lost name + label | `docItemTitle`: leading if/unless clause stripped, then verb+article stripped → title "No Income Statement", `conditional`. Case: `conditional-no-income-statement`. |
| 3 | "Proof of address. If you moved, send a new lease." → optional + cut title | Title = first sentence ("Proof of address"); `gateCondition` only inspects the bullet's leading clause or the doc's own first sentence → stays `info`, condition kept verbatim in detail. Case: `doc-later-sentence-condition`. |
| 4 | "due 30 days from the date of this letter" → not stated | `REL_FROM` (`N days from/after`) → relative response-deadline. Case: `relative-due-days-from-letter`. |
| 5 | "If we don't hear from you within 10 days, your case will close" → not stated | `REL_CONTACT` (hear from you / receive your form within N) → relative response-deadline. Case: `relative-hear-from-within`. |
| 6 | Dropped CSV accepted as renewal input | File-type rejection in `loadFile` (.pdf/.txt only) + scope gate → unsupported view for non-notice text. Case: `unsupported-csv`. |
| 7 | Stale scroll survives sample switch | `loadDoc` resets `#source-view` scrollTop. E2E: "switching samples scrolls the notice pane back to the top". |
| 8 | Empty-paste error survives successful paste | `loadDoc` clears status on success. E2E: "a previous error clears after a successful paste". |
| 9 | Long sample URL overflows phone pane | `.src-line` `overflow-wrap:anywhere; word-break:break-word`. |
| 10 | Video ~1:54 "never guessed" claim | s8 narration regenerated (ElevenLabs): "Fineprint is scoped to renewal notices like this one… labeled 'not stated', rather than filled in." Video remuxed (2:28). |

## Evidence wording corrections

- 46-case corpus relabeled **builder-authored regression coverage**; report
  header "Held-out corpus" → "Regression corpus"; scope note states cases were
  visible during tuning and are no longer held out (README, run-eval,
  adversarial README, CI step name).
- 5 historical-date specs updated to the new abstention contract
  ("Past date" info + deadline-unknown) — documented here, not silent.

## Checks

- vitest 30/30 · eval 53 cases / 106 coverage checks = 100%, 0 abstention
  violations, 0 citation errors · Playwright E2E 13/13 · lint/typecheck/build.
- 7 new corpus cases pin every round-4 finding.

---

# Round 5 — product-contract correction (deadline conclusions removed)

Base for re-review: `2faf76f`. This round changes the **product contract**, not
more phrase patterns: Fineprint no longer emits any deadline conclusion at all.

## Changed spec (explicit, not silent)

- **Removed:** every authoritative date output — `Respond by`, `Respond
  within`, "only response date", "not stated in this notice" as a deadline
  verdict, `deadline`, `deadline-unknown`, `deadline-unclear`,
  `deadline-conflict` statuses, "Letter printed on…", "Past date mentioned",
  "Processing window", "Benefits may end", "Date seen" items. The
  `deadline*` statuses no longer exist in `ItemStatus` (compile-time
  guarantee no code path can emit them).
- **New dates section:** "Dates & timing mentioned" — a quote-first evidence
  index. Every line/clause containing a date mention or timing instruction is
  shown **verbatim, in source order, with a jump to the exact line**. Adjacent
  timing clauses are grouped into one context-block excerpt so negation and
  conditions can't be clipped away.
- A leading info card says the section is quoted, not interpreted: "Check
  which, if any, apply to you in the full letter."
- More than one timing clause/date → a generic warning: "More than one
  timing instruction appears in this letter — check for conflicting
  instructions." No winner is picked; nothing is hidden.
- Zero candidates → "No timing excerpt found by this tool — check the full
  letter" (never "no deadline exists").
- **Scope gate:** requires renewal/benefits *vocabulary* (renew\*, benefit\*,
  assistance, coverage, SNAP/TANF/Medicaid/HHSC/caseworker/case no.), not just
  notice-shaped structure — a utility bill with a "Due date" line no longer
  gets a checklist. Scope is stated as an intended-use limit.
- **Action steps hardening (review addendum):** renewal-method steps (online /
  mail-or-fax) now require the renewal-intro section *and* a line whose own
  words name renewing/form-work — a matched line can never promote "pay
  online"/"mail payment" from an unrelated doc into a renewal step. The
  unsupported view's header is "Unsupported document — <name>" and the pane is
  "What the letter says" (was "Your checklist").

## Round-5 review failures → now structurally impossible

| Reported failure (build `2faf76f`) | Why it cannot recur |
|---|---|
| "You do not need to return anything by 10/20/2026" → Respond by | No Respond-by output exists; the negated clause is quoted whole (`negated-do-not-return`) |
| "We will mail you a decision within 14 days" → Respond within | No Respond-within output exists; agency window quoted verbatim (`agency-window-quoted`) |
| "sent on 09/20… return it by 10/20" → real deadline labeled history | No history/current judgment exists; both dates quoted in one excerpt (`mixed-send-return-one-line`) |
| "Return by 10/15. The form is due 10/30." → picked one, hid conflict | Both clauses stay visible + conflict-check reminder (`two-instructions-stay-visible`) |
| ACME electricity bill passed scope gate | Gate now needs renewal vocabulary; bill → unsupported view (`unsupported-utility-bill`) |
| Bill received invented "return the paper form" step | Method steps require the renewal-intro section + renew/form wording in the line itself (`no-invented-method-steps`) |

## Structural guarantees (not just cases)

- `tests/analyze.test.ts` — `FORBIDDEN_ASSERTIONS` regex (Respond by/within,
  "Deadline:", "not stated in this notice", "Conflicting due dates", "Past
  date", "Letter printed", "Processing window", "only response date") asserted
  absent **for every text-input case in both corpora** plus unit-level checks.
- `qa/run-eval.ts` — every case adds an `AUTHORITATIVE_PHRASES` leak check to
  coverage; a leak counts as a violation.
- `ItemStatus` no longer contains deadline statuses — emitting one is a
  compile error.

## History preserved

- Prior rounds' findings and fixes are kept above (rounds 3 and 4 tables).
- The independent reviewer's 30-case fresh run on the old build scored
  27/30 "no misleading output" — that was a result on the *previous* build's
  contract, not a general accuracy claim; the disclosed cases are now
  regression cases here.
- Corpus remains builder-authored regression coverage, visible during tuning —
  not held-out or independent evidence.

## Checks (this round)

- vitest 79/79 · eval 54+6 cases / 179 coverage checks = 100%, 0 abstention
  violations, 0 assertion leaks, 0 citation errors · Playwright E2E 13/13 ·
  lint/typecheck/build clean.
