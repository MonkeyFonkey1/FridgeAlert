import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProject } from './support/loadProject.mjs';

const { defaultInventoryFilters, filterInventory, inventoryOverview } = loadProject('src/utils/inventory.ts');
const today = '2026-11-10';
const stock = [
  { id: 8, name: 'Iaurt natural', category: 'Lactate', expirationDate: '2026-11-14', quantity: 5 },
  { id: 2, name: 'Măr verde', category: 'Fructe', expirationDate: '2026-11-09', quantity: 1 },
  { id: 6, name: 'Măr roșu', category: 'Fructe', expirationDate: '2026-11-13', quantity: 3 },
  { id: 4, name: 'Ouă', category: 'Altele', expirationDate: '2026-11-10', quantity: 6 },
  { id: 3, name: 'Lapte', category: 'Lactate', expirationDate: '2026-11-13', quantity: 2 },
];

test('summarizes empty, expired, today, three days away and later stock', () => {
  assert.deepEqual(inventoryOverview([], today), { entries: [], priority: [], soon: 0, expired: 0, totalQuantity: '0' });
  const overview = inventoryOverview(stock, today);
  assert.deepEqual(overview.entries.map(({ food, days }) => [food.id, days]), [[2, -1], [4, 0], [3, 3], [6, 3], [8, 4]]);
  assert.deepEqual(overview.priority.map(({ food }) => food.id), [4, 3, 6]);
  assert.deepEqual([overview.soon, overview.expired, overview.totalQuantity], [3, 1, '17']);
});

test('combines normalized search, category and expiry filters without changing the original order', () => {
  const { entries } = inventoryOverview(stock, today);
  function ids(filters) {
    return filterInventory(entries, { ...defaultInventoryFilters, ...filters }).map(({ food }) => food.id);
  }
  assert.deepEqual(ids({ query: '  MAR ', category: 'Fructe', expiration: 'soon' }), [6]);
  assert.deepEqual(ids({ query: 'mar', expiration: 'expired' }), [2]);
  assert.deepEqual(ids({ category: 'Lactate', expiration: 'later' }), [8]);
  assert.deepEqual(ids({ category: 'Lactate', query: 'oua' }), []);
  assert.deepEqual(ids({ order: 'desc' }), [8, 6, 3, 4, 2]);
  assert.deepEqual(ids({}), [2, 4, 3, 6, 8]);
});

test('adds inventory counts exactly even when their sum exceeds the JavaScript safe integer limit', () => {
  const largeStock = [{ ...stock[0], quantity: Number.MAX_SAFE_INTEGER }, stock[1], stock[2]];
  assert.equal(inventoryOverview(largeStock, today).totalQuantity, '9007199254740995');
});
