import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';
import type { RecipeRecommendation } from '../utils/recipeRecommendations';
import { AppIcon } from './AppIcon';

export function RecipeCard({ recommendation, onPress, compact = false }: {
  recommendation: RecipeRecommendation;
  onPress: () => void;
  compact?: boolean;
}) {
  const { recipe, availableCount, missing, expiringCount } = recommendation;

  return (
    <Pressable accessibilityRole="button" accessibilityHint="Deschide rețeta" onPress={onPress}
      style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed]}>
      <View style={styles.heading}>
        <View style={styles.icon}><AppIcon name="chef-hat" size={23} color={colors.greenDark} /></View>
        <View style={styles.titleBlock}>
          <Text style={styles.name}>{recipe.name}</Text>
          <Text style={styles.meta}>{recipe.minutes} min · {recipe.difficulty}</Text>
        </View>
        <AppIcon name="chevron-right" size={21} color={colors.green} />
      </View>
      {!compact && <Text style={styles.description}>{recipe.description}</Text>}
      <View style={styles.badges}>
        <Text style={[styles.badge, styles.available]}>Disponibile: {availableCount}</Text>
        <Text style={[styles.badge, missing.length ? styles.missing : styles.neutral]}>Lipsă: {missing.length}</Text>
        {expiringCount > 0 && (
          <View style={styles.priority}>
            <AppIcon name="clock-outline" size={14} color={colors.amber} />
            <Text style={styles.priorityText}>Folosește produse care expiră curând</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 15, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  compact: { padding: 12, gap: 8 },
  pressed: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0E3' },
  titleBlock: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: '700' },
  available: { color: colors.green, backgroundColor: colors.greenSoft },
  missing: { color: colors.red, backgroundColor: colors.redSoft },
  neutral: { color: colors.muted, backgroundColor: colors.background },
  priority: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.amberSoft },
  priorityText: { color: colors.amber, fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
