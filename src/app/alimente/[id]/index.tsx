import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../../components/AppIcon';
import { ExpirationBadge, FoodStatusBadge } from '../../../components/FoodBadges';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { QuantityInput } from '../../../components/QuantityInput';
import { ScreenLoading, ScreenMessage } from '../../../components/ScreenMessage';
import { ScreenTopBar } from '../../../components/ScreenTopBar';
import type { HistoryStatus } from '../../../models/food';
import { syncReminders } from '../../../services/expirationNotifications';
import { changeFoodQuantity, consumeFood, deleteFood } from '../../../services/foodDatabase';
import { colors } from '../../../theme/theme';
import { displayDate } from '../../../utils/expiration';
import { defaultQuantity, parseQuantity } from '../../../utils/quantity';
import { useFood } from '../../../utils/useFood';
import { useToday } from '../../../utils/useToday';

type Action = HistoryStatus | 'delete';

export default function FoodDetailsScreen() {
  const router = useRouter();
  const { result, retry } = useFood();
  const food = result.status === 'ready' ? result.data : null;
  const today = useToday();
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string>();
  const [quantityAction, setQuantityAction] = useState<HistoryStatus | null>(null);
  const [quantityInput, setQuantityInput] = useState(String(defaultQuantity));
  const pending = useRef(false);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => pending.current);
    return () => subscription.remove();
  }, []));

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(food && food.status !== 'active' ? '/istoric' : '/');
  }

  async function runAction(action: Action, change: (id: number) => Promise<boolean>) {
    if (!food || pending.current) return;
    pending.current = true;
    setBusyAction(action);
    setActionError(undefined);
    try {
      const changed = await change(food.id);
      setQuantityAction(null);
      if (changed) {
        await syncReminders();
        goBack();
      }
      else {
        if (action !== 'delete') setActionError('Cantitatea disponibilă s-a schimbat. Încearcă din nou.');
        retry();
      }
    } catch {
      setActionError('Nu am putut finaliza acțiunea. Încearcă din nou.');
    } finally {
      pending.current = false;
      setBusyAction(null);
    }
  }

  function chooseQuantity(action: HistoryStatus) {
    setQuantityInput(String(defaultQuantity));
    setActionError(undefined);
    setQuantityAction(action);
  }

  function cancelQuantity() {
    if (pending.current) return;
    Keyboard.dismiss();
    setQuantityAction(null);
    setActionError(undefined);
  }

  function confirmDelete() {
    if (!food || pending.current) return;
    Alert.alert(
      'Ștergi definitiv alimentul?',
      `„${food.name}” va fi eliminat din aplicație. Acțiunile deja înregistrate vor rămâne în statistici.`,
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Șterge', style: 'destructive', onPress: () => { void runAction('delete', deleteFood); } },
      ],
      { cancelable: true },
    );
  }

  const busy = busyAction !== null;
  const selectedQuantity = parseQuantity(quantityInput);
  const validQuantity = food && selectedQuantity !== null && selectedQuantity <= food.quantity;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Detalii aliment" onBack={goBack} disabled={busy} />
      <ScrollView contentContainerStyle={styles.content}>
        {food ? (
          <>
            <View style={styles.summary}>
              <View style={styles.heroIcon}><AppIcon name="basket-outline" size={27} color={colors.mint} /></View>
              <Text style={styles.kicker}>ALIMENT</Text>
              <Text accessibilityRole="header" style={styles.name}>{food.name}</Text>
            </View>

            <View style={styles.attributes}>
              <View style={styles.attribute}>
                <Text style={styles.label}>Categorie</Text>
                <Text style={styles.value}>{food.category}</Text>
              </View>
              <View style={styles.attribute}>
                <Text style={styles.label}>Cantitate</Text>
                <Text style={styles.value}>{food.quantity} buc.</Text>
              </View>
              <View style={styles.attribute}>
                <Text style={styles.label}>Data de expirare</Text>
                <Text style={styles.value}>{displayDate(food.expirationDate)}</Text>
                <ExpirationBadge expirationDate={food.expirationDate} today={today} />
              </View>
              <View style={styles.attribute}>
                <Text style={styles.label}>Stare</Text>
                <FoodStatusBadge status={food.status} />
              </View>
            </View>

            <View style={styles.actions}>
              {food.status === 'active' && (
                <>
                  <PrimaryButton
                    label="Editează"
                    icon="pencil-outline"
                    onPress={() => router.navigate({ pathname: '/alimente/[id]/editeaza', params: { id: String(food.id) } })}
                    disabled={busy}
                  />
                  <PrimaryButton label="Am consumat produsul" icon="check-circle-outline" variant="secondary"
                    onPress={() => chooseQuantity('consumed')} disabled={busy} />
                  <PrimaryButton label="Am aruncat produsul" icon="delete-outline" variant="secondary"
                    onPress={() => chooseQuantity('discarded')} disabled={busy} />
                </>
              )}
              <PrimaryButton label="Șterge definitiv" icon="delete-forever-outline" variant="danger"
                onPress={confirmDelete} disabled={busy} busy={busyAction === 'delete'} />
              {actionError && !quantityAction && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
            </View>
          </>
        ) : result.status === 'loading' ? <ScreenLoading /> : result.status === 'error' ? (
          <ScreenMessage title="Nu am putut încărca alimentul" onRetry={retry} />
        ) : (
          <ScreenMessage title="Alimentul nu mai există" description="Revino la listă pentru a vedea alimentele disponibile." />
        )}
      </ScrollView>
      {quantityAction && food?.status === 'active' && (
        <Modal transparent animationType="fade" onRequestClose={cancelQuantity}>
          <ScrollView contentContainerStyle={styles.overlay} keyboardShouldPersistTaps="handled">
            <View style={styles.dialog} accessibilityViewIsModal>
              <Text accessibilityRole="header" style={styles.dialogTitle}>{quantityAction === 'consumed' ? 'Cât ai consumat?' : 'Cât ai aruncat?'}</Text>
              <Text style={styles.label}>Disponibil: {food.quantity} buc.</Text>
              <QuantityInput
                value={quantityInput}
                onChange={setQuantityInput}
                maximum={food.quantity}
                disabled={busy}
                invalid={Boolean(quantityInput && !validQuantity)}
              />
              {quantityInput !== '' && !validQuantity && (
                <Text accessibilityRole="alert" style={styles.error}>
                  Introdu un număr întreg între 1 și {food.quantity}.
                </Text>
              )}
              {actionError && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
              <PrimaryButton
                label={quantityAction === 'consumed' ? 'Confirmă consumul' : 'Confirmă aruncarea'}
                icon="check"
                disabled={!validQuantity}
                busy={busy}
                onPress={() => {
                  if (selectedQuantity === null || !validQuantity) return;
                  Keyboard.dismiss();
                  void runAction(quantityAction, (id) => quantityAction === 'consumed'
                    ? consumeFood(id, selectedQuantity, food)
                    : changeFoodQuantity(id, quantityAction, selectedQuantity, food));
                }}
              />
              <PrimaryButton label="Anulează" icon="close" variant="secondary" onPress={cancelQuantity} disabled={busy} />
            </View>
          </ScrollView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },
  summary: { backgroundColor: colors.greenDark, borderRadius: 24, padding: 20, gap: 6 },
  heroIcon: { alignSelf: 'flex-start', padding: 10, borderRadius: 14, backgroundColor: '#24523F', marginBottom: 5 },
  kicker: { color: colors.mint, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  name: { color: colors.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  attributes: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 15 },
  attribute: { gap: 5 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  value: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  actions: { gap: 8 },
  error: { color: colors.red, fontSize: 14, fontWeight: '600' },
  overlay: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#142A2180' },
  dialog: { alignSelf: 'center', width: '100%', maxWidth: 420, padding: 20, gap: 12, borderRadius: 20, backgroundColor: colors.white },
  dialogTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
});
