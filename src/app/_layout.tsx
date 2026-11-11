import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { configureNotificationPresentation, syncReminders } from '../services/expirationNotifications';
import { colors } from '../theme/theme';

export default function RootLayout() {
  useEffect(() => {
    configureNotificationPresentation();
    void syncReminders();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders();
    });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }} />
    </>
  );
}
