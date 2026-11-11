import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/theme';
import { AppIcon, type IconName } from './AppIcon';

type Props = {
  label: string;
  icon: IconName;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function PrimaryButton({ label, icon, onPress, busy = false, disabled = false, variant = 'primary' }: Props) {
  const ink = variant === 'primary' ? colors.white : variant === 'danger' ? colors.red : colors.green;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && (variant === 'primary' ? styles.pressed : styles.faded),
        (disabled || busy) && styles.faded,
      ]}
    >
      {busy ? <ActivityIndicator color={ink} /> : <AppIcon name={icon} size={22} color={ink} />}
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primary: { backgroundColor: colors.green },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.redSoft },
  pressed: { backgroundColor: colors.greenDark },
  faded: { opacity: 0.65 },
  label: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
});
