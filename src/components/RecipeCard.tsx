import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, editorialTitle } from '../theme/theme';
import type { RecipeRecommendation } from '../utils/recipeRecommendations';
import { AppIcon } from './AppIcon';
import { RecipePhoto } from './RecipePhoto';

export function RecipeCard({ recommendation, onPress, compact = false }: {
  recommendation: RecipeRecommendation;
  onPress: () => void;
  compact?: boolean;
}) {
  const { recipe, availableCount, missing, expiringCount } = recommendation;
  const scale = useSharedValue(1);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  function animate(value: number) {
    scale.set(withTiming(value, { duration: 135, reduceMotion: ReduceMotion.System }));
  }

  return (
    <Animated.View style={[styles.card, motion]}>
      <Pressable accessibilityRole="button" accessibilityHint="Deschide rețeta" onPress={onPress}
        onPressIn={() => animate(0.98)} onPressOut={() => animate(1)}
        style={({ pressed }) => [compact && styles.compact, pressed && styles.pressed]}>
        <View style={compact && styles.thumbnail}><RecipePhoto id={recipe.id} height={compact ? 126 : 200} /></View>
        <View style={[styles.body, compact && styles.compactBody]}>
          <Text style={[styles.name, compact && styles.compactName]}>{recipe.name}</Text>
          <Text style={styles.meta}>{recipe.minutes} min · {recipe.servings} {recipe.servings === 1 ? 'porție' : 'porții'}</Text>
          <Text style={[styles.availability, missing.length > 0 && styles.missing]}>
            {availableCount}/{availableCount + missing.length} ingrediente găsite
          </Text>
          {!compact && expiringCount > 0 && <Text style={styles.meta}>Include ingrediente care expiră curând</Text>}
        </View>
        {compact && <AppIcon name="chevron-right" size={19} color={colors.green} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, overflow: 'hidden' },
  compact: { flexDirection: 'row', alignItems: 'center', paddingRight: 9 },
  pressed: { backgroundColor: colors.greenSoft },
  thumbnail: { width: '30%', alignSelf: 'stretch', justifyContent: 'center', backgroundColor: colors.greenSoft, overflow: 'hidden' },
  body: { gap: 4, padding: 13 },
  compactBody: { flex: 1, minWidth: 0 },
  name: { ...editorialTitle, color: colors.ink, fontSize: 25 },
  compactName: { fontSize: 21 },
  meta: { color: colors.muted, fontSize: 13 },
  availability: { color: colors.greenDark, fontWeight: '700', fontSize: 13 },
  missing: { color: colors.amber },
});
