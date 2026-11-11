// SDK 58's package entry also loads push-token code, which requires ExpoApplication.
// Use the local entry points so local reminders work without that native module.
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export {
  getExactAlarmPermissionsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { SchedulableTriggerInputTypes, type NotificationRequest } from 'expo-notifications/build/Notifications.types';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { getNotificationChannelAsync } from 'expo-notifications/build/getNotificationChannelAsync';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
