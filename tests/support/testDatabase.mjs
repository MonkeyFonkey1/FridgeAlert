import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadProject } from './loadProject.mjs';

function expoAdapter(database, close) {
  const api = {
    execAsync: async (sql) => database.exec(sql),
    getFirstAsync: async (sql, ...args) => database.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => database.prepare(sql).all(...args),
    runAsync: async (sql, ...args) => database.prepare(sql).run(...args),
    closeAsync: async () => close(database),
  };
  async function transaction(task) {
    database.exec('BEGIN IMMEDIATE');
    try {
      await task(api);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return { ...api, withTransactionAsync: transaction, withExclusiveTransactionAsync: transaction };
}

export function testDatabase(t, seed) {
  const dir = mkdtempSync(join(tmpdir(), 'fridgealert-tests-'));
  const filename = join(dir, 'fridgealert.db');
  const handles = new Set();
  let current;
  function open(path = filename) {
    const database = new DatabaseSync(path);
    handles.add(database);
    return database;
  }
  function close(database) {
    if (handles.delete(database)) database.close();
  }
  t.after(() => {
    for (const database of handles) close(database);
    rmSync(dir, { recursive: true, force: true });
  });
  if (seed) {
    const database = open();
    seed(database);
    close(database);
  }
  const openDatabaseAsync = t.mock.fn(async (name) => {
    if (name === ':memory:') return expoAdapter(open(name), close);
    current = open();
    return expoAdapter(current, close);
  });
  const service = () => loadProject('src/services/foodDatabase.ts', {
    expo: { requireOptionalNativeModule: () => ({}) },
    'expo-sqlite': { openDatabaseAsync },
  });
  return {
    db: service(),
    openDatabaseAsync,
    inspect: () => current,
    reopen: () => {
      close(current);
      return service();
    },
  };
}
