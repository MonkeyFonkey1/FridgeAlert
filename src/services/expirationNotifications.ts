import { dateForPicker, displayDate, expirationReminderDate } from '../utils/expiration';
import { getActiveFoods, getReminderPreferences } from './foodDatabase';
import * as Notifications from './localNotifications';

const channelId = 'fridgealert-expiration';
const reminderPrefix = 'fridgealert-expiry-';
const testIdentifier = 'fridgealert-dev-test';
const immediateTestIdentifier = 'fridgealert-dev-test-now';

export type TestReminderMode = 'immediate' | 'scheduled';
type TestReminderResult =
  | 'sent'
  | 'scheduled'
  | 'scheduled-inexact'
  | 'blocked-permission'
  | 'blocked-channel'
  | 'unavailable';

export type ReminderSyncResult =
  | { state: 'disabled' | 'blocked-channel' | 'error' }
  | { state: 'blocked-permission'; canAskAgain: boolean }
  | { state: 'ready'; exact: boolean; scheduled: number };

let queue: Promise<unknown> = Promise.resolve();

// A mutation, a settings change and a return from Android settings can arrive together.
function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task);
  queue = next.catch(() => undefined);
  return next;
}

export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async ({ request }) => {
      const show = request.identifier.startsWith(reminderPrefix) ||
        request.identifier === testIdentifier || request.identifier === immediateTestIdentifier;
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
}

async function exactAlarmsAllowed() {
  return Notifications.getExactAlarmPermissionsAsync().then((permission) => permission.granted, () => false);
}

async function notificationAccess(requestPermission: boolean) {
  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'Alerte de expirare',
    description: 'Mementouri pentru alimentele din frigider.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
  let permission = await Notifications.getPermissionsAsync();
  if (requestPermission && !permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) return { state: 'blocked-permission', canAskAgain: permission.canAskAgain } as const;

  const channel = await Notifications.getNotificationChannelAsync(channelId);
  if (channel?.importance === Notifications.AndroidImportance.NONE) return { state: 'blocked-channel' } as const;
  return { state: 'allowed' } as const;
}

async function removeReminders(requests: Notifications.NotificationRequest[]) {
  for (const request of requests) {
    await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
}

export function syncReminders(requestPermission = false): Promise<ReminderSyncResult> {
  return inOrder(async () => {
    try {
      const prefs = await getReminderPreferences();
      if (!prefs.enabled) {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        await removeReminders(scheduled.filter(({ identifier }) => identifier.startsWith(reminderPrefix)));
        return { state: 'disabled' };
      }

      const access = await notificationAccess(requestPermission);
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const pending = scheduled.filter(({ identifier }) => identifier.startsWith(reminderPrefix));
      if (access.state !== 'allowed') {
        await removeReminders(pending);
        return access;
      }

      const exact = await exactAlarmsAllowed();
      const foods = await getActiveFoods();
      const desired = new Map(foods.map((food) => {
        const date = expirationReminderDate(food.expirationDate, prefs.daysBefore);
        const deadline = dateForPicker(food.expirationDate);
        deadline.setHours(24, 0, 0, 0);
        const signature = JSON.stringify([date.getTime(), food.name, food.quantity, food.expirationDate, food.createdAt, exact]);
        const when = prefs.daysBefore === 1 ? 'mâine' : `peste ${prefs.daysBefore} zile`;
        const body = `Expiră ${when}: ${food.name} (${food.quantity} buc.) · ${displayDate(food.expirationDate)}.`;
        const identifier: string = `${reminderPrefix}${food.id}`;
        return [identifier, { date, deadline, signature, body }] as const;
      }));

      const kept = new Set<string>();
      for (const request of pending) {
        const item = desired.get(request.identifier);
        // Let a reminder already queued for this product arrive late on Android.
        if (item && item.deadline.getTime() > Date.now() && request.content.data?.signature === item.signature) {
          kept.add(request.identifier);
        } else {
          await Notifications.cancelScheduledNotificationAsync(request.identifier);
        }
      }

      let count = kept.size;
      for (const [identifier, item] of desired) {
        if (kept.has(identifier) || item.date.getTime() <= Date.now()) continue;
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: { title: 'FridgeAlert', body: item.body, sound: 'default', data: { signature: item.signature } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId },
        });
        count += 1;
      }

      return { state: 'ready', exact, scheduled: count };
    } catch (error) {
      if (__DEV__) console.warn('Mementourile nu au putut fi sincronizate:', error);
      return { state: 'error' };
    }
  });
}

export function testReminder(mode: TestReminderMode): Promise<TestReminderResult> {
  if (!__DEV__) return Promise.resolve('unavailable');
  return inOrder(async () => {
    const access = await notificationAccess(true);
    if (access.state !== 'allowed') return access.state;

    const immediate = mode === 'immediate';
    if (!immediate) await Notifications.cancelScheduledNotificationAsync(testIdentifier);
    await Notifications.scheduleNotificationAsync({
      identifier: immediate ? immediateTestIdentifier : testIdentifier,
      content: {
        title: 'FridgeAlert',
        body: immediate ? 'Notificare locală de test, trimisă imediat.' : 'Notificare locală de test, programată.',
        sound: 'default',
      },
      trigger: immediate ? { channelId } :
        { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 10, channelId },
    });
    if (immediate) return 'sent';
    return await exactAlarmsAllowed() ? 'scheduled' : 'scheduled-inexact';
  });
}
