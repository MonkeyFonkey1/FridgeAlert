import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { ExpirationBadge } from '../../components/FoodBadges';
import { PrimaryButton } from '../../components/PrimaryButton';
import { RecipeCard } from '../../components/RecipeCard';
import { ScreenLoading, ScreenMessage } from '../../components/ScreenMessage';
import { recipes } from '../../data/recipes';
import { getActiveFoods } from '../../services/foodDatabase';
import { colors, editorialTitle } from '../../theme/theme';
import { inventoryOverview } from '../../utils/inventory';
import { recommendRecipes } from '../../utils/recipeRecommendations';
import { useFocusedData } from '../../utils/useFocusedData';
import { useToday } from '../../utils/useToday';

const heroPhoto = require('../../../assets/food/hero.webp');
const entrance = FadeInUp.duration(260).reduceMotion(ReduceMotion.System);
const noFoods: Awaited<ReturnType<typeof getActiveFoods>> = [];

export default function HomeScreen() {
  const router = useRouter();
  const today = useToday();
  const { result, retry } = useFocusedData(getActiveFoods);
  const foods = result.status === 'ready' ? result.data : noFoods;
  const overview = useMemo(() => inventoryOverview(foods, today), [foods, today]);
  const featured = useMemo(() => foods.length ? recommendRecipes(recipes, foods, today)[0] : undefined, [foods, today]);

  const missingSQLite = result.status === 'error' && result.error instanceof Error
    && result.error.message.includes("Cannot find native module 'ExpoSQLite'");

  const headline = overview.soon
    ? overview.soon === 1 ? 'Un aliment expiră curând' : `${overview.soon}${overview.soon >= 20 ? ' de' : ''} alimente expiră curând`
    : overview.expired ? 'Ai alimente expirate'
    : foods.length ? 'Nimic nu expiră curând' : 'Frigiderul tău e gol';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={entrance} style={styles.main}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.brand}>FridgeAlert</Text>
              <Text accessibilityRole="header" style={styles.title}>Bună!</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Setări notificări"
              onPress={() => router.navigate('/setari')} style={({ pressed }) => [styles.settings, pressed && styles.pressed]}>
              <AppIcon name="cog-outline" size={23} color={colors.greenDark} />
            </Pressable>
          </View>

          {result.status === 'error' && <ScreenMessage
            title={missingSQLite ? 'SQLite lipsește din aplicația Android' : 'Nu am putut încărca produsele'}
            description={missingSQLite ? 'Deschide proiectul în versiunea Expo Go pentru SDK 58 sau într-un build Android care include expo-sqlite.' : undefined}
            onRetry={retry}
          />}
          {result.status === 'loading' && <ScreenLoading />}
          {result.status === 'ready' && (
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text accessibilityRole="header" style={styles.heroTitle}>{headline}</Text>
                <Text style={styles.heroText}>
                  {overview.soon ? 'În cel mult 3 zile.' : overview.expired ? 'Verifică datele în frigider.' : foods.length ? 'Produsele în termen au cel puțin 4 zile rămase.' : 'Adaugă primul aliment ca să îi urmărești termenul.'}
                </Text>
              </View>
              <View style={styles.heroPhoto}>
                <Image accessible={false} source={heroPhoto} resizeMode="cover" style={styles.heroImage} />
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <PrimaryButton label="Adaugă aliment" icon="plus" onPress={() => router.navigate('/adauga')} />
            <PrimaryButton label="Statistici" icon="chart-bar" variant="secondary" onPress={() => router.navigate('/statistici')} />
          </View>

          {result.status === 'ready' && (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>Consumă prioritar</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Vezi toate" onPress={() => router.navigate('/frigider')} style={styles.link}>
                    <Text style={styles.linkText}>Vezi toate</Text>
                    <AppIcon name="arrow-right" size={17} color={colors.greenDark} />
                  </Pressable>
                </View>
                {overview.priority.length ? overview.priority.map(({ food }) => (
                  <Pressable key={food.id} accessibilityRole="button"
                    onPress={() => router.navigate({ pathname: '/alimente/[id]', params: { id: String(food.id) } })}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <View style={styles.rowText}>
                      <Text style={styles.food}>{food.name}</Text>
                      <Text style={styles.quantity}>{food.quantity} buc.</Text>
                    </View>
                    <ExpirationBadge expirationDate={food.expirationDate} today={today} />
                  </Pressable>
                )) : <Text style={styles.muted}>Niciun aliment în termen pentru această listă.</Text>}
              </View>

              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Ce gătim astăzi?</Text>
                {featured ? <RecipeCard compact recommendation={featured}
                  onPress={() => router.navigate({ pathname: '/retete/[id]', params: { id: featured.recipe.id } })} /> :
                  <PrimaryButton label="Explorează rețetele" icon="book-open-outline" variant="secondary" onPress={() => router.navigate('/retete')} />}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  main: { gap: 18, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heading: { flexShrink: 1 },
  brand: { color: colors.greenDark, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  title: { ...editorialTitle, color: colors.ink, fontSize: 47 },
  settings: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.greenSoft },
  hero: { flexDirection: 'row', minHeight: 150, borderRadius: 23, overflow: 'hidden', backgroundColor: colors.greenDark },
  heroCopy: { flex: 1, justifyContent: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 17 },
  heroTitle: { ...editorialTitle, color: colors.white, fontSize: 25 },
  heroText: { color: '#E5F1E2', fontSize: 13 },
  heroPhoto: { width: '35%', alignSelf: 'stretch' },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { ...editorialTitle, color: colors.ink, fontSize: 24, flexShrink: 1 },
  link: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { color: colors.greenDark, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { flex: 1 },
  food: { fontSize: 15, fontWeight: '700', color: colors.ink },
  quantity: { fontSize: 13, color: colors.muted },
  muted: { color: colors.muted, fontSize: 14 },
});
