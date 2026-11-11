import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenLoading, ScreenMessage } from '../components/ScreenMessage';
import { ScreenTopBar } from '../components/ScreenTopBar';
import { ShoppingRecipeAmounts } from '../components/ShoppingRecipeAmounts';
import { maxShoppingNameLength } from '../models/shopping';
import { addShoppingItems, deleteShoppingItem, getShoppingItems, setShoppingItemChecked } from '../services/foodDatabase';
import { colors } from '../theme/theme';
import { useFocusedData } from '../utils/useFocusedData';

export default function ShoppingScreen() {
  const router = useRouter();
  const { result, retry } = useFocusedData(getShoppingItems);
  const items = result.status === 'ready' ? result.data : [];
  const checkedCount = items.filter(({ checked }) => checked).length;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const pending = useRef(false);

  async function changeList(task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      await task();
      retry();
    } catch {
      setFeedback('Lista nu a putut fi actualizată. Încearcă din nou.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function addItem() {
    if (!name.trim()) return;
    void changeList(async () => {
      const added = await addShoppingItems([name]);
      setName('');
      setFeedback(added ? 'Produs adăugat pe listă.' : 'Produsul este deja pe listă.');
      Keyboard.dismiss();
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Lista de cumpărături" onBack={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.hero}>
              <AppIcon name="cart-outline" color={colors.greenDark} size={26} />
              <Text accessibilityRole="header" style={styles.title}>Ce ai de cumpărat</Text>
              <Text style={styles.description}>
                {result.status === 'ready' ? `De cumpărat: ${items.length - checkedCount} · Bifate: ${checkedCount}` :
                  'Adună într-un loc ce îți lipsește pentru următoarea masă.'}
              </Text>
            </View>
            <View style={styles.form}>
              <TextInput accessibilityLabel="Numele produsului" placeholder="Adaugă un produs"
                placeholderTextColor={colors.muted} style={styles.input} value={name} onChangeText={setName}
                onSubmitEditing={addItem} returnKeyType="done" maxLength={maxShoppingNameLength} editable={!busy} />
              <PrimaryButton label="Adaugă pe listă" icon="plus" onPress={addItem} disabled={busy || !name.trim()} />
              {feedback && <Text accessibilityLiveRegion="polite" style={styles.description}>{feedback}</Text>}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={item.name}
              accessibilityState={{ checked: item.checked, disabled: busy }}
              disabled={busy}
              onPress={() => changeList(() => setShoppingItemChecked(item.id, !item.checked))}
              style={({ pressed }) => [styles.check, pressed && styles.pressed]}
            >
              <AppIcon name={item.checked ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} color={colors.green} size={24} />
              <View style={styles.itemBody}>
                <Text style={[styles.itemName, item.checked && styles.checkedName]}>{item.name}</Text>
                <ShoppingRecipeAmounts amounts={item.recipeAmounts} />
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Șterge ${item.name}`} disabled={busy}
              onPress={() => changeList(() => deleteShoppingItem(item.id))}
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
              <AppIcon name="delete-outline" color={colors.red} size={21} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={result.status === 'error' ? (
          <ScreenMessage title="Nu am putut încărca lista" onRetry={retry} />
        ) : result.status === 'loading' ? <ScreenLoading /> : (
          <ScreenMessage title="Lista este goală" description="Adaugă un produs sau preia ingredientele lipsă dintr-o rețetă." icon="cart-outline" />
        )}
      />
      {checkedCount > 0 && (
        <View style={styles.footer}>
          <PrimaryButton label={`Confirmă cumpărăturile (${checkedCount})`} icon="check"
            disabled={busy} onPress={() => router.navigate('/confirma-cumparaturile')} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 24 },
  header: { gap: 12, marginBottom: 12 },
  hero: { backgroundColor: '#DDEBDD', padding: 18, borderRadius: 22, gap: 7 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  form: { gap: 8 },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, minHeight: 52, borderRadius: 14, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 14, marginBottom: 8 },
  check: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10 },
  itemBody: { flex: 1, gap: 3 },
  itemName: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  checkedName: { textDecorationLine: 'line-through', color: colors.muted },
  pressed: { backgroundColor: colors.greenSoft },
  delete: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingVertical: 10 },
});
