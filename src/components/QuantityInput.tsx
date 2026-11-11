import type { Dispatch, SetStateAction } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors } from '../theme/theme';
import { defaultQuantity, isValidQuantity, parseQuantity } from '../utils/quantity';
import { AppIcon } from './AppIcon';

export function QuantityInput({ value, onChange, label = 'Cantitate', maximum = Number.MAX_SAFE_INTEGER, disabled = false, invalid = false }: {
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
  label?: string;
  maximum?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const quantity = parseQuantity(value);
  const canDecrease = !disabled && quantity !== null && quantity > defaultQuantity && quantity <= maximum;
  const canIncrease = !disabled && (quantity === null || quantity < maximum);

  function step(delta: -1 | 1) {
    onChange((previous) => {
      const next = (parseQuantity(previous) ?? 0) + delta;
      return isValidQuantity(next) && next <= maximum ? String(next) : previous;
    });
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Scade: ${label}`}
        accessibilityState={{ disabled: !canDecrease }}
        disabled={!canDecrease}
        onPress={() => step(-1)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, !canDecrease && styles.disabled]}
      >
        <AppIcon name="minus" size={22} color={colors.green} />
      </Pressable>
      <TextInput
        accessibilityLabel={label}
        inputMode="numeric"
        editable={!disabled}
        selectTextOnFocus
        onChangeText={onChange}
        style={[styles.input, invalid && styles.invalid]}
        value={value}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mărește: ${label}`}
        accessibilityState={{ disabled: !canIncrease }}
        disabled={!canIncrease}
        onPress={() => step(1)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, !canIncrease && styles.disabled]}
      >
        <AppIcon name="plus" size={22} color={colors.green} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, minHeight: 52, textAlign: 'center', fontWeight: '700', color: colors.ink, fontSize: 16,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background,
    paddingHorizontal: 13, paddingVertical: 10,
  },
  button: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.greenSoft,
  },
  pressed: { borderColor: colors.green },
  disabled: { opacity: 0.45 },
  invalid: { borderColor: colors.red },
});
