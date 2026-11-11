import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RecipeCard } from '../../components/RecipeCard';
import { ScreenLoading, ScreenMessage } from '../../components/ScreenMessage';
import { recipes } from '../../data/recipes';
import { getActiveFoods } from '../../services/foodDatabase';
import { colors, editorialTitle } from '../../theme/theme';
import { recipeGroups, recommendRecipes } from '../../utils/recipeRecommendations';
import { useFocusedData } from '../../utils/useFocusedData';
import { useToday } from '../../utils/useToday';

export default function RecipesScreen() {
  const router = useRouter();
  const { result, retry } = useFocusedData(getActiveFoods);
  const today = useToday();
  const foods = result.status === 'ready' ? result.data : undefined;
  const sections = useMemo(() => {
    const recommendations = foods ? recommendRecipes(recipes, foods, today) : [];
    return recipeGroups.map((group) => ({
      key: group.id,
      title: group.title,
      data: recommendations.filter((entry) => entry.group === group.id),
    })).filter(({ data }) => data.length > 0);
  }, [foods, today]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={({ recipe }) => recipe.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Rețete</Text>
            <Text style={styles.description}>Idei de gătit cu ce ai deja în frigider.</Text>
            <PrimaryButton label="Lista de cumpărături" icon="cart-outline" variant="secondary" onPress={() => router.navigate('/cumparaturi')} />
            {foods && foods.length === 0 && <Text style={styles.note}>Adaugă alimente în frigider pentru sugestii potrivite stocului tău.</Text>}
            {foods && (
              <Text style={styles.note}>Cardurile numără ingredientele obligatorii găsite după denumire. Verifică și cantitățile din rețetă.</Text>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item, index }) => (
          <View style={styles.item}>
            <RecipeCard compact={index > 0} recommendation={item} onPress={() => router.navigate({ pathname: '/retete/[id]', params: { id: item.recipe.id } })} />
          </View>
        )}
        ListEmptyComponent={result.status === 'error' ? (
          <ScreenMessage title="Nu am putut verifica inventarul" onRetry={retry} />
        ) : <ScreenLoading />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  header: { gap: 10, marginBottom: 7 },
  title: { ...editorialTitle, color: colors.ink, fontSize: 39 },
  description: { color: colors.greenDark, fontSize: 15, lineHeight: 22 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { ...editorialTitle, color: colors.ink, fontSize: 25, marginTop: 16, marginBottom: 9 },
  item: { marginBottom: 12 },
});
