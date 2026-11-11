import assert from 'node:assert/strict';
import test from 'node:test';
import { testDatabase } from './support/testDatabase.mjs';
import { loadProject } from './support/loadProject.mjs';

const yogurt = { name: 'Iaurt', category: 'Lactate', expirationDate: '2026-11-18', quantity: 5 };
const projectFields = ({ name, category, expirationDate, quantity }) => ({ name, category, expirationDate, quantity });

async function checkAll(db) {
  const items = await db.getShoppingItems();
  for (const item of items) await db.setShoppingItemChecked(item.id, true);
  return items;
}

function purchase(item, details = {}) {
  return { id: item.id, name: item.name, quantity: 2, expirationDate: '2026-11-22', ...details };
}

test('migrates a v1 database to v6 without losing active and consumed foods', async (t) => {
  const { db, inspect, reopen } = testDatabase(t, (sql) => sql.exec(`
    CREATE TABLE foods (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      expirationDate TEXT NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL);
    INSERT INTO foods VALUES
      (1, 'Iaurt', 'Lactate', '2026-11-18', 'active', '2026-11-10T12:00:00Z'),
      (2, 'Măr', 'Fructe', '2026-11-14', 'consumed', '2026-11-10T12:00:00Z');
    PRAGMA user_version = 1;
  `));
  assert.equal((await db.getActiveFoods())[0].quantity, 1);
  assert.equal((await db.getHistoryFoods())[0].name, 'Măr');
  assert.equal(inspect().prepare('PRAGMA user_version').get().user_version, 6);
  assert.deepEqual(await db.getReminderPreferences(), { enabled: false, daysBefore: 1 });
  await db.saveReminderPreferences({ enabled: true, daysBefore: 3 });
  const reopened = reopen();
  assert.deepEqual(await reopened.getReminderPreferences(), { enabled: true, daysBefore: 3 });
  assert.equal((await reopened.getFoodById(2)).status, 'consumed');
  assert.deepEqual(await reopened.getInventoryActivity(), []);
});

test('migrates a v4 cart, keeping its checked items and notification preferences', async (t) => {
  const { db, inspect } = testDatabase(t, (sql) => sql.exec(`
    CREATE TABLE shopping_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, identity TEXT NOT NULL UNIQUE, checked INTEGER NOT NULL);
    CREATE TABLE reminder_preferences (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, daysBefore INTEGER NOT NULL);
    INSERT INTO shopping_items VALUES (1, 'Cafea', 'name:cafea', 1);
    INSERT INTO reminder_preferences VALUES (1, 1, 2);
    PRAGMA user_version = 4;
  `));
  assert.deepEqual(await db.getShoppingItems(), [{ id: 1, name: 'Cafea', checked: true, recipeAmounts: [] }]);
  assert.deepEqual(await db.getReminderPreferences(), { enabled: true, daysBefore: 2 });
  assert.equal(inspect().prepare('PRAGMA user_version').get().user_version, 6);
});

test('shares initialization and retries after an open failure', async (t) => {
  const { db, openDatabaseAsync } = testDatabase(t);
  openDatabaseAsync.mock.mockImplementationOnce(async () => { throw new Error('open failed'); });
  await assert.rejects(db.getActiveFoods(), /open failed/);
  await Promise.all([db.getActiveFoods(), db.getShoppingItems(), db.getReminderPreferences()]);
  assert.equal(openDatabaseAsync.mock.callCount(), 2);
});

test('adds, sorts, edits and deletes foods and rejects invalid data', async (t) => {
  const { db } = testDatabase(t);
  await db.addFood({ ...yogurt, name: "  Iaurt d'casă  " });
  await db.addFood({ ...yogurt, expirationDate: '2026-11-15' });
  const [earlier, later] = await db.getActiveFoods();
  assert.equal(earlier.expirationDate, '2026-11-15');
  assert.equal(later.name, "Iaurt d'casă");
  assert.equal(await db.updateFood(later.id, { ...yogurt, quantity: 8, category: 'Altele' }), true);
  assert.deepEqual(projectFields(await db.getFoodById(later.id)), { ...yogurt, category: 'Altele', quantity: 8 });
  for (const invalid of [{ name: ' ' }, { expirationDate: '2026-02-30' }, { quantity: 0 }, { quantity: 1.5 }, { category: 'Invalid' }]) {
    await assert.rejects(db.addFood({ ...yogurt, ...invalid }));
    await assert.rejects(db.updateFood(later.id, { ...yogurt, ...invalid }));
  }
  assert.equal(await db.deleteFood(earlier.id), true);
  assert.equal(await db.deleteFood(earlier.id), false);
  assert.equal(await db.getFoodById(earlier.id), null);
});

test('consumes part of a lot, archives the rest and discards another lot', async (t) => {
  const { db, reopen } = testDatabase(t);
  await db.addFood(yogurt);
  await db.addFood({ ...yogurt, expirationDate: '2026-11-20' });
  const [lot, other] = await db.getActiveFoods();
  assert.equal(await db.consumeFood(lot.id, 6), false);
  await assert.rejects(db.consumeFood(lot.id, 0));
  assert.equal(await db.consumeFood(lot.id, 2), true);
  assert.equal((await db.getFoodById(lot.id)).quantity, 3);
  assert.deepEqual((await db.getHistoryFoods()).map(({ status, quantity }) => [status, quantity]), [['consumed', 2]]);
  assert.equal(await db.consumeFood(lot.id, 3), true);
  assert.equal(await db.consumeFood(lot.id, 1), false);
  assert.equal(await db.archiveFood(other.id, 'discarded'), true);
  assert.equal(await db.updateFood(other.id, yogurt), false);
  const reopened = reopen();
  assert.deepEqual(await reopened.getActiveFoods(), []);
  assert.deepEqual((await reopened.getHistoryFoods()).map(({ status, quantity }) => [status, quantity]), [
    ['consumed', 2], ['discarded', 5], ['consumed', 3],
  ]);
});

test('rolls back a partial consumption when writing its history fails', async (t) => {
  const { db, inspect } = testDatabase(t);
  await db.addFood(yogurt);
  const [lot] = await db.getActiveFoods();
  inspect().exec(`
    CREATE TRIGGER fail_history BEFORE INSERT ON foods WHEN NEW.status = 'consumed'
    BEGIN SELECT RAISE(ABORT, 'history failed'); END;
  `);
  await assert.rejects(db.consumeFood(lot.id, 2), /history failed/);
  assert.equal((await db.getFoodById(lot.id)).quantity, 5);
  assert.deepEqual(await db.getHistoryFoods(), []);
});

test('deduplicates aliases, updates per-recipe amounts and cleans up deleted cart items', async (t) => {
  const { db, inspect, reopen } = testDatabase(t);
  assert.equal(await db.addShoppingItems([' roșie ', 'ROȘII', 'Cafea măcinată']), 2);
  assert.equal(await db.addShoppingItems(['cafea macinata']), 0);
  await assert.rejects(db.addShoppingItems(['Ouă', '  ']));
  await db.addRecipeShoppingItems('salata-de-legume', [{ name: 'Roșii', amount: '2 buc.' }]);
  await db.addRecipeShoppingItems('salata-de-legume', [{ name: 'Roșii', amount: '6 buc.' }]);
  await db.addRecipeShoppingItems('salata-cu-ton', [{ name: 'Roșii', amount: '4 buc.' }]);
  const [tomato] = await db.getShoppingItems();
  assert.deepEqual(tomato.recipeAmounts.map(({ amount }) => amount), ['4 buc.', '6 buc.']);
  await db.setShoppingItemChecked(tomato.id, true);
  assert.deepEqual(await db.getActiveFoods(), []);
  const reopened = reopen();
  assert.equal((await reopened.getShoppingItems()).at(-1).checked, true);
  await reopened.deleteShoppingItem(tomato.id);
  assert.equal(inspect().prepare('SELECT count(*) AS count FROM shopping_recipe_amounts').get().count, 0);
});

test('confirms all checked purchases once, preserves other lots, and rolls back invalid batches', async (t) => {
  const { db, reopen } = testDatabase(t);
  await db.addFood(yogurt);
  await db.addShoppingItems(['Iaurt', 'Măr']);
  const checked = await checkAll(db);
  await db.addShoppingItems(['Cafea']);
  const batch = checked.map((item) => purchase(item));
  assert.equal(await db.confirmShoppingPurchases([]), false);
  assert.equal(await db.confirmShoppingPurchases([batch[0], batch[0]]), false);
  assert.equal(await db.confirmShoppingPurchases([batch[0]]), false);
  await assert.rejects(db.confirmShoppingPurchases([batch[0], { ...batch[1], expirationDate: '2026-11-31' }]));
  assert.equal((await db.getActiveFoods()).length, 1);
  assert.equal((await db.getShoppingItems()).filter(({ checked }) => checked).length, 2);
  assert.equal(await db.confirmShoppingPurchases(batch), true);
  assert.equal(await db.confirmShoppingPurchases(batch), false);
  const reopened = reopen();
  assert.deepEqual((await reopened.getShoppingItems()).map(({ name }) => name), ['Cafea']);
  assert.deepEqual((await reopened.getActiveFoods()).map(projectFields), [
    yogurt, { ...yogurt, quantity: 2, expirationDate: '2026-11-22' },
    { name: 'Măr', category: 'Fructe', quantity: 2, expirationDate: '2026-11-22' },
  ]);
});

test('rejects a stale purchase when SQLite reuses the ID for a different product', async (t) => {
  const { db } = testDatabase(t);
  await db.addShoppingItems(['Ouă']);
  const [oldItem] = await checkAll(db);
  await db.deleteShoppingItem(oldItem.id);
  await db.addShoppingItems(['Lapte']);
  const [newItem] = await checkAll(db);
  assert.equal(newItem.id, oldItem.id);
  assert.equal(await db.confirmShoppingPurchases([purchase(oldItem)]), false);
  assert.deepEqual(await db.getActiveFoods(), []);
  assert.equal((await db.getShoppingItems())[0].name, 'Lapte');
});

test('upgrades a populated v5 database without inventing earlier activities', async (t) => {
  const { db, inspect, reopen } = testDatabase(t);
  await db.addFood(yogurt);
  const [active] = await db.getActiveFoods();
  await db.addFood({ ...yogurt, name: 'Lapte' });
  const [, archived] = await db.getActiveFoods();
  await db.archiveFood(archived.id, 'discarded');
  await db.addRecipeShoppingItems('recipe', [{ name: 'Ouă', amount: '2 buc.' }]);
  inspect().exec('DROP TABLE inventory_activity; PRAGMA user_version = 5;');

  const migrated = reopen();
  assert.deepEqual(await migrated.getActiveFoods(), [active]);
  assert.equal((await migrated.getHistoryFoods())[0].status, 'discarded');
  assert.equal((await migrated.getShoppingItems())[0].recipeAmounts[0].amount, '2 buc.');
  assert.deepEqual(await migrated.getInventoryActivity(), []);
  assert.equal(inspect().prepare('PRAGMA user_version').get().user_version, 6);
});

test('logs partial consumption and disposal, and counts only the last action as finalizing the lot', async (t) => {
  const { db, reopen } = testDatabase(t);
  await db.addFood(yogurt);
  const [original] = await db.getActiveFoods();
  assert.equal(await db.consumeFood(original.id, 2, original), true);
  assert.equal(await db.consumeFood(original.id, 2, original), false);
  const [updated] = await db.getActiveFoods();
  assert.equal(await db.changeFoodQuantity(updated.id, 'discarded', 1, updated), true);
  assert.equal(await db.changeFoodQuantity(updated.id, 'discarded', 1, updated), false);
  const [remaining] = await db.getActiveFoods();
  assert.equal(remaining.quantity, 2);
  assert.equal(await db.changeFoodQuantity(remaining.id, 'discarded', 3, remaining), false);
  assert.equal(await db.changeFoodQuantity(remaining.id, 'discarded', 2, remaining), true);

  const reopened = reopen();
  assert.deepEqual(await reopened.getActiveFoods(), []);
  const events = await reopened.getInventoryActivity();
  assert.deepEqual(events.map(({ type, quantity, finalized }) => [type, quantity, finalized]), [
    ['discarded', 2, 1], ['discarded', 1, 0], ['consumed', 2, 0], ['added', 5, 0],
  ]);
  assert.ok(events.every(({ name, unit, occurredAt }) => name === 'Iaurt' && unit === 'buc.' && Number.isFinite(Date.parse(occurredAt))));
  assert.deepEqual((await reopened.getHistoryFoods()).map(({ status, quantity }) => [status, quantity]), [
    ['discarded', 1], ['consumed', 2], ['discarded', 2],
  ]);
  await reopened.deleteFood(original.id);
  assert.deepEqual(await reopened.getInventoryActivity(), events);
});

test('logs one purchase per checked product and rolls back the entire batch on journal error', async (t) => {
  const { db, inspect, reopen } = testDatabase(t);
  await db.addShoppingItems(['Iaurt', 'Măr']);
  const batch = (await checkAll(db)).map((item) => purchase(item));
  inspect().exec(`
    CREATE TRIGGER fail_purchase_event BEFORE INSERT ON inventory_activity WHEN NEW.name = 'Măr'
    BEGIN SELECT RAISE(ABORT, 'purchase journal failed'); END;
  `);
  await assert.rejects(db.confirmShoppingPurchases(batch), /purchase journal failed/);
  assert.deepEqual(await db.getActiveFoods(), []);
  assert.deepEqual(await db.getInventoryActivity(), []);
  assert.equal((await db.getShoppingItems()).filter((item) => item.checked).length, 2);

  inspect().exec('DROP TRIGGER fail_purchase_event');
  assert.equal(await db.confirmShoppingPurchases(batch), true);
  assert.equal(await db.confirmShoppingPurchases(batch), false);
  const reopened = reopen();
  const events = await reopened.getInventoryActivity();
  assert.deepEqual(events.map(({ type, name, quantity }) => [type, name, quantity]), [
    ['purchased', 'Măr', 2], ['purchased', 'Iaurt', 2],
  ]);
  assert.equal(events[0].occurredAt, events[1].occurredAt);
  assert.equal((await reopened.getActiveFoods()).length, 2);
  assert.deepEqual(await reopened.getShoppingItems(), []);
});

test('rolls back additions and quantity changes if recording their events fails', async (t) => {
  const { db, inspect } = testDatabase(t);
  await db.addFood(yogurt);
  const [lot] = await db.getActiveFoods();
  inspect().exec(`
    CREATE TRIGGER fail_event BEFORE INSERT ON inventory_activity
    BEGIN SELECT RAISE(ABORT, 'journal failed'); END;
  `);
  await assert.rejects(db.addFood(yogurt), /journal failed/);
  await assert.rejects(db.consumeFood(lot.id, 2, lot), /journal failed/);
  await assert.rejects(db.changeFoodQuantity(lot.id, 'discarded', 5, lot), /journal failed/);
  assert.deepEqual(await db.getActiveFoods(), [lot]);
  assert.deepEqual(await db.getHistoryFoods(), []);
  assert.deepEqual((await db.getInventoryActivity()).map(({ type }) => type), ['added']);
});

test('checks the native host before loading SQLite and reports incomplete package exports', async (t) => {
  const requireOptionalNativeModule = t.mock.fn(() => null);
  let imports = 0;
  const database = loadProject('src/services/foodDatabase.ts', {
    expo: { requireOptionalNativeModule },
    get 'expo-sqlite'() {
      imports++;
      return {};
    },
  });
  assert.equal(requireOptionalNativeModule.mock.callCount(), 0);
  await assert.rejects(database.getActiveFoods(), /Cannot find native module 'ExpoSQLite'/);
  await assert.rejects(database.checkNativeSQLite(), /Cannot find native module 'ExpoSQLite'/);
  assert.deepEqual(requireOptionalNativeModule.mock.calls.map(({ arguments: args }) => args), [
    ['ExpoSQLite'], ['ExpoSQLite'],
  ]);
  assert.equal(imports, 0);

  requireOptionalNativeModule.mock.mockImplementation(() => ({}));
  await assert.rejects(database.getActiveFoods(), /Pachetul expo-sqlite nu a putut fi încărcat/);
  assert.equal(imports, 1);
});

test('SQLite smoke check exercises CRUD on a separate in-memory connection', async (t) => {
  const { db, inspect, openDatabaseAsync } = testDatabase(t);
  await db.addFood(yogurt);
  assert.match(await db.checkNativeSQLite(), /^\d+\.\d+/);
  assert.deepEqual(openDatabaseAsync.mock.calls[1].arguments, [':memory:', { useNewConnection: true }]);
  assert.deepEqual((await db.getActiveFoods()).map(projectFields), [yogurt]);
  assert.equal(inspect().prepare("SELECT name FROM sqlite_master WHERE name = 'native_check'").get(), undefined);
});
