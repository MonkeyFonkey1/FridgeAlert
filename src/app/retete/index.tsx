import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RecipeCard } from '../../components/RecipeCard';
import { ScreenLoading, ScreenMessage } from '../../components/ScreenMessage';
import { ScreenTopBar } from '../../components/ScreenTopBar';
import { recipes } from '../../data/recipes';
import { getActiveFoods } from '../../services/foodDatabase';
import { colors } from '../../theme/theme';
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
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Rețete" onBack={() => router.dismissTo('/')} />
      <SectionList
        sections={sections}
        keyExtractor={({ recipe }) => recipe.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.hero}>
              <View style={styles.icon}><AppIcon name="chef-hat" color={colors.greenDark} size={28} /></View>
              <Text accessibilityRole="header" style={styles.title}>Ce gătim astăzi?</Text>
              <Text style={styles.description}>Descoperă ce poți prepara cu alimentele din frigider.</Text>
            </View>
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
        renderItem={({ item }) => (
          <View style={styles.item}>
            <RecipeCard recommendation={item} onPress={() => router.navigate({ pathname: '/retete/[id]', params: { id: item.recipe.id } })} />
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
  content: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 24 },
  header: { gap: 10, marginBottom: 7 },
  hero: { padding: 20, gap: 8, borderRadius: 24, backgroundColor: '#DDEBDD' },
  icon: { alignSelf: 'flex-start', backgroundColor: colors.white, padding: 10, borderRadius: 14 },
  title: { color: colors.ink, fontSize: 29, letterSpacing: -0.6, fontWeight: '800' },
  description: { color: colors.greenDark, fontSize: 15, lineHeight: 22 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginVertical: 9 },
  item: { marginBottom: 8 },
});
