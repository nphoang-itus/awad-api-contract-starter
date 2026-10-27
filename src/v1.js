// The /v1 API, implemented from CONTRACT.md. Section numbers below are the contract's.
import { createHash } from 'node:crypto';
import { send, readRaw } from './http.js';

const PROBLEM_BASE = 'https://menu.example/problems/';
// §2: slug → [status, title]. No other types exist.
const PROBLEMS = {
  'invalid-json': [400, 'Malformed JSON'],
  'validation': [400, 'Invalid request'],
  'idempotency-key-missing': [400, 'Idempotency-Key required'],
  'not-found': [404, 'Not found'],
  'idempotency-key-in-flight': [409, 'Request in progress'],
  'unknown-menu-item': [422, 'Unknown menu item'],
  'idempotency-key-reused': [422, 'Idempotency-Key reused'],
  'internal': [500, 'Internal error'],
};

function problem(res, slug, detail, errors) {
  const [status, title] = PROBLEMS[slug];
  const body = { type: PROBLEM_BASE + slug, title, status, detail };
  if (errors) body.errors = errors;
  send(res, status, body, { 'content-type': 'application/problem+json' });
  return true;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const invalid = (res, errors) => problem(res, 'validation', `${plural(errors.length, 'field is', 'fields are')} invalid`, errors);

const isInt = (v, min, max) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const isIdString = (s) => /^[1-9]\d{0,14}$/.test(s);

// §4.2: two bodies are the same when equal as JSON values — key order and
// whitespace do not matter, anything else (unknown fields included) does.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object')
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const fingerprint = (body) => createHash('sha256').update(canonical(body)).digest('hex');

// §4.4 cursor: opaque to the client. It is a position (the id of the last order
// on the page) plus the tableId filter it was issued for.
const encodeCursor = (id, tableId) => Buffer.from(JSON.stringify({ v: 1, id, t: tableId })).toString('base64url');
function decodeCursor(s) {
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
    if (c && c.v === 1 && isInt(c.id, 1, Number.MAX_SAFE_INTEGER) && (c.t === null || isInt(c.t, 1, 200))) return c;
  } catch { /* falls through */ }
  return null;
}

// A query parameter that must be an integer in [min, max]; null when absent.
function intParam(url, name, min, max, errors) {
  const raw = url.searchParams.get(name);
  if (raw === null) return null;
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (isInt(n, min, max)) return n;
  errors.push({ parameter: name, detail: `must be an integer from ${min} to ${max}` });
  return null;
}

export function createV1(db) {
  const q = {
    menuItem: db.prepare('SELECT id, name, price_vnd FROM menu_items WHERE id = ?'),
    order: db.prepare('SELECT id, table_id, total_vnd, created_at FROM orders WHERE id = ?'),
    lines: db.prepare('SELECT menu_item_id, qty, unit_price_vnd FROM order_items WHERE order_id = ? ORDER BY line'),
    list: db.prepare(`SELECT id, table_id, total_vnd, created_at FROM orders
                      WHERE (? IS NULL OR table_id = ?) AND (? IS NULL OR id < ?)
                      ORDER BY id DESC LIMIT ?`),
    insertOrder: db.prepare('INSERT INTO orders (table_id, total_vnd, created_at) VALUES (?, ?, ?)'),
    insertLine: db.prepare('INSERT INTO order_items (order_id, line, menu_item_id, qty, unit_price_vnd) VALUES (?, ?, ?, ?, ?)'),
    getKey: db.prepare('SELECT fingerprint, status, location, body FROM idempotency_keys WHERE key = ?'),
    insertKey: db.prepare('INSERT INTO idempotency_keys (key, fingerprint, status, location, body, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  };

  const menuView = (r) => ({ id: r.id, name: r.name, priceVnd: r.price_vnd });
  const orderView = (r) => ({
    id: r.id,
    tableId: r.table_id,
    items: q.lines.all(r.id).map((l) => ({ menuItemId: l.menu_item_id, qty: l.qty, unitPriceVnd: l.unit_price_vnd })),
    totalVnd: r.total_vnd,
    createdAt: r.created_at,
  });

  // Keys whose first request is still being handled (§4.2 → 409).
  const inFlight = new Set();

  // §4.2 steps 4 and 5 on a parsed body: every problem, not only the first.
  function validateOrder(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body))
      return [{ pointer: '', detail: 'must be a JSON object' }];
    const errors = [];
    if (!isInt(body.tableId, 1, 200)) errors.push({ pointer: '/tableId', detail: 'must be an integer from 1 to 200' });
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      errors.push({ pointer: '/items', detail: 'must be an array of 1 to 20 lines' });
    } else {
      body.items.forEach((line, i) => {
        if (line === null || typeof line !== 'object' || Array.isArray(line)) {
          errors.push({ pointer: `/items/${i}`, detail: 'must be an object' });
          return;
        }
        if (!isInt(line.menuItemId, 1, Number.MAX_SAFE_INTEGER))
          errors.push({ pointer: `/items/${i}/menuItemId`, detail: 'must be a positive integer' });
        if (!isInt(line.qty, 1, 20)) errors.push({ pointer: `/items/${i}/qty`, detail: 'must be an integer from 1 to 20' });
      });
    }
    return errors;
  }

  async function postOrder(req, res) {
    // Step 1: the key.
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 1 || key.length > 255)
      return problem(res, 'idempotency-key-missing', 'POST /v1/orders needs an Idempotency-Key header of 1 to 255 characters');

    // Claim the key before the body is read: the first request still being
    // handled is what a concurrent retry with the same key must find.
    const claimed = !inFlight.has(key);
    if (claimed) inFlight.add(key);
    try {
      const raw = await readRaw(req);

      // Step 2: valid JSON.
      let body;
      try { body = JSON.parse(raw); } catch { return problem(res, 'invalid-json', 'The request body is not valid JSON'); }

      // Step 3: has the key been used before?
      if (!claimed && inFlight.has(key))
        return problem(res, 'idempotency-key-in-flight', 'The first request with this Idempotency-Key is still being processed');

      // Steps 3 to 6 run in ONE transaction, so the key lookup, the order and the
      // key's own row cannot be split by another instance sharing the database.
      db.exec('BEGIN IMMEDIATE');
      let result;
      try {
        result = placeOrder(key, body);
        db.exec(result.created ? 'COMMIT' : 'ROLLBACK');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return result.respond(res);
    } finally {
      if (claimed) inFlight.delete(key);
    }
  }

  // Returns { created, respond(res) }. Only `created: true` is committed.
  function placeOrder(key, body) {
    const fp = fingerprint(body);

    const stored = q.getKey.get(key);
    if (stored) {
      if (stored.fingerprint !== fp)
        return { created: false, respond: (res) => problem(res, 'idempotency-key-reused', 'This Idempotency-Key was already used with a different body') };
      return {
        created: false,
        respond: (res) => send(res, stored.status, JSON.parse(stored.body), { Location: stored.location, 'Idempotent-Replayed': 'true' }) ?? true,
      };
    }

    // Step 4: field rules.
    const errors = validateOrder(body);
    if (errors.length) return { created: false, respond: (res) => invalid(res, errors) };

    // Step 5: every menu item exists.
    const prices = body.items.map((l) => q.menuItem.get(l.menuItemId)?.price_vnd);
    const unknown = [];
    prices.forEach((p, i) => {
      if (p === undefined) unknown.push({ pointer: `/items/${i}/menuItemId`, detail: `menu item ${body.items[i].menuItemId} does not exist` });
    });
    if (unknown.length) {
      return {
        created: false,
        respond: (res) => problem(res, 'unknown-menu-item', `${plural(unknown.length, 'line names', 'lines name')} an unknown menu item`, unknown),
      };
    }

    // Step 6: create the order, and the key with the response it will replay.
    const totalVnd = body.items.reduce((sum, l, i) => sum + prices[i] * l.qty, 0);
    const createdAt = new Date().toISOString();
    const orderId = Number(q.insertOrder.run(body.tableId, totalVnd, createdAt).lastInsertRowid);
    body.items.forEach((l, i) => q.insertLine.run(orderId, i, l.menuItemId, l.qty, prices[i]));
    const order = orderView(q.order.get(orderId));
    const location = `/v1/orders/${orderId}`;
    q.insertKey.run(key, fp, 201, location, JSON.stringify(order), createdAt);
    return { created: true, respond: (res) => send(res, 201, order, { Location: location }) ?? true };
  }

  function listOrders(res, url) {
    const errors = [];
    const tableId = intParam(url, 'tableId', 1, 200, errors);
    const limit = intParam(url, 'limit', 1, 100, errors) ?? 20;
    let after = null;
    const rawCursor = url.searchParams.get('cursor');
    if (rawCursor !== null) {
      const c = decodeCursor(rawCursor);
      if (!c) errors.push({ parameter: 'cursor', detail: 'is not a cursor returned by this endpoint' });
      else if (c.t !== tableId) errors.push({ parameter: 'cursor', detail: 'was issued for a different tableId' });
      else after = c.id;
    }
    if (errors.length) return invalid(res, errors);

    // One row more than the page: nextCursor is null exactly when it does not come back.
    const rows = q.list.all(tableId, tableId, after, after, limit + 1);
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? encodeCursor(page[page.length - 1].id, tableId) : null;
    send(res, 200, { items: page.map(orderView), nextCursor });
    return true;
  }

  return async function handleV1(req, res, url) {
    try {
      const path = url.pathname;
      let m;
      if (req.method === 'GET' && (m = path.match(/^\/v1\/menu\/([^/]+)$/))) {
        const row = isIdString(m[1]) ? q.menuItem.get(Number(m[1])) : undefined;
        if (!row) return problem(res, 'not-found', `No menu item ${m[1]}`);
        send(res, 200, menuView(row));
        return true;
      }
      if (path === '/v1/orders' && req.method === 'POST') return await postOrder(req, res);
      if (path === '/v1/orders' && req.method === 'GET') return listOrders(res, url);
      if (req.method === 'GET' && (m = path.match(/^\/v1\/orders\/([^/]+)$/))) {
        const row = isIdString(m[1]) ? q.order.get(Number(m[1])) : undefined;
        if (!row) return problem(res, 'not-found', `No order ${m[1]}`);
        send(res, 200, orderView(row));
        return true;
      }
      return problem(res, 'not-found', 'No such /v1 path');
    } catch (e) {
      console.error(e);
      if (res.headersSent) return true;
      return problem(res, 'internal', 'The server could not complete the request');
    }
  };
}
