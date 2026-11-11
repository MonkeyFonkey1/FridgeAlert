import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProject } from './support/loadProject.mjs';

const id = 'fridgealert-expiry-1';
const food = { id: 1, name: 'Iaurt', quantity: 5, expirationDate: '2026-11-15', createdAt: '2026-11-01T10:00:00Z' };
const local = (day, hour) => new Date(2026, 10, day, hour);

function setup(t, { dev = false } = {}) {
  const state = {
    now: local(10, 8), prefs: { enabled: true, daysBefore: 1 }, foods: [{ ...food }],
    granted: true, canAskAgain: true, exact: true, blocked: false,
  };
  t.mock.method(Date, 'now', () => state.now.getTime());
  const pending = new Map();
  const native = {
    AndroidImportance: { NONE: 2, DEFAULT: 5 },
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    getPermissionsAsync: t.mock.fn(async () => ({ granted: state.granted, canAskAgain: state.canAskAgain })),
    requestPermissionsAsync: t.mock.fn(async () => ({ granted: state.granted, canAskAgain: state.canAskAgain })),
    getExactAlarmPermissionsAsync: t.mock.fn(async () => ({ granted: state.exact })),
    setNotificationChannelAsync: t.mock.fn(async () => {}),
    getNotificationChannelAsync: t.mock.fn(async () => ({ importance: state.blocked ? 2 : 5 })),
    getAllScheduledNotificationsAsync: t.mock.fn(async () => [...pending.values()]),
    cancelScheduledNotificationAsync: t.mock.fn(async (identifier) => { pending.delete(identifier); }),
    scheduleNotificationAsync: t.mock.fn(async (request) => {
      pending.set(request.identifier, request);
      return request.identifier;
    }),
    setNotificationHandler: t.mock.fn(),
  };
  const reminders = loadProject('src/services/expirationNotifications.ts', {
    'src/services/localNotifications.ts': native,
    'src/services/foodDatabase.ts': {
      getActiveFoods: async () => state.foods,
      getReminderPreferences: async () => {
        if (state.databaseError) throw state.databaseError;
        return state.prefs;
      },
    },
  }, { dev });
  return { reminders, state, native, pending };
}

test('creates the channel and schedules once at local 09:00 despite concurrent refreshes', async (t) => {
  const { reminders, native, pending } = setup(t);
  const statuses = await Promise.all([reminders.syncReminders(), reminders.syncReminders(), reminders.syncReminders()]);
  assert.deepEqual(statuses, Array(3).fill({ state: 'ready', exact: true, scheduled: 1 }));
  assert.equal(native.scheduleNotificationAsync.mock.callCount(), 1);
  const [channel, options] = native.setNotificationChannelAsync.mock.calls[0].arguments;
  assert.equal(options.name, 'Alerte de expirare');
  assert.deepEqual(pending.get(id).trigger, { channelId: channel, date: local(14, 9), type: 'date' });
  assert.match(pending.get(id).content.body, /mâine: Iaurt \(5 buc\.\)/);
  assert.equal(native.requestPermissionsAsync.mock.callCount(), 0);
});

test('updates dates, quantities, lead time and exact-alarm fallback without leaving duplicates', async (t) => {
  const { reminders, state, pending, native } = setup(t);
  await reminders.syncReminders();
  state.foods[0] = { ...food, quantity: 3, expirationDate: '2026-11-17' };
  state.prefs.daysBefore = 2;
  state.exact = false;
  assert.deepEqual(await reminders.syncReminders(), { state: 'ready', exact: false, scheduled: 1 });
  assert.equal(pending.size, 1);
  assert.deepEqual(pending.get(id).trigger.date, local(15, 9));
  assert.match(pending.get(id).content.body, /peste 2 zile: Iaurt \(3 buc\.\)/);
  assert.deepEqual(native.cancelScheduledNotificationAsync.mock.calls[0].arguments, [id]);
});

test('does not schedule in the past and cancels deleted or archived foods', async (t) => {
  const { reminders, state, pending, native } = setup(t);
  state.foods.push({ ...food, id: 2, expirationDate: '2026-11-10' });
  await reminders.syncReminders();
  assert.deepEqual([...pending.keys()], [id]);
  state.foods = [];
  assert.equal((await reminders.syncReminders()).scheduled, 0);
  assert.equal(native.scheduleNotificationAsync.mock.callCount(), 1);
  assert.deepEqual([...pending.keys()], []);
});

test('lets an already queued delayed alarm arrive but expires it after the food deadline', async (t) => {
  const { reminders, state, pending, native } = setup(t);
  await reminders.syncReminders();
  state.now = local(14, 10);
  await reminders.syncReminders();
  assert.ok(pending.has(id));
  assert.equal(native.scheduleNotificationAsync.mock.callCount(), 1);
  state.now = local(16, 0);
  await reminders.syncReminders();
  assert.equal(pending.has(id), false);
});

test('handles permission requests, denied permissions and a blocked channel', async (t) => {
  const { reminders, state, native, pending } = setup(t);
  await reminders.syncReminders();
  state.granted = false;
  assert.deepEqual(await reminders.syncReminders(), { state: 'blocked-permission', canAskAgain: true });
  assert.equal(pending.size, 0);
  assert.equal(native.requestPermissionsAsync.mock.callCount(), 0);
  await reminders.syncReminders(true);
  assert.equal(native.requestPermissionsAsync.mock.callCount(), 1);
  state.canAskAgain = false;
  await reminders.syncReminders(true);
  assert.equal(native.requestPermissionsAsync.mock.callCount(), 1);
  state.granted = true;
  state.blocked = true;
  assert.deepEqual(await reminders.syncReminders(), { state: 'blocked-channel' });
  assert.equal(pending.size, 0);
});

test('turning reminders off cancels only expiry alarms and a later sync can recover from a failure', async (t) => {
  const { reminders, state, pending, native } = setup(t);
  pending.set('another-alert', { identifier: 'another-alert' });
  native.scheduleNotificationAsync.mock.mockImplementationOnce(async () => { throw new Error('scheduler unavailable'); });
  assert.deepEqual(await reminders.syncReminders(), { state: 'error', step: 'scheduler' });
  assert.equal((await reminders.syncReminders()).scheduled, 1);
  state.prefs.enabled = false;
  assert.deepEqual(await reminders.syncReminders(), { state: 'disabled' });
  assert.deepEqual([...pending.keys()], ['another-alert']);
});

test('development tests use separate local triggers and are disabled in release builds', async (t) => {
  const release = setup(t);
  assert.equal(await release.reminders.testReminder('immediate'), 'unavailable');
  assert.equal(release.native.scheduleNotificationAsync.mock.callCount(), 0);
  const { reminders, state, native } = setup(t, { dev: true });
  state.exact = false;
  assert.equal(await reminders.testReminder('immediate'), 'sent');
  assert.equal(await reminders.testReminder('scheduled'), 'scheduled-inexact');
  const [immediate, delayed] = native.scheduleNotificationAsync.mock.calls.map(({ arguments: [request] }) => request);
  assert.deepEqual(immediate.trigger, { channelId: 'fridgealert-expiration' });
  assert.deepEqual(delayed.trigger, { channelId: 'fridgealert-expiration', type: 'timeInterval', seconds: 10 });
  assert.notEqual(immediate.identifier, delayed.identifier);
  reminders.configureNotificationPresentation();
  const [handler] = native.setNotificationHandler.mock.calls[0].arguments;
  assert.equal((await handler.handleNotification({ request: immediate })).shouldShowList, true);
  assert.equal((await handler.handleNotification({ request: { identifier: 'another-alert' } })).shouldShowList, false);
});

test('local notification adapter loads without the ExpoApplication dependency', () => {
  const mocks = Object.fromEntries([
    'NotificationChannelManager.types', 'NotificationPermissions', 'NotificationsHandler', 'Notifications.types',
    'cancelScheduledNotificationAsync', 'getAllScheduledNotificationsAsync', 'getNotificationChannelAsync',
    'scheduleNotificationAsync', 'setNotificationChannelAsync',
  ].map((name) => [`expo-notifications/build/${name}`, { [name]: () => {} }]));
  // Loading the package barrel would also load the push module and crash on some Expo Go builds.
  Object.defineProperty(mocks, 'expo-notifications', { get() { throw new Error('ExpoApplication unavailable'); } });
  const adapter = loadProject('src/services/localNotifications.ts', mocks);
  assert.equal(typeof adapter.scheduleNotificationAsync, 'function');
});

test('a missing SQLite module blocks reminder sync but the immediate notification test still runs', async (t) => {
  const { reminders, state, native } = setup(t, { dev: true });
  state.databaseError = new Error("Cannot find native module 'ExpoSQLite'");
  assert.deepEqual(await reminders.syncReminders(), {
    state: 'error', step: 'preferences', detail: state.databaseError.message,
  });
  assert.equal(native.setNotificationChannelAsync.mock.callCount(), 0);
  assert.equal(await reminders.testReminder('immediate'), 'sent');
  assert.equal(native.scheduleNotificationAsync.mock.callCount(), 1);
});

test('a native permission or scheduling failure identifies the failed step and leaves the queue usable', async (t) => {
  const { reminders, native } = setup(t, { dev: true });
  native.getPermissionsAsync.mock.mockImplementationOnce(async () => { throw new Error('Permission API unavailable'); });
  assert.deepEqual(await reminders.testReminder('immediate'), {
    state: 'error', step: 'access', detail: 'Permission API unavailable',
  });

  native.scheduleNotificationAsync.mock.mockImplementationOnce(async () => { throw new TypeError('undefined is not a function'); });
  assert.deepEqual(await reminders.testReminder('scheduled'), {
    state: 'error', step: 'scheduler', detail: 'undefined is not a function',
  });
  assert.equal(await reminders.testReminder('scheduled'), 'scheduled');
});

test('an unavailable exact-alarm API falls back to inexact scheduling', async (t) => {
  const { reminders, native } = setup(t, { dev: true });
  native.getExactAlarmPermissionsAsync.mock.mockImplementation(() => { throw new TypeError('undefined is not a function'); });
  assert.deepEqual(await reminders.syncReminders(), { state: 'ready', exact: false, scheduled: 1 });
  assert.equal(await reminders.testReminder('scheduled'), 'scheduled-inexact');
});
