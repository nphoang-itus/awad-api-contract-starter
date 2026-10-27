# AI-LOG.md — IA#3 (CSC13114, session 5: API contract)

Individual assignment. Entries are added as the work happens, in order.

## 2026-10-27 — Phase 0: baseline of the starter repository
Tool: Claude Code.
Asked for: run the baseline (`migrate`, `seed`, `npm test`, `npm run contract`) and check Node version, git state and `.gitignore`, without changing anything.
Kept: all of it as it came. Node v26.12.1; working tree clean; `data/` ignored; 200 menu items seeded; legacy 3 of 3 pass; contract 0 of 29 pass (29 fail).
Changed: nothing.
Rejected: nothing. Nothing went wrong; the result is the expected starting point (legacy green, contract all red). I did not open `test/`; I only saw test names and failure messages in the run output.

## 2026-10-27 — Phase 1: predictions into NOTES.md
Tool: Claude Code.
Asked for: put the two predictions I wrote myself (after reading `CONTRACT.md` without the agent) into `NOTES.md`, then commit and push before the agent touches `src/`.
Kept: my two sentences (§4.2 "equal as JSON values", §4.4 "pages do not move") and my reasons, as I wrote them; the assistant only formatted them.
Changed: the assistant added the section numbers, quoted the two sentences, and added an "Outcome" placeholder per prediction to fill after the first run. It did not add or change any reasoning.
Rejected: nothing.

## 2026-10-27 — Phase 3: the agent's first implementation of /v1
Tool: Claude Code.
Asked for (the handover prompt, as in the README):
> Implement the `/v1` API in `src/v1.js` exactly as `CONTRACT.md` specifies, and the headers its section 5 requires on the legacy API in `src/app.js`. Put any new table in a new migration with a `down`. Do not read or edit anything under `test/`, and do not edit `CONTRACT.md`. Run `npm test` when you are done; it must stay green.

Kept: everything, committed exactly as the agent wrote it, before any contract run: `src/v1.js` (all endpoints, problem details, cursor pagination, idempotency in one `BEGIN IMMEDIATE` transaction), `src/app.js` (Deprecation and Sunset on every legacy response, `Link` on a successful `GET /menu/{id}`), `migrations/002_idempotency_keys.up.sql` and `.down.sql`. Checked: `npm test` is 3 of 3; I did not run `npm run contract` yet.
Changed: nothing yet — this is the agent's first attempt, untouched.
Rejected: nothing yet. Fixes and anything I throw away are logged after the first contract run.

## 2026-10-27 — Phase 4: first contract run, and checking that 29 of 29 is real
Tool: Claude Code.
Asked for: run `npm run contract 2>&1 | tee contract-run-1.txt` before any fix and commit it; then, because everything passed, check whether the pass came from the code or from changed tests: "pass hết mà không có gì fail theo bạn là do bạn đã sửa code gốc hay test hay là bản chất nó có thể pass hết? hãy check lại xem".
Kept: the first run as it is (legacy 3 of 3, contract 29 of 29, commit `faf9439`). The check: `git diff` of `test/` and `CONTRACT.md` against the starter and against `upstream/main` is empty; in a throw-away copy, four deliberate bugs were planted one at a time — raw-text fingerprint (fails 1), offset in the cursor (fails 1), no legacy headers (fails 3), fingerprint without unknown fields (fails **0**).
Changed: nothing in the code.
Rejected: the idea that a green first run needs no further checking — the planted-bug check found a gap in the suite (written up in `NOTES.md` §4).

## 2026-10-27 — Phase 6: sentences that could be read two ways
Tool: Claude Code.
Asked for: "Which sentences of `CONTRACT.md` could be read two ways, and what did you choose for each?"
Kept: the agent's nine points (A1–A9 in `NOTES.md` §3.1) and its choice for each, after it checked every choice against a running server on a throw-away database. I chose A1, A2, A3 as the three points for criterion 4.
Changed: the agent drafted a reason and a contract sentence per point; I decided to keep all nine choices. I added one point the agent did not list (§1 "ignores unknown fields" against §4.2 "any other difference does"), taken from my own Prediction 1.
Rejected: the agent's list as complete — it missed the unknown-field point above, which the tests do not catch either.

## 2026-10-27 — Phase 7: final run and checks before submitting
Tool: Claude Code.
Asked for: re-run everything the way the grader does and save `contract-run-final.txt`.
Kept: a fresh `git clone` of the repository: `migrate && seed && test && contract` gives legacy 3 of 3 and contract 29 of 29. In the repository itself, from an empty `data/`: the same, saved as `contract-run-final.txt`. `migrate:down` reverts `002_idempotency_keys` and `migrate` re-applies it. `git diff ee78c39 -- test/ CONTRACT.md` is empty; no `CREATE TABLE` outside `migrations/`. Commit order: predictions `8e88da5` → agent `b3126ad` → first run `faf9439`.
Changed: nothing in `src/` — there was no fix between the first and the final run.
Rejected: nothing.
