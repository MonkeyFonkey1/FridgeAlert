import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon, type IconName } from '../components/AppIcon';
import { ExpirationBadge } from '../components/FoodBadges';
import { FoodCard } from '../components/FoodCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { RecipeCard } from '../components/RecipeCard';
import { ScreenLoading, ScreenMessage } from '../components/ScreenMessage';
import { recipes } from '../data/recipes';
import { categories, type Food } from '../models/food';
import { getActiveFoods } from '../services/foodDatabase';
import { colors } from '../theme/theme';
import { dateForPicker } from '../utils/expiration';
import { defaultInventoryFilters, filterInventory, inventoryOverview, type ExpirationFilter, type InventoryFilters } from '../utils/inventory';
import { recommendRecipes } from '../utils/recipeRecommendations';
import { useToday } from '../utils/useToday';

const expirationOptions: { value: ExpirationFilter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'soon', label: 'În max. 3 zile' },
  { value: 'later', label: 'Peste 3 zile' },
  { value: 'expired', label: 'Expirate' },
];
const localDateFormat = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
const metricTones = {
  green: { ink: colors.green, background: colors.greenSoft },
  amber: { ink: colors.amber, background: colors.amberSoft },
  red: { ink: colors.red, background: colors.redSoft },
};

function Metric({ icon, count, label, tone }: {
  icon: IconName;
  count: number | undefined;
  label: string;
  tone: keyof typeof metricTones;
}) {
  const palette = metricTones[tone];
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}, ${count ?? 'se încarcă'}`}>
      <View style={[styles.metricIcon, { backgroundColor: palette.background }]}>
        <AppIcon name={icon} size={19} color={palette.ink} />
      </View>
      <Text style={styles.metricNumber}>{count ?? '–'}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
      style={({ pressed }) => [styles.choice, (selected || pressed) && styles.choiceSelected]}>
      <Text style={styles.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

function greeting(loaded: boolean, active: number, soon: number, expired: number) {
  if (!loaded) return 'Bună! Ce ai în frigider?';
  if (!active) return 'Bună! Frigiderul tău e gol.';
  if (soon === 1) return 'Bună! Ai un produs care expiră curând.';
  if (soon > 1) {
    const connector = soon % 100 >= 20 || soon % 100 === 0 ? ' de' : '';
    return `Bună! Ai ${soon}${connector} produse care expiră curând.`;
  }
  if (expired > 0) return 'Bună! Verifică produsele expirate.';
  return 'Bună! Produsele tale sunt în termen.';
}

export default function HomeScreen() {
  const router = useRouter();
  const today = useToday();
  const [foods, setFoods] = useState<Food[]>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState(defaultInventoryFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    let focused = true;
    setLoadError(false);
    getActiveFoods().then(
      (data) => { if (focused) setFoods(data); },
      () => {
        if (focused) {
          setFoods(undefined);
          setLoadError(true);
        }
      },
    );
    return () => { focused = false; };
  }, [attempt]));

  const overview = useMemo(() => inventoryOverview(foods ?? [], today), [foods, today]);
  const visible = useMemo(() => filterInventory(overview.entries, filters), [overview, filters]);
  const suggestedRecipes = useMemo(() => foods?.length ? recommendRecipes(recipes, foods, today).slice(0, 2) : [], [foods, today]);
  const changedFilters = Number(filters.category !== 'all') + Number(filters.expiration !== 'all') + Number(filters.order !== 'asc');
  const hasSearch = filters.query.trim() !== '';
  const updateFilters = (changes: Partial<InventoryFilters>) => setFilters((current) => ({ ...current, ...changes }));
  const openFood = (food: Food) => router.navigate({ pathname: '/alimente/[id]', params: { id: String(food.id) } });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.brandIcon}><AppIcon name="fridge-outline" size={24} color={colors.greenDark} /></View>
        <Text accessibilityRole="header" style={styles.brandName}>FridgeAlert</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Istoric" onPress={() => router.navigate('/istoric')}
          style={({ pressed }) => [styles.topAction, pressed && styles.choiceSelected]}>
          <AppIcon name="history" size={23} color={colors.greenDark} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Setări notificări" onPress={() => router.navigate('/setari')}
          style={({ pressed }) => [styles.topAction, pressed && styles.choiceSelected]}>
          <AppIcon name="cog-outline" size={23} color={colors.greenDark} />
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={({ food }) => String(food.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.halo} pointerEvents="none" />
              <View style={styles.heroTop}>
                <View style={styles.heroCaption}>
                  <Text style={styles.eyebrow}>FRIGIDERUL MEU</Text>
                  <Text style={styles.date}>{localDateFormat.format(dateForPicker(today))}</Text>
                </View>
                <View style={styles.heroIcon}><AppIcon name="leaf" size={25} color="#DBEFCE" /></View>
              </View>
              <Text accessibilityRole="header" style={styles.greeting}>{greeting(Boolean(foods), overview.entries.length, overview.soon, overview.expired)}</Text>
              <Text style={styles.heroNote}>{foods ? `${overview.totalQuantity} buc. sau ambalaje în stoc` : 'Inventarul tău, într-un singur loc'}</Text>
            </View>

            <View style={styles.metrics}>
              <Metric icon="basket-outline" count={foods?.length} label="Produse active" tone="green" />
              <Metric icon="clock-outline" count={foods ? overview.soon : undefined} label="În max. 3 zile" tone="amber" />
              <Metric icon="alert-circle-outline" count={foods ? overview.expired : undefined} label="Produse expirate" tone="red" />
            </View>

            <PrimaryButton label="Statistici" icon="chart-bar" variant="secondary" onPress={() => router.navigate('/statistici')} />

            {foods && foods.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text accessibilityRole="header" style={styles.sectionTitle}>Consumă prioritar</Text>
                  <Text style={styles.sectionNote}>Cele mai apropiate de expirare</Text>
                </View>
                {overview.priority.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priorityRow}>
                    {overview.priority.map(({ food }) => (
                      <Pressable key={food.id} accessibilityRole="button" onPress={() => openFood(food)}
                        style={({ pressed }) => [styles.priorityCard, pressed && styles.choiceSelected]}>
                        <View style={styles.priorityMeta}>
                          <Text style={styles.priorityCategory}>{food.category}</Text>
                          <AppIcon name="chevron-right" size={18} color={colors.green} />
                        </View>
                        <Text style={styles.priorityName} numberOfLines={2}>{food.name}</Text>
                        <Text style={styles.sectionNote}>{food.quantity} buc.</Text>
                        <ExpirationBadge expirationDate={food.expirationDate} today={today} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : <Text style={styles.sectionNote}>Produsele expirate sunt în lista de mai jos.</Text>}
              </View>
            )}

            {foods && (
              <View style={styles.section}>
                <View style={styles.inventoryHeading}>
                  <View style={styles.recipeHeading}>
                    <Text style={styles.recipeEyebrow}>REȚETE</Text>
                    <Text accessibilityRole="header" style={styles.sectionTitle}>Ce poți găti astăzi?</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Lista de cumpărături"
                    onPress={() => router.navigate('/cumparaturi')}
                    style={({ pressed }) => [styles.topAction, pressed && styles.choiceSelected]}>
                    <AppIcon name="cart-outline" size={22} color={colors.greenDark} />
                  </Pressable>
                </View>
                {suggestedRecipes.length > 0 ? (
                  <>
                    <Text style={styles.sectionNote}>Ingrediente obligatorii potrivite după denumire.</Text>
                    {suggestedRecipes.map((entry) => (
                      <RecipeCard key={entry.recipe.id} recommendation={entry} compact
                        onPress={() => router.navigate({ pathname: '/retete/[id]', params: { id: entry.recipe.id } })} />
                    ))}
                  </>
                ) : (
                  <Text style={styles.sectionNote}>Frigiderul e gol. Adaugă câteva alimente pentru a primi idei de rețete potrivite.</Text>
                )}
                <PrimaryButton label="Vezi toate rețetele" icon="chef-hat" variant="secondary" onPress={() => router.navigate('/retete')} />
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.inventoryHeading}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Toate produsele</Text>
                {foods && <Text style={styles.resultCount}>{visible.length} din {foods.length}</Text>}
              </View>
              <View style={styles.search}>
                <AppIcon name="magnify" size={22} color={colors.muted} />
                <TextInput accessibilityLabel="Caută după numele alimentului" placeholder="Caută un aliment"
                  placeholderTextColor={colors.muted} autoCapitalize="none" returnKeyType="search" value={filters.query}
                  onChangeText={(query) => updateFilters({ query })} style={styles.searchInput} />
                {filters.query !== '' && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Șterge căutarea" onPress={() => updateFilters({ query: '' })}
                    style={styles.clear}><AppIcon name="close" size={18} color={colors.muted} /></Pressable>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)}
                style={({ pressed }) => [styles.filterButton, pressed && styles.choiceSelected]}>
                <AppIcon name="tune-variant" size={19} color={colors.green} />
                <Text style={styles.filterButtonLabel}>Filtre și sortare{changedFilters ? ` (${changedFilters})` : ''}</Text>
                <AppIcon name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={19} color={colors.green} />
              </Pressable>
              {filtersOpen && (
                <View style={styles.filterPanel}>
                  <Text style={styles.filterTitle}>Categorie</Text>
                  <View style={styles.choices}>
                    <Choice label="Toate categoriile" selected={filters.category === 'all'} onPress={() => updateFilters({ category: 'all' })} />
                    {categories.map((category) => <Choice key={category} label={category} selected={filters.category === category}
                      onPress={() => updateFilters({ category })} />)}
                  </View>
                  <Text style={styles.filterTitle}>Starea expirării</Text>
                  <View style={styles.choices}>
                    {expirationOptions.map(({ value, label }) => <Choice key={value} label={label} selected={filters.expiration === value}
                      onPress={() => updateFilters({ expiration: value })} />)}
                  </View>
                  <Text style={styles.filterTitle}>Data expirării</Text>
                  <View style={styles.choices}>
                    <Choice label="Dată crescătoare" selected={filters.order === 'asc'} onPress={() => updateFilters({ order: 'asc' })} />
                    <Choice label="Dată descrescătoare" selected={filters.order === 'desc'} onPress={() => updateFilters({ order: 'desc' })} />
                  </View>
                  {changedFilters > 0 && (
                    <Pressable accessibilityRole="button" onPress={() => setFilters({ ...defaultInventoryFilters, query: filters.query })}
                      style={styles.reset}>
                      <Text style={styles.filterButtonLabel}>Resetează filtrele și sortarea</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.item}><FoodCard food={item.food} today={today} onPress={() => openFood(item.food)} /></View>
        )}
        ListEmptyComponent={
          loadError ? <ScreenMessage title="Nu am putut încărca produsele" onRetry={() => setAttempt((value) => value + 1)} /> :
            !foods ? <ScreenLoading /> :
              foods.length > 0 && (hasSearch || changedFilters > 0)
                ? <ScreenMessage title="Niciun rezultat" description="Încearcă alt nume sau modifică filtrele." icon="magnify" />
                : <ScreenMessage title="Frigiderul tău e gol" description="Adaugă primul aliment ca să îi urmărești data de expirare." icon="basket-outline" />
        }
      />

      <View style={styles.footer}>
        <View style={styles.addAction}>
          <PrimaryButton label="Adaugă aliment" icon="plus" onPress={() => router.navigate('/adauga')} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.navigate('/retete')}
          style={({ pressed }) => [styles.recipesAction, pressed && styles.choiceSelected]}>
          <AppIcon name="chef-hat" size={21} color={colors.greenDark} />
          <Text style={styles.recipesActionLabel}>Rețete</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F1' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 9, gap: 8 },
  brandIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DAE8D7' },
  brandName: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginLeft: 3 },
  topAction: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 7, paddingBottom: 20 },
  hero: { overflow: 'hidden', padding: 20, gap: 13, backgroundColor: '#284C3A', borderRadius: 26 },
  halo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 20, borderColor: '#FFFFFF0D', top: -78, right: -46 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroCaption: { flex: 1, gap: 4 },
  eyebrow: { color: '#D9EDCE', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  date: { color: '#D3E4D4', fontSize: 13 },
  heroIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF1A' },
  greeting: { color: colors.white, fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.7 },
  heroNote: { color: '#D7ECD5', fontSize: 14, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metric: { flex: 1, minWidth: 0, padding: 10, gap: 5, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  metricIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricNumber: { color: colors.ink, fontSize: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  section: { marginTop: 22, marginBottom: 11, gap: 9 },
  sectionHeading: { gap: 2 },
  recipeHeading: { flex: 1, gap: 3 },
  recipeEyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  sectionNote: { color: colors.muted, fontSize: 13 },
  priorityRow: { gap: 8, paddingRight: 6 },
  priorityCard: { width: 165, padding: 12, gap: 5, borderRadius: 17, borderWidth: 1, borderColor: '#D7E6D7', backgroundColor: '#EBF3E9' },
  priorityMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  priorityCategory: { flexShrink: 1, color: colors.greenDark, fontSize: 11, fontWeight: '700' },
  priorityName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  inventoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  resultCount: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  search: { minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  searchInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 15, paddingVertical: 10 },
  clear: { minWidth: 36, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  filterButtonLabel: { flex: 1, color: colors.greenDark, fontSize: 14, fontWeight: '700' },
  filterPanel: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, gap: 8 },
  filterTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  choice: { justifyContent: 'center', minHeight: 42, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  choiceSelected: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  choiceLabel: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  reset: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 4, paddingVertical: 10 },
  item: { marginBottom: 8 },
  footer: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F4F7F1' },
  addAction: { flex: 1 },
  recipesAction: { maxWidth: '40%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  recipesActionLabel: { color: colors.greenDark, fontWeight: '800', fontSize: 14, flexShrink: 1 },
});
