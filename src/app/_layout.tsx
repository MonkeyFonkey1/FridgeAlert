import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { AppState } from 'react-native';
import { configureNotificationPresentation, syncReminders } from '../services/expirationNotifications';
import { colors } from '../theme/theme';

const fonts = { 'Instrument Serif': require('../../assets/fonts/InstrumentSerif-Regular.ttf') };

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const reduceMotion = useReducedMotion();
  const [fontsLoaded, fontError] = useFonts(fonts);
  useEffect(() => {
    configureNotificationPresentation();
    void syncReminders();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders();
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="adauga" options={{
          presentation: 'modal',
          animation: reduceMotion ? 'none' : 'slide_from_bottom',
        }} />
      </Stack>
    </>
  );
}
