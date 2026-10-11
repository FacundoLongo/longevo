#!/usr/bin/env bash
# A small Node module with a real in-memory store and three behaviors worth testing.
set -euo pipefail
mkdir -p src test
cat > package.json <<'JSON'
{ "name": "shop", "private": true, "type": "module", "scripts": { "test": "node --test" } }
JSON
cat > src/store.mjs <<'JS'
// The real store for this app: orders live in memory.
export class OrderStore {
  #orders = new Map();
  save(order) { this.#orders.set(order.id, structuredClone(order)); }
  get(id) { return this.#orders.get(id) ?? null; }
}
JS
cat > src/orders.mjs <<'JS'
const CODES = { SAVE10: 0.1, SAVE25: 0.25 };

// Saves the order with its total. Discount codes do not apply to items marked noDiscount.
export function placeOrder(store, { id, items, code }) {
  if (!items.length) throw new Error('An order needs at least one item');
  if (code && !(code in CODES)) throw new Error(`Unknown discount code: ${code}`);
  const rate = code ? CODES[code] : 0;
  const total = items.reduce((sum, item) => sum + item.price * (item.noDiscount ? 1 : 1 - rate), 0);
  const order = { id, items, code: code ?? null, total: Math.round(total * 100) / 100 };
  store.save(order);
  return order;
}
JS
