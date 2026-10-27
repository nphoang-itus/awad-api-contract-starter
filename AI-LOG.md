# AI-LOG.md — IA#3 API contract (CSC13114)

Format per entry: my prompt copied verbatim (in Vietnamese, as I typed it), a short summary of the assistant's
response (not a transcript), then the template fields. The assistant (Claude Code) is also "the agent" of this
assignment: it wrote `/v1` from `CONTRACT.md`. It never opened `test/`; it only saw test names and failure messages in
run output. I wrote the two predictions and made every decision on the ambiguous sentences.

Before IA#3 I used the same tool to study the session 5 slides (theory notes and a plan, kept outside this repository).
Those are not logged here: this log starts at the first command run in the repository.

## 2026-10-27 — Phase 0: baseline of the starter repository
Tool: Claude Code (Sonnet 5.5).
Prompt (verbatim):
> Bắt đầu Phase 0 đi

Response (summary):
- Checked the environment: Node v26.12.1 (≥ 22.13 required), working tree clean, git `user.name`/`user.email` set,
  `.gitignore` covers `data/` and `*.db`.
- Ran `npm run migrate` (applied `001_init`), `npm run seed` (200 menu items), `npm test` (legacy **3 of 3**),
  `npm run contract` (**0 of 29**, 29 fail).
- Noted that failure stack traces print the path of `test/contract.test.js`; the assistant did not open the file.
- Committed nothing, as the README says.

Asked for: the baseline run, without changing anything.
Kept: the result as it came: legacy green, contract all red, the expected starting point.
Changed: —
Rejected: —
By hand: —

## 2026-10-27 — starting AI-LOG.md
Tool: Claude Code (Sonnet 5.5).
Prompt (verbatim):
> bổ sung thêm LOG-AI.md theo template @../AI-LOG-template.md giúp tôi luôn, và các mục nào yêu cầu tôi điền thì hãy hỏi tôi và điền trực tiếp vào cho tôi.

Response (summary):
- Asked me two questions before writing: whether to log the theory notes and plan made before IA#3, and what I
  kept/changed in them. My answers: log only IA#3 work from Phase 0; I had read the notes against the slides and found
  no error.
- Created the file as `AI-LOG.md`, not `LOG-AI.md`, because the rubric names `AI-LOG.md`.
- First entry: the Phase 0 baseline.

Asked for: an AI-LOG in the template's format, filled with my input where only I know the answer.
Kept: the template's entry format; the Phase 0 entry.
Changed: the file name (`LOG-AI.md` → `AI-LOG.md`, the rubric's name).
Rejected: logging the pre-assignment study notes (my decision: they are not part of IA#3).
By hand: the answers to the two questions.

## 2026-10-27 — fork, commit and push
Tool: Claude Code (Sonnet 5.5).
Prompt (verbatim):
> Thực hiện fork repo đang chạy về repo của tôi và thực hiện commit và push lên luôn

Response (summary):
- `gh repo fork` from inside the repository: `origin` → `nphoang-itus/awad-api-contract-starter`,
  `upstream` → `fithcmus/awad-api-contract-starter`.
  (A first try, `gh repo fork <repo> --remote`, was refused by `gh`: `--remote` is not allowed with a repository argument.)
- Committed only `AI-LOG.md` (`56a1f95`), pushed `main`.
- Warned me that the fork is **public**, and that GitHub does not allow a fork of a public repository to be private.
  It offered to move the work to a new private repository.

Asked for: my own copy on GitHub, with the work so far committed and pushed.
Kept: the fork and the remote layout.
Changed: —
Rejected: —
By hand: I kept the fork public for now; grading uses the zip, not GitHub.

## 2026-10-27 — Phase 1: my two predictions into NOTES.md
Tool: Claude Code (Sonnet 5.5).
Prompt (verbatim):
> Đây là 2 câu mà tôi nghĩ Agent sẽ làm sai, hãy tổng hợp và tạo các file cần thiết:
> [pasted: the two sentences of `CONTRACT.md` and my reason for each, in Vietnamese — now `NOTES.md` §1]

Response (summary):
- Created `NOTES.md` §1 with two predictions. §4.2: "equal as JSON values". §4.4: "pages do not move under the client".
- Added the section numbers and quoted each sentence from `CONTRACT.md`. Put my reasons into English, without adding
  any argument. Added an "Outcome" line per prediction, to fill after the first run.
- Committed `NOTES.md` + `AI-LOG.md` (`8e88da5`) **before** any change to `src/`, and pushed.

Asked for: my predictions written into `NOTES.md` and committed before the agent runs.
Kept: my two sentences and my reasons.
Changed: formatting only (section numbers, quotes, English).
Rejected: —
By hand: choosing the two sentences and writing the reasons, after reading `CONTRACT.md` without the agent.

## 2026-10-27 — Phase 3: the agent implements /v1
Tool: Claude Code (Sonnet 5.5).
Prompt (verbatim):
> Bắt đầu Phase 3 đi

The handover prompt the agent worked from (the README paragraph, which my plan's Phase 3 told it to use):
> Implement the `/v1` API in `src/v1.js` exactly as `CONTRACT.md` specifies, and the headers its section 5 requires on the legacy API in `src/app.js`. Put any new table in a new migration with a `down`. Do not read or edit anything under `test/`, and do not edit `CONTRACT.md`. Run `npm test` when you are done; it must stay green.

Response (summary):
- Read `src/app.js`, `src/v1.js` (stub), `src/http.js`, `src/db.js`, `src/server.js`, `migrations/001_*`,
  `scripts/migrate.js`. Did not read `test/`.
- `migrations/002_idempotency_keys.up.sql` adds a table with columns `key` (PRIMARY KEY), `fingerprint`, `status`,
  `location`, `body` and `created_at`. The `.down.sql` drops it.
- `src/v1.js`:
  - §2: one `problem()` helper with the eight slugs and titles, and `application/problem+json`. Unknown `/v1` paths
    get `404 not-found`. A `try/catch` turns any exception into `500 internal` with a fixed `detail`, and the stack
    goes to the log.
  - §4.1, §4.3: GET by id; an id that is not a positive integer gets 404.
  - §4.2: steps 1 → 6 in the contract's order.
    - Validation lists every broken field with JSON Pointers; a non-object body gets pointer `""`.
    - The fingerprint is sha256 of a canonical JSON (keys sorted recursively, so unknown fields are included).
    - Steps 3–6 run in one `BEGIN IMMEDIATE` transaction, committed only on a 201.
    - Replays carry `Idempotent-Replayed: true`.
    - An in-memory claim per key gives `409` while the first request is still being handled.
  - §4.4: cursor = base64url of `{v, id, t}`. The query is `id < last ORDER BY id DESC LIMIT limit+1`, so `nextCursor`
    is null exactly when nothing is left. An out-of-range `limit` is a 400, not clamped.
- `src/app.js` (§5): `Deprecation` + `Sunset` on every legacy response, including errors and the legacy 500. `Link`
  only on a successful `GET /menu/{id}`. Legacy errors keep `{ error, message }`.
- `npm run migrate` applied 002; `npm test` 3 of 3. Did **not** run `npm run contract`.
- Committed the first attempt untouched (`b3126ad`), after `8e88da5`, and pushed.

Asked for: the `/v1` implementation from the contract, committed as the agent's first attempt.
Kept: all of it, unchanged, as the rubric requires before the first contract run.
Changed: — (nothing may change before `contract-run-1.txt`)
Rejected: —
By hand: —

## 2026-10-27 — Phase 4: the first contract run
Tool: Claude Code (Sonnet 5.5).
Prompt (verbatim):
> Bắt đầu Phase 4 đi

Response (summary):
- Ran `npm run contract 2>&1 | tee contract-run-1.txt` before any fix: **29 of 29**. All 7 groups passed (§2, §4.1,
  §4.2 placing, §4.2 idempotency, §4.4, §5, and two instances on one database).
- Committed `contract-run-1.txt` alone (`faf9439`) and pushed.
- Pointed out the rubric rule for this case: criterion 4 is scored on criterion 5's list, so three points the agent
  guessed at must be explained like failed tests.

Asked for: the first run, captured as it is.
Kept: `contract-run-1.txt` as it came.
Changed: —
Rejected: —
By hand: —

## 2026-10-27 — checking that 29 of 29 is real
Tool: Claude Code (Opus 5.5).
Prompt (verbatim):
> pass hết mà không có gì fail theo bạn là do bạn đã sửa code gốc hay test hay là bản chất nó có thể pass hết? hãy check lại xem

Response (summary):
- `git diff ee78c39 HEAD -- test/ CONTRACT.md` is empty. Against `upstream/main`, `test/`, `CONTRACT.md`,
  `package.json` and `scripts/` are identical too. The only changed files are `src/v1.js`, `src/app.js`,
  `migrations/002_*`, `NOTES.md`, `AI-LOG.md` and `contract-run-1.txt`.
- Planted one bug at a time in a throw-away copy (`git archive HEAD`), and ran the full suite on each:

  | Planted bug | Result |
  | --- | --- |
  | M1: fingerprint = raw `JSON.stringify(body)` (my Prediction 1, first half) | 28/29; fails `§4.2 "the same body" means the same JSON value…` |
  | M2: fingerprint of `{tableId, items}` only (my Prediction 1, second half) | **29/29**: not caught |
  | M3: an offset hidden in the cursor (my Prediction 2) | 28/29; fails `§4.4 an order placed between two pages does not shift the next page` |
  | M4: no `Deprecation`/`Sunset` on legacy | 26/29; fails 3 tests in §5 |

- The real repository stayed clean, and the copy was deleted.

Asked for: whether the green run came from edited tests or from the code.
Kept: the conclusion that the pass is genuine: tests unchanged, and the suite catches M1, M3 and M4.
Changed: —
Rejected: treating a green first run as proof that the contract is fully covered. M2 shows a gap, now written up in
`NOTES.md` §4.
By hand: —

## 2026-10-27 — Phase 6: sentences that could be read two ways
Tool: Claude Code (Opus 5.5).
Prompt (verbatim):
> Bắt đầu Phase 6 đi

The question the agent answered (the rubric's wording, step 7 of the README):
> Which sentences of `CONTRACT.md` could be read two ways, and what did you choose for each?

Response (summary):
- Probed its own choices on a server with a throw-away database (`DB_PATH` in its scratch folder):
  - `PUT /v1/orders` and `/v1/orders/` both give 404;
  - `limit=007` is accepted, `limit=+5` gets 400, and `limit=5&limit=500` uses the first value;
  - a key made of spaces gets 400; `qty: 2.0` gets 201; a `text/plain` body gets 201;
  - the same key with an extra field gets 422;
  - a cursor from `tableId=7` gets 400 with `tableId=8` and with no `tableId`;
  - `"items": [5]` gives 400 at `/items/0`.
- (A first probe script failed on a zsh glob, `no matches found: …probe.db*`, before the server started. It was
  re-run under bash.)
- Listed nine points (A1–A9, `NOTES.md` §3.1), each with two readings and its choice.
- Asked me three questions. My answers:
  - keep the agent's choice on all nine;
  - use A1, A2, A3 for criterion 4;
  - record the unknown-field point from my Prediction 1 as the point I found.
- Wrote `NOTES.md` §1 outcomes (both predictions did not come true), §2 (first run 29/29), §3.2 decisions with a
  proposed contract sentence each, §3.3 A1–A3 explained like failed tests, §3.4 my own point, and §4 the test-suite
  finding (M2).
- Committed (`7aeeb9a`) and pushed.

Asked for: the agent's list of two-way sentences, my decisions on them, and the criterion-4 write-up.
Kept: the nine points and the agent's choice on each; the drafted reasons and proposed sentences, after I read them.
Changed: added a tenth point the agent did not list: §1 "server ignores unknown fields" against §4.2 "any other
difference does".
Rejected: the agent's list as complete: it missed the unknown-field point, which the tests do not catch either.
By hand: the decisions (keep all nine), the choice of A1–A3, and the unknown-field point (from my Prediction 1,
commit `8e88da5`).

## 2026-10-27 — Phase 7: final run and checks
Tool: Claude Code (Opus 5.5).
Prompt (verbatim):
> Bắt đầu Phase 7 đi. Thực hiện lấy mẫu các file cần thiết từ bài tập trước ở /Users/nphoang/Developer/hcmus/advanced-web/IA02

Response (summary):
- From IA02, took the `SELF_ASSESSMENT_REPORT.md` layout (`# · Criterion · Max · Claimed · Evidence`, plus "What I did
  not manage") and the zip layout (one top folder with the repository). Student ID 23120264.
- Grader-style run on a fresh `git clone` (no `data/`): migrate (001, 002), seed, legacy **3 of 3**, contract
  **29 of 29**.
- On a scratch DB: `migrate:down` reverts `002_idempotency_keys`, `migrate` re-applies it.
- `git diff ee78c39 -- test/ CONTRACT.md` is empty; no `CREATE TABLE` outside `migrations/`.
- Commit order: `8e88da5` predictions → `b3126ad` agent → `faf9439` first run.
- In the repository, from an empty `data/`: `contract-run-final.txt`, 29 of 29, with the same test list and results as
  run 1. Committed (`0197f73`) and pushed.
- Proposed marks for the self-assessment (30/10/9/17/18/8 = 92) and waited for my review.

Asked for: the final run and the grader's checks, plus the templates from IA02.
Kept: `contract-run-final.txt`; the IA02 layouts.
Changed: — (no fix in `src/` between the first and the final run)
Rejected: —
By hand: reviewing the proposed marks (pending).

## 2026-10-27 — rewriting this log
Tool: Claude Code (Opus 5.5).
Prompt (verbatim):
> Phần AI-LOG hiện tôi thấy chưa đủ chi tiết cho các response lắm, ngoài ra chuyển prompt thành tiếng việt đi giống IA02 tôi làm á, thực hiện chỉnh sửa lại cho chi tiết xíu

Response (summary):
- Rewrote every entry in my IA02 format: the prompt verbatim in Vietnamese, a response summary, then
  Asked for / Kept / Changed / Rejected / By hand.
- Added the entries that the earlier version had merged or left out: starting the log, the fork, the "is 29/29 real"
  check, and this rewrite.
- Facts are unchanged and match the commits.

Asked for: a more detailed log with my real prompts.
Kept: the facts and commit references of the earlier entries.
Changed: the format, and the level of detail of each response.
Rejected: —
By hand: —
