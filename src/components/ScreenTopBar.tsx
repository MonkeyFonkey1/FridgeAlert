import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';
import { AppIcon } from './AppIcon';

export function ScreenTopBar({ title, onBack, disabled = false }: {
  title: string;
  onBack: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Înapoi"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <AppIcon name="arrow-left" size={24} color={colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.label}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  label: { color: colors.ink, fontSize: 17, fontWeight: '800', flexShrink: 1 },
});
