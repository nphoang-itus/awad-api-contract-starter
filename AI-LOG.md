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
