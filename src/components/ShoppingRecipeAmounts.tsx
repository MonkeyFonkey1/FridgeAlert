import { StyleSheet, Text } from 'react-native';
import { recipes } from '../data/recipes';
import type { ShoppingRecipeAmount } from '../models/shopping';
import { colors } from '../theme/theme';

export function ShoppingRecipeAmounts({ amounts }: { amounts: ShoppingRecipeAmount[] }) {
  return amounts.map(({ recipeId, amount }) => (
    <Text key={recipeId} style={styles.amount}>
      {recipes.find(({ id }) => id === recipeId)?.name ?? 'Rețetă'} · {amount}
    </Text>
  ));
}

const styles = StyleSheet.create({
  amount: { color: colors.muted, fontSize: 13 },
});
