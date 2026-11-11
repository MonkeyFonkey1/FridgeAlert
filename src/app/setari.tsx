import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenLoading, ScreenMessage } from '../components/ScreenMessage';
import { ScreenTopBar } from '../components/ScreenTopBar';
import { reminderDayOptions, type ReminderPreferences } from '../models/reminder';
import { syncReminders, testReminder, type ReminderSyncResult, type TestReminderMode } from '../services/expirationNotifications';
import { checkNativeSQLite, getReminderPreferences, saveReminderPreferences } from '../services/foodDatabase';
import { colors } from '../theme/theme';

function reminderError(result: Extract<ReminderSyncResult, { state: 'error' }>) {
  const messages = {
    preferences: 'Setările mementourilor nu au putut fi citite din SQLite.',
    inventory: 'Inventarul nu a putut fi citit din SQLite.',
    access: 'Canalul sau permisiunile pentru notificări nu au putut fi verificate.',
    scheduler: 'Serviciul Android pentru programarea notificărilor a returnat o eroare.',
  };
  return result.detail ? `${messages[result.step]} ${result.detail}` : messages[result.step];
}

function reminderStatus(result: ReminderSyncResult | undefined) {
  switch (result?.state) {
    case 'disabled': return 'Notificările de expirare sunt dezactivate.';
    case 'blocked-channel': return 'Canalul „Alerte de expirare” este blocat în setările Android.';
    case 'blocked-permission': return 'Android nu permite afișarea notificărilor.';
    case 'error': return reminderError(result);
    case 'ready': return result.exact
      ? 'Mementourile sunt programate pentru ora locală 09:00.'
      : 'Android poate livra mementourile mai târziu de 09:00. Ora exactă nu este disponibilă.';
    default: return 'Se verifică permisiunile…';
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ReminderPreferences>();
  const [result, setResult] = useState<ReminderSyncResult>();
  const [loadError, setLoadError] = useState<string>();
  const [databaseCheck, setDatabaseCheck] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  const readSettings = useCallback(async (isFocused: () => boolean) => {
    try {
      const current = await getReminderPreferences();
      if (!isFocused() || working.current) return;
      setPrefs(current);
      setLoadError(undefined);
      const sync = await syncReminders();
      if (isFocused() && !working.current) setResult(sync);
    } catch (error) {
      if (isFocused()) setLoadError(__DEV__ && error instanceof Error ? `Eroare SQLite: ${error.message}` : 'Verifică accesul la baza de date SQLite.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let focused = true;
    const refresh = () => {
      if (!working.current) void readSettings(() => focused);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      focused = false;
      subscription.remove();
    };
  }, [readSettings]));

  async function run(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      await task();
    } catch {
      setMessage('Acțiunea nu a putut fi finalizată. Încearcă din nou.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  function changePreferences(next: ReminderPreferences, requestPermission = false) {
    void run(async () => {
      await saveReminderPreferences(next);
      setPrefs(next);
      setResult(await syncReminders(requestPermission));
    });
  }

  function runNotificationTest(mode: TestReminderMode) {
    void run(async () => {
      const testResult = await testReminder(mode);
      const messages = {
        sent: 'Testul imediat a fost trimis. Verifică sertarul de notificări.',
        scheduled: 'Testul a fost programat peste aproximativ 10 secunde.',
        'scheduled-inexact': 'Testul a fost programat. Android poate întârzia livrarea peste cele 10 secunde.',
        'blocked-permission': 'Permite notificările pentru Expo Go sau FridgeAlert în setările Android.',
        'blocked-channel': 'Activează canalul „Alerte de expirare” în setările Android.',
        unavailable: 'Testul este disponibil în modul de dezvoltare.',
      };
      setMessage(typeof testResult === 'string' ? messages[testResult] : reminderError(testResult));
      if (prefs?.enabled) setResult(await syncReminders());
    });
  }

  const needsAndroidSettings = result?.state === 'blocked-channel' ||
    (result?.state === 'blocked-permission' && !result.canAskAgain);

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Setări" onBack={() => router.dismissTo('/')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.icon}><AppIcon name="bell-outline" color={colors.green} size={26} /></View>
          <Text accessibilityRole="header" style={styles.title}>Notificări de expirare</Text>
          <Text style={styles.description}>Primește un memento înainte să expire un aliment din frigider.</Text>
        </View>
        {loadError ? <ScreenMessage title="Setările nu au putut fi încărcate" description={loadError} onRetry={() => void readSettings(() => true)} /> :
          !prefs ? <ScreenLoading /> : (
            <>
              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Notificări de expirare</Text>
                  <Switch
                    accessibilityLabel="Notificări de expirare"
                    value={prefs.enabled}
                    disabled={busy}
                    trackColor={{ false: colors.border, true: colors.green }}
                    onValueChange={(enabled) => changePreferences({ ...prefs, enabled }, enabled)}
                  />
                </View>
                <Text accessibilityLiveRegion="polite" style={styles.description}>{reminderStatus(result)}</Text>
                {prefs.enabled && result?.state === 'ready' && (
                  <Text style={styles.description}>Mementouri programate: {result.scheduled}</Text>
                )}
                {prefs.enabled && needsAndroidSettings && (
                  <PrimaryButton label="Deschide setările Android" icon="cog-outline" variant="secondary"
                    disabled={busy} onPress={() => run(() => Linking.openSettings())} />
                )}
                {prefs.enabled && result?.state === 'blocked-permission' && result.canAskAgain && (
                  <PrimaryButton label="Permite notificările" icon="bell-outline" variant="secondary" disabled={busy}
                    onPress={() => run(async () => setResult(await syncReminders(true)))} />
                )}
                {result?.state === 'error' && (
                  <PrimaryButton label="Încearcă din nou" icon="refresh" variant="secondary" disabled={busy}
                    onPress={() => run(async () => setResult(await syncReminders()))} />
                )}
              </View>

              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.label}>Când primești mementoul</Text>
                <Text style={styles.description}>Ora locală 09:00, înainte de data expirării.</Text>
                <View style={styles.options}>
                  {reminderDayOptions.map((daysBefore) => (
                    <Pressable
                      key={daysBefore}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: prefs.daysBefore === daysBefore, disabled: busy }}
                      disabled={busy}
                      onPress={() => {
                        if (prefs.daysBefore !== daysBefore) changePreferences({ ...prefs, daysBefore });
                      }}
                      style={[styles.option, prefs.daysBefore === daysBefore && styles.selected]}
                    >
                      <Text style={styles.optionText}>{daysBefore === 1 ? 'Cu 1 zi înainte' : `Cu ${daysBefore} zile înainte`}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

            </>
          )}
        {__DEV__ && (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.label}>Test de notificări</Text>
            <Text style={styles.description}>Testul imediat verifică afișarea pe același canal. Testul programat verifică și alarma Android.</Text>
            <PrimaryButton label="Testează acum" icon="bell-ring-outline" variant="secondary" disabled={busy}
              onPress={() => runNotificationTest('immediate')} />
            <PrimaryButton label="Testează peste 10 secunde" icon="clock-outline" variant="secondary" disabled={busy}
              onPress={() => runNotificationTest('scheduled')} />
          </View>
        )}
        {message && <Text selectable accessibilityLiveRegion="polite" style={styles.description}>{message}</Text>}
        {__DEV__ && (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.label}>Diagnostic SQLite</Text>
            <Text style={styles.description}>
              {Constants.expoVersion ? `Expo Go ${Constants.expoVersion}` : `Mediu: ${Constants.executionEnvironment}`}
              {' · Runtime Expo '}{Constants.expoRuntimeVersion ?? 'necunoscut'}
            </Text>
            <PrimaryButton label="Verifică SQLite pe dispozitiv" icon="database-check-outline" variant="secondary"
              disabled={busy} onPress={() => run(async () => {
                setDatabaseCheck(undefined);
                try {
                  const version = await checkNativeSQLite();
                  setDatabaseCheck(`SQLite ${version}: citirea, scrierea și ștergerea au trecut.`);
                } catch (error) {
                  setDatabaseCheck(error instanceof Error ? error.message : 'Verificarea SQLite a eșuat.');
                }
              })} />
            {databaseCheck && <Text selectable accessibilityLiveRegion="polite" style={styles.description}>{databaseCheck}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
  heading: { gap: 8, marginBottom: 2 },
  icon: { alignSelf: 'flex-start', padding: 12, borderRadius: 16, backgroundColor: colors.greenSoft },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.7 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: { gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.ink, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  optionText: { color: colors.green, fontSize: 13, fontWeight: '700' },
});
