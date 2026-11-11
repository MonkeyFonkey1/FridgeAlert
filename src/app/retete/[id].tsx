import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { PrimaryButton } from '../../components/PrimaryButton';
import { QuantityInput } from '../../components/QuantityInput';
import { ScreenLoading, ScreenMessage } from '../../components/ScreenMessage';
import { ScreenTopBar } from '../../components/ScreenTopBar';
import { ingredients } from '../../data/ingredients';
import { recipes } from '../../data/recipes';
import { addRecipeShoppingItems, getActiveFoods } from '../../services/foodDatabase';
import { colors } from '../../theme/theme';
import { parseQuantity } from '../../utils/quantity';
import { formatRecipeAmount, maximumServings } from '../../utils/recipeAmount';
import { recommendRecipes, type IngredientMatch } from '../../utils/recipeRecommendations';
import { useFocusedData } from '../../utils/useFocusedData';
import { useToday } from '../../utils/useToday';

function IngredientRow({ ingredient, amount }: { ingredient: IngredientMatch; amount: string }) {
  const available = ingredient.availability === 'name-only';
  return (
    <View style={styles.ingredientRow}>
      <AppIcon name={available ? 'check-circle-outline' : 'minus-circle-outline'} size={23}
        color={available ? colors.green : colors.red} />
      <View style={styles.ingredientBody}>
        <Text style={styles.ingredientName}>{ingredients[ingredient.id].name} · {amount}</Text>
        <Text style={available ? styles.inStock : styles.missing}>{available ? 'Găsit după denumire' : 'Lipsește'}</Text>
        {ingredient.expiringSoon && <Text style={styles.expiring}>Expiră în maximum 3 zile</Text>}
      </View>
    </View>
  );
}

export default function RecipeDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = recipes.find((entry) => entry.id === id);
  const { result, retry } = useFocusedData(getActiveFoods);
  const today = useToday();
  const [servingsInput, setServingsInput] = useState(String(recipe?.servings ?? 1));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const pending = useRef(false);
  const recommendation = recipe && result.status === 'ready' ? recommendRecipes([recipe], result.data, today)[0] : undefined;
  const servings = parseQuantity(servingsInput);
  const validServings = servings !== null && servings <= maximumServings;
  const servingLabel = servings === 1 ? '1 porție' : `${servings} porții`;
  const formatAmount = (amount: IngredientMatch['amount']) =>
    formatRecipeAmount(amount, recipe?.servings, validServings ? servings : recipe?.servings);

  async function addIngredients(selection: IngredientMatch[]) {
    if (!recipe || !validServings || selection.length === 0 || pending.current) return;
    pending.current = true;
    setSaving(true);
    setFeedback(undefined);
    try {
      await addRecipeShoppingItems(recipe.id, selection.map(({ id, amount }) => ({
        name: ingredients[id].name,
        amount: formatAmount(amount),
      })));
      setFeedback(`Lista de cumpărături a fost actualizată pentru ${servingLabel}.`);
    } catch {
      setFeedback('Ingredientele nu au putut fi adăugate. Încearcă din nou.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Detalii rețetă" onBack={() => router.canGoBack() ? router.back() : router.replace('/retete')} />
      <ScrollView contentContainerStyle={styles.content}>
        {!recipe ? <ScreenMessage title="Rețeta nu a fost găsită" /> : (
          <>
            <View style={styles.hero}>
              <AppIcon name="chef-hat" color={colors.greenDark} size={30} />
              <Text accessibilityRole="header" style={styles.title}>{recipe.name}</Text>
              <Text style={styles.description}>{recipe.description}</Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}>{recipe.minutes} min</Text>
                <Text style={styles.metric}>{recipe.difficulty}</Text>
                {validServings && <Text style={styles.metric}>{servingLabel}</Text>}
              </View>
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Pentru câte persoane?</Text>
              <QuantityInput label="Număr de porții" value={servingsInput} onChange={(next) => {
                setServingsInput(next);
                setFeedback(undefined);
              }} maximum={maximumServings} disabled={saving} invalid={servingsInput !== '' && !validServings} />
              {!validServings && <Text style={styles.missing}>Alege între 1 și {maximumServings} de porții.</Text>}
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Ingrediente</Text>
              <Text style={styles.description}>Cantitățile sunt orientative. Bifa verde indică un nume găsit în inventar. Verifică ce cantitate ai și dacă alimentele au fost păstrate corespunzător.</Text>
              {result.status === 'error' ? <ScreenMessage title="Nu am putut verifica inventarul" onRetry={retry} /> :
                !recommendation ? <ScreenLoading /> : (
                  <>
                    <Text style={styles.groupTitle}>Obligatorii</Text>
                    {recommendation.required.map((ingredient) => <IngredientRow key={ingredient.id} ingredient={ingredient} amount={formatAmount(ingredient.amount)} />)}
                    {recommendation.optional.length > 0 && (
                      <>
                        <Text style={styles.groupTitle}>Opționale</Text>
                        {recommendation.optional.map((ingredient) => <IngredientRow key={ingredient.id} ingredient={ingredient} amount={formatAmount(ingredient.amount)} />)}
                      </>
                    )}
                    {recipe.water && <Text style={styles.description}>Apă pentru preparare · {formatAmount(recipe.water)}</Text>}
                    {recommendation.missing.length > 0 ? (
                      <PrimaryButton label="Adaugă ingredientele lipsă pe lista de cumpărături" icon="cart-plus"
                        onPress={() => addIngredients(recommendation.missing)} busy={saving} disabled={!validServings} />
                    ) : <Text style={styles.inStock}>Ai toate ingredientele obligatorii după denumire.</Text>}
                    {recommendation.availableCount > 0 && (
                      <PrimaryButton label="Adaugă toate ingredientele obligatorii" icon="cart-plus" variant="secondary"
                        onPress={() => addIngredients(recommendation.required)} disabled={saving || !validServings} />
                    )}
                    {feedback && <Text accessibilityLiveRegion="polite" style={styles.description}>{feedback}</Text>}
                  </>
                )}
              <PrimaryButton label="Vezi lista de cumpărături" icon="cart-outline" variant="secondary"
                disabled={saving} onPress={() => router.navigate('/cumparaturi')} />
            </View>

            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Mod de preparare</Text>
              {recipe.steps.map((step, index) => (
                <View style={styles.step} key={step}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 24, gap: 14 },
  hero: { backgroundColor: '#DDEBDD', padding: 20, borderRadius: 24, gap: 9 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  metric: { color: colors.greenDark, backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  groupTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginTop: 3 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 },
  ingredientBody: { flex: 1, gap: 3 },
  ingredientName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  inStock: { color: colors.green, fontSize: 13, fontWeight: '600' },
  missing: { color: colors.red, fontSize: 13 },
  expiring: { color: colors.amber, fontSize: 13 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 5 },
  stepNumber: { color: colors.greenDark, backgroundColor: colors.greenSoft, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '800' },
  stepText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
});
