import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProject } from './support/loadProject.mjs';

const { activityStatistics } = loadProject('src/utils/activityStatistics.ts');
const today = '2026-11-10';
const timestamp = (day) => new Date(2026, 10, day, 0, 15).toISOString();
const event = (id, type, day, quantity, finalized = 0, unit = 'buc.') => ({
  id, type, quantity, finalized, unit, name: 'Iaurt', occurredAt: timestamp(day),
});

test('separates live inventory, finalized lots, partial quantities and incompatible units', () => {
  const foods = [
    { id: 1, expirationDate: '2026-11-13', quantity: 6 },
    { id: 2, expirationDate: '2026-11-14', quantity: 7 },
    { id: 3, expirationDate: '2026-11-09', quantity: 5 },
  ];
  const events = [
    event(6, 'discarded', 10, 2, 1),
    event(5, 'consumed', 9, 3),
    event(4, 'purchased', 8, 12),
    event(3, 'consumed', 7, 200, 1, 'g'),
    event(2, 'discarded', 6, 1, 0, 'l'),
    event(1, 'added', 4, 5),
  ];
  const stats = activityStatistics(foods, events, 7, today);
  assert.equal(stats.active, 3);
  assert.equal(stats.soon, 1);
  assert.deepEqual(stats.totals, { consumed: 1, discarded: 1 });
  assert.deepEqual(Object.fromEntries(stats.quantities), {
    'buc.': { consumed: 3n, discarded: 2n },
    g: { consumed: 200n, discarded: 0n },
    l: { consumed: 0n, discarded: 1n },
  });
  assert.equal(stats.evolution.length, 7);
  assert.deepEqual(stats.evolution[1], ['2026-11-05', 0]);
  assert.equal(stats.evolution.reduce((sum, [, count]) => sum + count, 0), 6);
});

test('uses inclusive local calendar windows and excludes days after today', () => {
  const events = [
    event(6, 'added', 11, 1),
    event(5, 'added', 10, 1),
    event(4, 'added', 4, 1),
    event(3, 'added', 3, 1),
    event(2, 'added', -19, 1), // October 12
    event(1, 'added', -20, 1), // October 11
  ];
  const stats = (period) => activityStatistics([], events, period, today);
  assert.deepEqual(stats(7).recent.map(({ id }) => id), [5, 4]);
  assert.deepEqual(stats(30).recent.map(({ id }) => id), [5, 4, 3, 2]);
  assert.deepEqual(stats(30).evolution, [
    ['2026-10-12', 1], ['2026-10-19', 0], ['2026-10-26', 0], ['2026-11-02', 2], ['2026-11-09', 1],
  ]);
  assert.deepEqual(stats('all').evolution, [['2026-10', 2], ['2026-11', 3]]);
});

test('shows available inventory with no journal history and keeps very large totals exact', () => {
  const empty = activityStatistics([{ id: 1, expirationDate: today, quantity: 1 }], [], 'all', today);
  assert.deepEqual(empty, {
    active: 1, soon: 1, totals: { consumed: 0, discarded: 0 }, quantities: [], evolution: [], recent: [],
  });
  const events = Array.from({ length: 12 }, (_, index) => event(12 - index, 'consumed', 10, Number.MAX_SAFE_INTEGER, 1));
  const stats = activityStatistics([], events, 'all', today);
  assert.equal(stats.recent.length, 10);
  assert.equal(stats.totals.consumed, 12);
  assert.equal(stats.quantities[0][1].consumed, BigInt(Number.MAX_SAFE_INTEGER) * 12n);
});
