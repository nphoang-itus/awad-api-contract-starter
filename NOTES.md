# NOTES.md — IA#3

## 1. Predictions (written before the agent touched `src/`)

### Prediction 1 — §4.2 Idempotency

> "Two bodies are *the same* when they are equal as JSON values: key order and whitespace do not matter, any other difference does."

**Why I expect the agent to get it wrong:** the agent will likely compare the JSON as a string, or hash the raw request body directly. Then `{"tableId":7,"items":[]}` and `{"items":[], "tableId":7}` would be treated as different, although the contract says they are the same. The opposite mistake is also possible: if the agent keeps only the known fields when comparing, it misses differences in unknown fields. The contract says to ignore unknown fields for the business logic, but such a field still makes the bodies different for the idempotency comparison ("any other difference does").

**Outcome:** _to be filled after the first run._

### Prediction 2 — §4.4 Pagination

> "While a client walks the pages, orders placed after it fetched the first page do not appear on later pages, and no order appears twice or is skipped."

**Why I expect the agent to get it wrong:** the agent will likely implement offset and limit pagination, even though the parameter is called `cursor`. Example: the first page returns orders 10 and 9; then order 11 is added at the head of the list. The next page with `offset=2` returns 9 and 8, so order 9 appears twice. To satisfy the contract, the agent must design a cursor that keeps a position and a boundary for the whole walk; merely encoding an offset into the cursor is not enough.

**Outcome:** _to be filled after the first run._
