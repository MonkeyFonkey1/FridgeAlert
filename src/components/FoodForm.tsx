import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categories, maxFoodNameLength, type FoodCategory, type NewFood } from '../models/food';
import { colors } from '../theme/theme';
import { dateForPicker, displayDate, isDateKey, localDateKey } from '../utils/expiration';
import { defaultQuantity, parseQuantity } from '../utils/quantity';
import { AppIcon } from './AppIcon';
import { PrimaryButton } from './PrimaryButton';
import { QuantityInput } from './QuantityInput';
import { ScreenTopBar } from './ScreenTopBar';

function FieldError({ message }: { message?: string }) {
  return message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null;
}

export function FoodForm({ initialValues, onSave, onBack }: {
  initialValues?: NewFood;
  onSave: (values: NewFood) => Promise<boolean | void>;
  onBack: () => void;
}) {
  const editing = initialValues !== undefined;
  const [name, setName] = useState(initialValues?.name ?? '');
  const [category, setCategory] = useState<FoodCategory | null>(initialValues?.category ?? null);
  const [dateKey, setDateKey] = useState(initialValues?.expirationDate ?? '');
  const [quantityInput, setQuantityInput] = useState(String(initialValues?.quantity ?? defaultQuantity));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [pickerError, setPickerError] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => savingRef.current);
    return () => subscription.remove();
  }, []);

  const cleanName = name.trim();
  const validDate = isDateKey(dateKey);
  const quantity = parseQuantity(quantityInput);
  const nameError = submitted && !cleanName ? 'Scrie numele alimentului.' : undefined;
  const categoryError = submitted && !category ? 'Alege o categorie.' : undefined;
  const quantityError = submitted && quantity === null ? 'Introdu un număr întreg pozitiv valid.' : undefined;
  const dateError = pickerError
    ? 'Nu am putut deschide calendarul. Încearcă din nou.'
    : submitted && !validDate ? 'Alege o dată de expirare validă.' : undefined;

  function openDatePicker() {
    Keyboard.dismiss();
    setPickerError(false);
    DateTimePickerAndroid.open({
      mode: 'date',
      value: validDate ? dateForPicker(dateKey) : new Date(),
      onValueChange: (_event, value) => setDateKey(localDateKey(value)),
      onError: () => setPickerError(true),
    });
  }

  async function save() {
    if (savingRef.current) return;
    setSubmitted(true);
    setSaveError(undefined);
    if (!cleanName || !category || !validDate || quantity === null) return;

    Keyboard.dismiss();
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await onSave({ name: cleanName, category, expirationDate: dateKey, quantity });
      if (saved === false) setSaveError('Alimentul nu mai este disponibil pentru editare.');
    } catch {
      setSaveError('Produsul nu a putut fi salvat. Încearcă din nou.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title={editing ? 'Detalii aliment' : 'Frigiderul meu'} onBack={onBack} disabled={saving} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <AppIcon name={editing ? 'pencil-outline' : 'basket-plus-outline'} size={27} color={colors.green} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{editing ? 'Editează aliment' : 'Adaugă aliment'}</Text>
          <Text style={styles.description}>
            {editing ? 'Actualizează datele alimentului din frigider.' : 'Notează ce ai în frigider și până când îl poți folosi.'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Nume aliment</Text>
            <TextInput
              accessibilityLabel="Nume aliment"
              autoCapitalize="sentences"
              editable={!saving}
              maxLength={maxFoodNameLength}
              onChangeText={setName}
              placeholder="De exemplu, iaurt"
              placeholderTextColor={colors.muted}
              style={[styles.input, nameError && styles.invalid]}
              value={name}
            />
            <FieldError message={nameError} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cantitate</Text>
            <QuantityInput
              value={quantityInput}
              onChange={setQuantityInput}
              disabled={saving}
              invalid={Boolean(quantityError)}
            />
            <Text style={styles.quantityHint}>Bucăți sau ambalaje</Text>
            <FieldError message={quantityError} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Categorie</Text>
            <View style={styles.categories}>
              {categories.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: category === option, disabled: saving }}
                  disabled={saving}
                  onPress={() => setCategory(option)}
                  style={({ pressed }) => [styles.chip, (category === option || pressed) && styles.selected]}
                >
                  {category === option && <AppIcon name="check" size={17} color={colors.green} />}
                  <Text style={[styles.chipText, category === option && styles.selectedText]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <FieldError message={categoryError} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Data de expirare</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={validDate ? `Data de expirare: ${displayDate(dateKey)}` : 'Alege data de expirare'}
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={openDatePicker}
              style={({ pressed }) => [styles.input, styles.dateButton, pressed && styles.selected, dateError && styles.invalid]}
            >
              <AppIcon name="calendar-month-outline" size={22} color={colors.green} />
              <Text style={[styles.dateText, !validDate && styles.description]}>
                {validDate ? displayDate(dateKey) : 'Alege o dată'}
              </Text>
              <AppIcon name="chevron-right" size={22} color={colors.muted} />
            </Pressable>
            <FieldError message={dateError} />
          </View>

          <FieldError message={saveError} />
        </View>

        <PrimaryButton
          label={saving ? 'Se salvează…' : editing ? 'Salvează modificările' : 'Salvează produs'}
          icon="check"
          onPress={save}
          busy={saving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 18 },
  heading: { gap: 7 },
  headingIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft, marginBottom: 2 },
  title: { fontSize: 30, color: colors.ink, fontWeight: '800', letterSpacing: -0.8 },
  description: { color: colors.muted, fontSize: 15 },
  form: { padding: 16, gap: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, color: colors.ink, fontSize: 16, paddingHorizontal: 13, paddingVertical: 10 },
  quantityHint: { color: colors.muted, fontSize: 13 },
  invalid: { borderColor: colors.red },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.background },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  selected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  selectedText: { color: colors.green },
  dateButton: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { flex: 1, color: colors.ink, fontSize: 16 },
  error: { color: colors.red, fontSize: 14, fontWeight: '600' },
});
