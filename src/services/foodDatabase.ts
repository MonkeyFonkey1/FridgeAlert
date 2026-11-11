import { requireOptionalNativeModule } from 'expo';
import type { SQLiteDatabase } from 'expo-sqlite';
import { shoppingFoodCategory, shoppingIdentity } from '../data/ingredients';
import type { InventoryActivity } from '../models/activity';
import { categories, maxFoodNameLength, type Food, type HistoryStatus, type NewFood } from '../models/food';
import type { ReminderDays, ReminderPreferences } from '../models/reminder';
import { maxShoppingNameLength, type ShoppingItem, type ShoppingPurchase } from '../models/shopping';
import { isDateKey } from '../utils/expiration';
import { defaultQuantity, isValidQuantity } from '../utils/quantity';

let databasePromise: Promise<SQLiteDatabase> | undefined;
const foodColumns = 'id, name, category, expirationDate, quantity, status, createdAt';

async function loadSQLite() {
  // Metro can report a failing dynamic module as a fatal error and return empty exports.
  // Check the host before evaluating expo-sqlite, which requires the native module eagerly.
  if (!requireOptionalNativeModule('ExpoSQLite')) {
    throw new Error("Cannot find native module 'ExpoSQLite'");
  }
  const { openDatabaseAsync } = await import('expo-sqlite');
  if (typeof openDatabaseAsync !== 'function') {
    throw new Error('Pachetul expo-sqlite nu a putut fi încărcat.');
  }
  return openDatabaseAsync;
}

async function initializeDatabase(): Promise<SQLiteDatabase> {
  const openDatabaseAsync = await loadSQLite();
  const db = await openDatabaseAsync('fridgealert.db');
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.withTransactionAsync(async () => {
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
      if (!version) throw new Error('Versiunea bazei de date nu a putut fi citită.');
      if (version.user_version === 0) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND ${maxFoodNameLength}),
            category TEXT NOT NULL,
            expirationDate TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'discarded')),
            createdAt TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS foods_status_expiration ON foods (status, expirationDate);
        `);
      }
      if (version.user_version < 2) {
        await db.execAsync(`
          ALTER TABLE foods ADD COLUMN quantity INTEGER NOT NULL DEFAULT ${defaultQuantity}
            CHECK (typeof(quantity) = 'integer' AND quantity BETWEEN ${defaultQuantity} AND ${Number.MAX_SAFE_INTEGER});
          PRAGMA user_version = 2;
        `);
      }
      if (version.user_version < 3) {
        await db.execAsync(`
          CREATE TABLE reminder_preferences (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
            daysBefore INTEGER NOT NULL DEFAULT 1 CHECK (daysBefore IN (1, 2, 3))
          );
          INSERT INTO reminder_preferences (id) VALUES (1);
          PRAGMA user_version = 3;
        `);
      }
      if (version.user_version < 4) {
        await db.execAsync(`
          CREATE TABLE shopping_items (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND ${maxShoppingNameLength}),
            identity TEXT NOT NULL UNIQUE,
            checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1))
          );
          PRAGMA user_version = 4;
        `);
      }
      if (version.user_version < 5) {
        await db.execAsync(`
          CREATE TABLE shopping_recipe_amounts (
            shopping_id INTEGER NOT NULL,
            recipe_id TEXT NOT NULL,
            amount TEXT NOT NULL,
            PRIMARY KEY (shopping_id, recipe_id)
          );
          CREATE TRIGGER clear_shopping_recipe_amounts AFTER DELETE ON shopping_items
          BEGIN
            DELETE FROM shopping_recipe_amounts WHERE shopping_id = OLD.id;
          END;
          PRAGMA user_version = 5;
        `);
      }
      if (version.user_version < 6) {
        await db.execAsync(`
          CREATE TABLE inventory_activity (
            id INTEGER PRIMARY KEY,
            type TEXT NOT NULL CHECK (type IN ('added', 'purchased', 'consumed', 'discarded')),
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity BETWEEN 1 AND ${Number.MAX_SAFE_INTEGER}),
            unit TEXT NOT NULL,
            occurredAt TEXT NOT NULL,
            finalized INTEGER NOT NULL CHECK (finalized IN (0, 1) AND
              (finalized = 0 OR type IN ('consumed', 'discarded')))
          );
          PRAGMA user_version = 6;
        `);
      }
    });
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= initializeDatabase().catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function getReminderPreferences(): Promise<ReminderPreferences> {
  const db = await getDatabase();
  const prefs = await db.getFirstAsync<{ enabled: number; daysBefore: ReminderDays }>(
    'SELECT enabled, daysBefore FROM reminder_preferences WHERE id = 1',
  );
  if (!prefs) throw new Error('Preferințele de notificare lipsesc.');
  return { enabled: prefs.enabled === 1, daysBefore: prefs.daysBefore };
}

export async function saveReminderPreferences(prefs: ReminderPreferences): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE reminder_preferences SET enabled = ?, daysBefore = ? WHERE id = 1',
    Number(prefs.enabled), prefs.daysBefore,
  );
}

export async function getActiveFoods(): Promise<Food[]> {
  const db = await getDatabase();
  return db.getAllAsync<Food>(
    `SELECT ${foodColumns} FROM foods WHERE status = ? ORDER BY expirationDate ASC, id ASC`,
    'active',
  );
}

export async function getHistoryFoods(): Promise<Food[]> {
  const db = await getDatabase();
  return db.getAllAsync<Food>(
    `SELECT ${foodColumns} FROM foods WHERE status IN (?, ?) ORDER BY id DESC`,
    'consumed',
    'discarded',
  );
}

export async function getFoodById(id: number): Promise<Food | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Food>(`SELECT ${foodColumns} FROM foods WHERE id = ?`, id);
}

function validateFood(food: NewFood): NewFood {
  const name = food.name.trim();
  if (!name || name.length > maxFoodNameLength || !categories.includes(food.category) || !isDateKey(food.expirationDate)) {
    throw new Error('Datele alimentului sunt invalide.');
  }
  if (!isValidQuantity(food.quantity)) {
    throw new Error('Cantitatea trebuie să fie un număr întreg pozitiv.');
  }
  return { ...food, name };
}

export async function addFood(food: NewFood): Promise<void> {
  const validated = validateFood(food);
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync((txn) => insertActiveFood(txn, validated, 'added'));
}

export async function getInventoryActivity(): Promise<InventoryActivity[]> {
  const db = await getDatabase();
  return db.getAllAsync<InventoryActivity>(
    'SELECT id, type, name, quantity, unit, occurredAt, finalized FROM inventory_activity ORDER BY occurredAt DESC, id DESC',
  );
}

async function recordActivity(
  db: SQLiteDatabase,
  type: InventoryActivity['type'],
  name: string,
  quantity: number,
  occurredAt: string,
  finalized = false,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO inventory_activity (type, name, quantity, unit, occurredAt, finalized) VALUES (?, ?, ?, ?, ?, ?)',
    type, name, quantity, 'buc.', occurredAt, Number(finalized),
  );
}

async function insertActiveFood(
  db: SQLiteDatabase,
  { name, category, expirationDate, quantity }: NewFood,
  source: 'added' | 'purchased',
  occurredAt = new Date().toISOString(),
): Promise<void> {
  await db.runAsync(
    'INSERT INTO foods (name, category, expirationDate, quantity, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    name, category, expirationDate, quantity, 'active', occurredAt,
  );
  await recordActivity(db, source, name, quantity, occurredAt);
}

export async function updateFood(id: number, food: NewFood): Promise<boolean> {
  const { name, category, expirationDate, quantity } = validateFood(food);
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE foods SET name = ?, category = ?, expirationDate = ?, quantity = ? WHERE id = ? AND status = ?',
    name, category, expirationDate, quantity, id, 'active',
  );
  return result.changes > 0;
}

export async function archiveFood(id: number, status: HistoryStatus): Promise<boolean> {
  return applyFoodDisposition(id, status);
}

export async function consumeFood(id: number, quantity: number, expected?: Food): Promise<boolean> {
  return changeFoodQuantity(id, 'consumed', quantity, expected);
}

export async function changeFoodQuantity(
  id: number,
  status: HistoryStatus,
  quantity: number,
  expected?: Food,
): Promise<boolean> {
  if (!isValidQuantity(quantity)) throw new Error('Cantitatea trebuie să fie un număr întreg pozitiv.');
  return applyFoodDisposition(id, status, quantity, expected);
}

async function applyFoodDisposition(
  id: number,
  status: HistoryStatus,
  requestedQuantity?: number,
  expected?: Food,
): Promise<boolean> {
  const db = await getDatabase();
  let changed = false;
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Acquire the write lock before reading the quantity used by this action.
    await txn.runAsync('UPDATE foods SET id = id WHERE 0');
    const food = await txn.getFirstAsync<Food>(
      `SELECT ${foodColumns} FROM foods WHERE id = ? AND status = ?`, id, 'active',
    );
    if (!food || (expected && (food.quantity !== expected.quantity || food.createdAt !== expected.createdAt))) return;

    const quantity = requestedQuantity ?? food.quantity;
    if (quantity > food.quantity) return;
    const finalized = quantity === food.quantity;
    const occurredAt = new Date().toISOString();

    if (finalized) {
      await txn.runAsync('UPDATE foods SET status = ? WHERE id = ?', status, id);
    } else {
      await txn.runAsync('UPDATE foods SET quantity = ? WHERE id = ?', food.quantity - quantity, id);
      await txn.runAsync(
        'INSERT INTO foods (name, category, expirationDate, quantity, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        food.name, food.category, food.expirationDate, quantity, status, occurredAt,
      );
    }
    await recordActivity(txn, status, food.name, quantity, occurredAt, finalized);
    changed = true;
  });
  return changed;
}

export async function deleteFood(id: number): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM foods WHERE id = ?', id);
  return result.changes > 0;
}

export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number; name: string; checked: number; recipeId: string | null; amount: string | null;
  }>(`
    SELECT item.id, item.name, item.checked, plan.recipe_id AS recipeId, plan.amount
    FROM shopping_items AS item
    LEFT JOIN shopping_recipe_amounts AS plan ON plan.shopping_id = item.id
    ORDER BY item.checked ASC, item.id ASC, plan.recipe_id ASC
  `);
  const items = new Map<number, ShoppingItem>();
  for (const row of rows) {
    let item = items.get(row.id);
    if (!item) {
      item = { id: row.id, name: row.name, checked: row.checked === 1, recipeAmounts: [] };
      items.set(row.id, item);
    }
    if (row.recipeId !== null && row.amount !== null) item.recipeAmounts.push({ recipeId: row.recipeId, amount: row.amount });
  }
  return [...items.values()];
}

export async function addShoppingItems(names: string[]): Promise<number> {
  return saveShoppingItems(names.map((name) => ({ name })));
}

export async function addRecipeShoppingItems(recipeId: string, items: { name: string; amount: string }[]): Promise<void> {
  await saveShoppingItems(items, recipeId);
}

async function saveShoppingItems(entries: { name: string; amount?: string }[], recipeId?: string): Promise<number> {
  const items = entries.map((entry) => ({ ...entry, name: entry.name.trim() }));
  if (items.some(({ name }) => !name || name.length > maxShoppingNameLength)) {
    throw new Error('Numele produsului pentru cumpărături este invalid.');
  }
  if (items.length === 0) return 0;

  const db = await getDatabase();
  let added = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const { name, amount } of items) {
      const identity = shoppingIdentity(name);
      const result = await txn.runAsync(
        'INSERT INTO shopping_items (name, identity) VALUES (?, ?) ON CONFLICT(identity) DO NOTHING',
        name, identity,
      );
      added += result.changes;
      if (recipeId && amount) {
        await txn.runAsync(`
          INSERT INTO shopping_recipe_amounts (shopping_id, recipe_id, amount)
          SELECT id, ?, ? FROM shopping_items WHERE identity = ?
          ON CONFLICT(shopping_id, recipe_id) DO UPDATE SET amount = excluded.amount
        `, recipeId, amount, identity);
      }
    }
  });
  return added;
}

export async function setShoppingItemChecked(id: number, checked: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE shopping_items SET checked = ? WHERE id = ?', Number(checked), id);
}

export async function deleteShoppingItem(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM shopping_items WHERE id = ?', id);
}

export async function confirmShoppingPurchases(purchases: ShoppingPurchase[]): Promise<boolean> {
  const details = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  if (details.size === 0 || details.size !== purchases.length) return false;

  const db = await getDatabase();
  let confirmed = false;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE shopping_items SET id = id WHERE 0');
    const checked = await txn.getAllAsync<{ id: number; name: string }>(
      'SELECT id, name FROM shopping_items WHERE checked = 1',
    );
    // A deleted cart row's ID can be reused for another product.
    if (checked.length !== details.size || checked.some(({ id, name }) => details.get(id)?.name !== name)) return;

    const occurredAt = new Date().toISOString();
    for (const item of checked) {
      const purchase = details.get(item.id)!;
      const food = validateFood({ ...purchase, name: item.name, category: shoppingFoodCategory(item.name) });
      await insertActiveFood(txn, food, 'purchased', occurredAt);
      await txn.runAsync('DELETE FROM shopping_items WHERE id = ?', item.id);
    }
    confirmed = true;
  });
  return confirmed;
}

/** Exercises the SQLite connection in the Android host without opening the inventory. */
export async function checkNativeSQLite(): Promise<string> {
  const openDatabaseAsync = await loadSQLite();
  const db = await openDatabaseAsync(':memory:', { useNewConnection: true });
  try {
    await db.execAsync('CREATE TABLE native_check (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO native_check (id, value) VALUES (?, ?)', 1, 'scris');
      await db.runAsync('UPDATE native_check SET value = ? WHERE id = ?', 'verificat', 1);
    });
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM native_check WHERE id = ?', 1);
    if (row?.value !== 'verificat') throw new Error('Verificarea de scriere și citire SQLite a eșuat.');
    await db.runAsync('DELETE FROM native_check WHERE id = ?', 1);
    if (await db.getFirstAsync('SELECT id FROM native_check WHERE id = ?', 1)) {
      throw new Error('Verificarea de ștergere SQLite a eșuat.');
    }
    const engine = await db.getFirstAsync<{ version: string }>('SELECT sqlite_version() AS version');
    if (!engine?.version) throw new Error('Versiunea motorului SQLite nu a putut fi citită.');
    return engine.version;
  } finally {
    await db.closeAsync();
  }
}
