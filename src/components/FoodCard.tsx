import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Food, FoodCategory } from '../models/food';
import { colors } from '../theme/theme';
import { displayDate } from '../utils/expiration';
import { AppIcon, type IconName } from './AppIcon';
import { ExpirationBadge, FoodStatusBadge } from './FoodBadges';

const categoryIcons: Record<FoodCategory, IconName> = {
  Lactate: 'cheese',
  Carne: 'food-drumstick-outline',
  Legume: 'carrot',
  Fructe: 'food-apple-outline',
  Băuturi: 'cup-water',
  Altele: 'food-outline',
};

export function FoodCard({ food, today, onPress }: { food: Food; today?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Deschide detaliile alimentului"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}><AppIcon name={categoryIcons[food.category]} color={colors.green} size={21} /></View>
      <View style={styles.details}>
        <Text style={styles.name}>{food.name} <Text style={styles.quantity}>· {food.quantity} buc.</Text></Text>
        <Text style={styles.meta}>{food.category} · {displayDate(food.expirationDate)}</Text>
        <View style={styles.badge}>
          {food.status === 'active' && today
            ? <ExpirationBadge expirationDate={food.expirationDate} today={today} />
            : <FoodStatusBadge status={food.status} />}
        </View>
      </View>
      <AppIcon name="chevron-right" color={colors.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.greenSoft },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: 4 },
  name: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  quantity: { color: colors.green, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 14 },
  badge: { marginTop: 3 },
});
