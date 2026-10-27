# NOTES.md — IA#3

## 1. Predictions (written before the agent touched `src/`)

### Prediction 1 — §4.2 Idempotency

> "Two bodies are *the same* when they are equal as JSON values: key order and whitespace do not matter, any other difference does."

**Why I expect the agent to get it wrong:** the agent will likely compare the JSON as a string, or hash the raw request body directly. Then `{"tableId":7,"items":[]}` and `{"items":[], "tableId":7}` would be treated as different, although the contract says they are the same. The opposite mistake is also possible: if the agent keeps only the known fields when comparing, it misses differences in unknown fields. The contract says to ignore unknown fields for the business logic, but such a field still makes the bodies different for the idempotency comparison ("any other difference does").

**Outcome: did not come true.** The agent canonicalised the parsed JSON (keys sorted, recursively) before hashing, and hashed the whole body, unknown fields included. Checked live: the same key with an extra `"note"` field gives `422 idempotency-key-reused`. The first mistake I predicted *is* caught by the suite: a copy that hashes `JSON.stringify(body)` fails `§4.2 "the same body" means the same JSON value`. The second one is **not** caught — see 3.4 and 4.

### Prediction 2 — §4.4 Pagination

> "While a client walks the pages, orders placed after it fetched the first page do not appear on later pages, and no order appears twice or is skipped."

**Why I expect the agent to get it wrong:** the agent will likely implement offset and limit pagination, even though the parameter is called `cursor`. Example: the first page returns orders 10 and 9; then order 11 is added at the head of the list. The next page with `offset=2` returns 9 and 8, so order 9 appears twice. To satisfy the contract, the agent must design a cursor that keeps a position and a boundary for the whole walk; merely encoding an offset into the cursor is not enough.

**Outcome: did not come true.** The agent's cursor is a position (`{"v":1,"id":<last id>,"t":<tableId>}`, base64url), the query is `id < last ORDER BY id DESC LIMIT limit+1`, so new orders (larger ids) never reach later pages. The suite does guard this: a copy with an offset hidden in the cursor fails `§4.4 an order placed between two pages does not shift the next page`.

## 2. First run

`contract-run-1.txt` (commit `faf9439`, before any change to `src/` after the agent's first attempt): **legacy 3 of 3, contract 29 of 29.** Nothing failed, so there is no failing test to explain line by line. As the rubric says, criterion 4 is scored on the list in section 3 instead: see *3.3 The three points the agent guessed at*.

## 3. Sentences that could be read two ways

### 3.1 The agent's answer

Question asked, word for word: *"Which sentences of `CONTRACT.md` could be read two ways, and what did you choose for each?"*

Summary of the agent's answer (each choice checked against the running service on a throw-away database):

| # | Section and sentence | Reading A | Reading B | What the agent chose |
| --- | --- | --- | --- | --- |
| A1 | §4.4 "Use a cursor with the same `tableId` it came from." | an instruction to the client only; a mismatch is undefined | the server must reject a mismatch | B: `400 validation`, `parameter: cursor`, "was issued for a different tableId" (also when `tableId` is dropped) |
| A2 | §2 `not-found`: "no such `/v1` path" | only an unknown path is 404; a known path with the wrong method (`PUT /v1/orders`) needs a `405` | any method/path pair not in §4 is "no such path" | B: `404 not-found`, because §2 says "No other values" for `type` and has no 405 slug |
| A3 | §4.2 "Same key while the first request is **still being processed** → 409" | "processing" starts when the first request's headers arrive | it starts only after the first request's body is read and valid | A: the key is claimed as soon as the headers pass step 1, so a retry that arrives while the first body is still uploading gets `409` |
| A4 | §4.4 / §4.2 "integer from 1 to 100" for a **query string** value, and "integer" for a JSON value | strict decimal digits only | anything a parser turns into an integer (`+5`, `5.0`, `"5"`) | query: digits only (`007` accepted, `+5` rejected); body: a JSON number with an integer value (`2.0` accepted because JSON parses it to `2`, `"2"` rejected) |
| A5 | §4.2 `Idempotency-Key` "a string of 1 to 255 **characters**", "empty" | characters (code points) | bytes or UTF-16 units; and is `"   "` empty? | JavaScript string length (UTF-16 units: an emoji counts 2); a header of only spaces is empty, because Node trims header values |
| A6 | §4.2 "**Only a `201` is stored.** A request that ends in any **4xx** stores nothing" | 5xx is not mentioned, so it might be stored | nothing but a 201 is ever stored | B: the whole step 3–6 runs in one transaction that is rolled back on anything but a 201, so a 500 stores nothing |
| A7 | §4.4 parameters (silent on repeats) | `limit=5&limit=500` is an error | first (or last) value wins | first value wins (`URLSearchParams.get`) |
| A8 | §4.2 "Request headers: `Content-Type: application/json`" | a requirement: other types are an error | a description: the body is parsed as JSON whatever the header | B: the header is not checked; a JSON body sent as `text/plain` places the order |
| A9 | §4.2 field table lists only fields, not line shape | a line that is not an object (`"items": [5]`) has no pointer rule | report it at the line itself | one error at `/items/0`, "must be an object"; and when `items` is not an array, one error at `/items` and no per-line errors |

### 3.2 My decisions

I keep the agent's choice on all nine. `CONTRACT.md` is not edited (rule 2); each "sentence to add" is my proposal for the next revision of the contract.

| # | Decision | Why | Sentence I would add to `CONTRACT.md` |
| --- | --- | --- | --- |
| A1 | reject a mismatched cursor | the cursor's position is only meaningful inside the filter it was made for; silently mixing filters can skip or repeat orders, which §4.4 forbids | §4.4: "A `cursor` used with a different `tableId` than the one it came from — including none — is `400 validation` (`parameter`: `cursor`)." |
| A2 | `404 not-found` for a wrong method | §2 closes the list of `type`s; a 405 would need a new slug, which is an additive change for later | §2 `not-found`: "…or no such `/v1` path. A method that §4 does not list for a path counts as no such path." |
| A3 | in flight from step 1 | a mobile retry can arrive while the first body is still uploading; that is exactly the case §4.2 is about | §4.2: "A request is *being processed* from the moment its `Idempotency-Key` passes step 1 until its response is sent." |
| A4 | digits only in the query; JSON numbers with an integer value in the body | a query string has no types, so the rule must be textual; in JSON `2.0` and `2` are the same value (as §4.2 already says about bodies) | §1: "In a query string an integer is written in decimal digits only. In a body it is a JSON number with no fractional part; a string is never an integer." |
| A5 | UTF-16 length; spaces only is empty | it is what every JS/Node client measures; HTTP strips the spaces anyway | §4.2: "…1 to 255 characters, counted as UTF-16 code units; leading and trailing spaces are not part of the key." |
| A6 | only a 201 is ever stored | a 500 is "our fault"; storing it would replay a failure for 24 hours | §4.2: "**Only a `201` is stored.** A request that ends with any other status stores nothing." |
| A7 | first value wins | matches the common URL API; rejecting would also be fine, but must be written | §4.4: "If a parameter is repeated, the first value is used." |
| A8 | do not check `Content-Type` | §2 has no slug for a wrong media type, and §1 already says the body is JSON | §4.2: "The server parses the body as JSON whatever its `Content-Type`; clients should still send `application/json`." |
| A9 | error at the line; `/items` alone when not an array | one entry per problem, with a pointer that exists in the body | §4.2: "A line that is not an object is reported once at `/items/{i}`. If `items` is not an array of 1 to 20, it is reported once at `/items`." |

### 3.3 The three points the agent guessed at (criterion 4, since the first run was 29 of 29)

Explained the way a failed test would be: the sentence, what the agent did, and the wording I would change it to.

1. **A1 — §4.4 "Use a cursor with the same `tableId` it came from."**
   - *What the agent did:* treated the sentence as a server rule and returned `400 validation` (`parameter: cursor`) when the cursor's `tableId` differs from the request's — including a request with no `tableId` at all. Checked live: a cursor from `tableId=7` sent with `tableId=8`, or with no `tableId`, returns 400.
   - *The other reading:* the sentence only tells the client what to do. A server could ignore the cursor's filter and page through table 8 from order id N, or return an empty page. Both are allowed by the text, and a client cannot tell from the contract which one it gets.
   - *Wording I would change it to:* "A `cursor` used with a different `tableId` than the one it came from — including none — is `400 validation` (`parameter`: `cursor`)."

2. **A2 — §2 `not-found`: "…or no such `/v1` path."**
   - *What the agent did:* returned `404 not-found` for every method and path pair §4 does not list. Checked live: `PUT /v1/orders` and `/v1/orders/` (trailing slash) both return `404 not-found`.
   - *The other reading:* `/v1/orders` *is* a path that exists, so `PUT` on it is not "no such path"; HTTP would say `405 Method Not Allowed` with an `Allow` header. But §2 says "No other values" for `type`, so a 405 has no slug to use.
   - *Wording I would change it to:* "…or no such `/v1` path. A method that §4 does not list for a path counts as no such path."

3. **A3 — §4.2 "Same key while the first request is still being processed → `409 idempotency-key-in-flight`."**
   - *What the agent did:* claimed the key in memory as soon as the request passed step 1 (before reading the body). A second request with the same key that reaches step 3 while the first still holds the claim gets 409; once the first has finished, the second sees the stored row and is replayed or refused.
   - *The other reading:* "processing" starts only when the first request has a valid body (after step 2) or only inside the database transaction. With that reading a retry that arrives during a slow upload would wait for the lock and then be replayed, not get 409.
   - *Wording I would change it to:* "A request is *being processed* from the moment its `Idempotency-Key` passes step 1 until its response is sent."
   - *Note:* the claim lives in one process's memory. Across two instances (§4 test "two instances, one database") the guard is the database: steps 3–6 run in one `BEGIN IMMEDIATE` transaction and `key` is the `PRIMARY KEY`, so the second instance waits and then replays.

### 3.4 A point the agent did not list — found by me

**§1 "The server ignores request fields it does not know." against §4.2 "Two bodies are the same when they are equal as JSON values: … any other difference does."**

- *Reading A:* "ignores" means the unknown field is gone, so `{tableId, items}` and `{tableId, items, note}` are the same order and the retry is replayed.
- *Reading B:* "ignores" is about the business logic only; for the idempotency comparison the bodies are different JSON values, so the second request is `422 idempotency-key-reused`.
- *My choice:* **B**, and the agent's code does B (checked live: an extra `"note"` with the same key gives 422). §4.2 is the more specific sentence, and "any other difference does" leaves no exception. It also protects the client: a reused key with a different body is a client bug that a replay would hide.
- *Sentence I would add:* §4.2 "The comparison uses the whole body, including fields the server does not know; §1's 'ignores' applies to placing the order, not to this comparison."
- *Where it came from:* the second half of my Prediction 1 (commit `8e88da5`, before the agent ran). The agent's list in 3.1 does not include it.

## 4. Findings about the tests

- **The suite does not check §4.2 "any other difference does" for an unknown field.** In a throw-away copy of the repository, I changed only the fingerprint so that it hashes `{ tableId, items }` and drops unknown fields. The suite still passed **29 of 29**. A wrong implementation of reading A (3.4) therefore scores full marks. A test such as "§4.2 the same key with an extra unknown field is 422" would close the gap. I did not edit `test/`; this is a finding only.
- For comparison, the same throw-away method showed the suite *does* catch: a fingerprint of the raw text (fails `§4.2 "the same body" means the same JSON value…`), an offset hidden in the cursor (fails `§4.4 an order placed between two pages does not shift the next page`), and removing the legacy `Deprecation`/`Sunset` headers (fails 3 tests in §5).
