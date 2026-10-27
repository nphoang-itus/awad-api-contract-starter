-- CONTRACT.md §4.2 Idempotency: one row per key that placed an order.
-- Written in the same transaction as the order, and only for a 201.
CREATE TABLE idempotency_keys (
  key         TEXT    PRIMARY KEY,   -- the Idempotency-Key header, 1 to 255 characters
  fingerprint TEXT    NOT NULL,      -- sha256 of the canonical JSON of the request body
  status      INTEGER NOT NULL,      -- the stored response: always 201
  location    TEXT    NOT NULL,      -- the stored Location header
  body        TEXT    NOT NULL,      -- the stored response body (JSON text)
  created_at  TEXT    NOT NULL       -- ISO 8601, UTC; a key is kept at least 24 hours
);
