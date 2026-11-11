import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { QuantityInput } from '../components/QuantityInput';
import { ScreenLoading, ScreenMessage } from '../components/ScreenMessage';
import { ScreenTopBar } from '../components/ScreenTopBar';
import { ShoppingRecipeAmounts } from '../components/ShoppingRecipeAmounts';
import type { ShoppingItem, ShoppingPurchase } from '../models/shopping';
import { syncReminders } from '../services/expirationNotifications';
import { confirmShoppingPurchases, getShoppingItems } from '../services/foodDatabase';
import { colors, editorialTitle } from '../theme/theme';
import { dateForPicker, displayDate, isDateKey, localDateKey } from '../utils/expiration';
import { defaultQuantity, parseQuantity } from '../utils/quantity';
import { useFocusedData } from '../utils/useFocusedData';

type Draft = { quantity: string; expirationDate: string };
const successEntrance = FadeInUp.duration(240).reduceMotion(ReduceMotion.System);
const emptyDraft: Draft = { quantity: String(defaultQuantity), expirationDate: '' };

async function getCheckedItems() {
  const items = await getShoppingItems();
  return items.filter(({ checked }) => checked);
}

export default function ConfirmShoppingScreen() {
  const router = useRouter();
  const { result, retry } = useFocusedData(getCheckedItems);

  if (result.status === 'ready' && result.data.length > 0) {
    return <PurchaseForm items={result.data} />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Confirmă cumpărăturile" onBack={() => router.canGoBack() ? router.back() : router.replace('/cumparaturi')} />
      <View style={styles.content}>
        {result.status === 'loading' ? <ScreenLoading /> : result.status === 'error' ? (
          <ScreenMessage title="Lista nu a putut fi încărcată" onRetry={retry} />
        ) : <ScreenMessage title="Niciun produs bifat" description="Bifează în coș produsele pe care le-ai cumpărat." />}
      </View>
    </SafeAreaView>
  );
}

function PurchaseForm({ items }: { items: ShoppingItem[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => pending.current);
    return () => subscription.remove();
  }, []);
  const purchases: ShoppingPurchase[] = items.flatMap(({ id, name }) => {
    const { quantity, expirationDate } = drafts[id] ?? emptyDraft;
    const parsed = parseQuantity(quantity);
    return parsed !== null && isDateKey(expirationDate) ? [{ id, name, quantity: parsed, expirationDate }] : [];
  });
  const incomplete = items.length - purchases.length;

  function updateDraft(id: number, update: (current: Draft) => Draft) {
    setDrafts((previous) => ({ ...previous, [id]: update(previous[id] ?? emptyDraft) }));
    setError(undefined);
  }

  function selectDate(current: string, onSelect: (date: string) => void) {
    Keyboard.dismiss();
    setError(undefined);
    DateTimePickerAndroid.open({
      mode: 'date',
      value: current ? dateForPicker(current) : new Date(),
      onValueChange: (_event, date) => onSelect(localDateKey(date)),
      onError: () => setError('Data nu a putut fi selectată. Încearcă din nou.'),
    });
  }

  function selectCommonDate() {
    selectDate('', (expirationDate) => {
      setDrafts((previous) => Object.fromEntries(items.map(({ id }) => [
        id, { ...(previous[id] ?? emptyDraft), expirationDate },
      ])));
    });
  }

  async function submit() {
    if (incomplete > 0 || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(undefined);
    Keyboard.dismiss();
    try {
      if (await confirmShoppingPurchases(purchases)) {
        await syncReminders();
        setCompleted(true);
        if (Platform.OS === 'android') {
          void performAndroidHapticsAsync(AndroidHaptics.Confirm).catch(() => undefined);
        }
      } else {
        setError('Selecția din coș s-a schimbat. Revino la coș și verifică produsele bifate.');
      }
    } catch {
      setError('Cumpărăturile nu au putut fi adăugate. Încearcă din nou.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  if (completed) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenTopBar title="Cumpărături confirmate" onBack={() => router.canGoBack() ? router.back() : router.replace('/cumparaturi')} />
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={successEntrance} style={styles.success}>
            <View style={styles.successIcon}><AppIcon name="check" color={colors.greenDark} size={31} /></View>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.successTitle}>Cumpărăturile sunt în frigider</Text>
            <PrimaryButton label="Vezi frigiderul" icon="fridge-outline" onPress={() => router.dismissTo('/frigider')} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Confirmă cumpărăturile" disabled={saving} onBack={() => router.canGoBack() ? router.back() : router.replace('/cumparaturi')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <AppIcon name="fridge-outline" color={colors.greenDark} size={25} />
          <Text accessibilityRole="header" style={styles.title}>Pregătește produsele pentru frigider</Text>
          <Text style={styles.description}>Verifică numărul de bucăți sau ambalaje și alege data de expirare pentru fiecare produs.</Text>
          {items.length > 1 && (
            <PrimaryButton label="Alege aceeași dată pentru toate" icon="calendar-month-outline" variant="secondary"
              disabled={saving} onPress={selectCommonDate} />
          )}
        </View>

        {items.map((item) => {
          const draft = drafts[item.id] ?? emptyDraft;
          return (
            <View key={item.id} style={styles.card}>
              <Text accessibilityRole="header" style={styles.productName}>{item.name}</Text>
              <ShoppingRecipeAmounts amounts={item.recipeAmounts} />
              <Text style={styles.description}>Câte bucăți sau ambalaje ai cumpărat?</Text>
              <QuantityInput label={`Cantitate pentru ${item.name}`} value={draft.quantity} disabled={saving}
                invalid={parseQuantity(draft.quantity) === null}
                onChange={(next) => updateDraft(item.id, (previous) => ({
                  ...previous, quantity: typeof next === 'function' ? next(previous.quantity) : next,
                }))} />
              <Pressable accessibilityRole="button"
                accessibilityLabel={`Data expirării pentru ${item.name}: ${draft.expirationDate ? displayDate(draft.expirationDate) : 'alege data'}`}
                disabled={saving}
                onPress={() => selectDate(draft.expirationDate, (expirationDate) => updateDraft(item.id, (previous) => ({ ...previous, expirationDate })))}
                style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
                <AppIcon name="calendar-month-outline" color={colors.green} size={21} />
                <Text style={styles.dateText}>{draft.expirationDate ? displayDate(draft.expirationDate) : 'Alege data expirării'}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {incomplete > 0 && <Text style={styles.description}>Produse de completat: {incomplete}</Text>}
        <PrimaryButton label="Adaugă în frigider" icon="check" onPress={submit} busy={saving} disabled={incomplete > 0} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 24, gap: 12 },
  hero: { backgroundColor: '#DDEBDD', padding: 18, borderRadius: 22, gap: 8 },
  title: { color: colors.ink, fontSize: 23, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.white, padding: 14, gap: 9, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  productName: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, minHeight: 48, paddingHorizontal: 12, paddingVertical: 6 },
  pressed: { backgroundColor: colors.greenSoft },
  dateText: { flexShrink: 1, color: colors.greenDark, fontSize: 14, fontWeight: '700' },
  success: { marginTop: 20, padding: 20, gap: 14, borderRadius: 22, backgroundColor: colors.greenSoft },
  successIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  successTitle: { ...editorialTitle, color: colors.ink, fontSize: 32 },
  footer: { paddingHorizontal: 20, paddingVertical: 10, gap: 7, borderTopWidth: 1, borderColor: colors.border },
  error: { color: colors.red, fontSize: 14 },
});
