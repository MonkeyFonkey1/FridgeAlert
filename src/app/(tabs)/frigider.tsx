import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { FoodCard } from '../../components/FoodCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenLoading, ScreenMessage } from '../../components/ScreenMessage';
import { categories } from '../../models/food';
import { getActiveFoods } from '../../services/foodDatabase';
import { colors, editorialTitle } from '../../theme/theme';
import { defaultInventoryFilters, filterInventory, inventoryOverview, type ExpirationFilter, type InventoryFilters } from '../../utils/inventory';
import { useFocusedData } from '../../utils/useFocusedData';
import { useToday } from '../../utils/useToday';

const expirationOptions: { value: ExpirationFilter; label: string }[] = [
  { value: 'all', label: 'Toate' },
  { value: 'soon', label: 'În max. 3 zile' },
  { value: 'later', label: 'Peste 3 zile' },
  { value: 'expired', label: 'Expirate' },
];
const noFoods: Awaited<ReturnType<typeof getActiveFoods>> = [];

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
      style={({ pressed }) => [styles.choice, (selected || pressed) && styles.choiceSelected]}>
      <Text style={styles.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

export default function FridgeScreen() {
  const router = useRouter();
  const today = useToday();
  const { result, retry } = useFocusedData(getActiveFoods);
  const foods = result.status === 'ready' ? result.data : noFoods;
  const [filters, setFilters] = useState(defaultInventoryFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const overview = useMemo(() => inventoryOverview(foods, today), [foods, today]);
  const visible = useMemo(() => filterInventory(overview.entries, filters), [overview, filters]);
  const changedFilters = Number(filters.category !== 'all') + Number(filters.expiration !== 'all') + Number(filters.order !== 'asc');
  const updateFilters = (changes: Partial<InventoryFilters>) => setFilters((current) => ({ ...current, ...changes }));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={visible}
        keyExtractor={({ food }) => String(food.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <View style={styles.titleBlock}>
                <Text accessibilityRole="header" style={styles.title}>Frigider</Text>
                {result.status === 'ready' && <Text style={styles.note}>{foods.length} produse active · {overview.totalQuantity} buc. sau ambalaje</Text>}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Istoric" onPress={() => router.navigate('/istoric')}
                style={({ pressed }) => [styles.history, pressed && styles.choiceSelected]}>
                <AppIcon name="history" size={22} color={colors.greenDark} />
              </Pressable>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.categories}>
              <Choice label="Toate categoriile" selected={filters.category === 'all'} onPress={() => updateFilters({ category: 'all' })} />
              {categories.map((category) => <Choice key={category} label={category} selected={filters.category === category}
                onPress={() => updateFilters({ category })} />)}
            </ScrollView>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)}
              style={({ pressed }) => [styles.filterButton, pressed && styles.choiceSelected]}>
              <AppIcon name="tune-variant" size={19} color={colors.green} />
              <Text style={styles.filterButtonLabel}>Filtre și sortare{changedFilters ? ` (${changedFilters})` : ''}</Text>
              <AppIcon name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={19} color={colors.green} />
            </Pressable>
            {filtersOpen && (
              <View style={styles.filterPanel}>
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
            {result.status === 'ready' && foods.length > 0 && <Text style={styles.note}>{visible.length} din {foods.length} produse</Text>}
          </View>
        }
        renderItem={({ item: { food } }) => (
          <FoodCard food={food} today={today} onPress={() => router.navigate({ pathname: '/alimente/[id]', params: { id: String(food.id) } })} />
        )}
        ListEmptyComponent={result.status === 'error' ? (
          <ScreenMessage title="Nu am putut încărca produsele" onRetry={retry} />
        ) : result.status === 'loading' ? <ScreenLoading /> : foods.length > 0 ? (
          <ScreenMessage title="Niciun rezultat" description="Încearcă alt nume sau modifică filtrele." icon="magnify" />
        ) : (
          <ScreenMessage title="Frigiderul tău e gol" description="Adaugă primul aliment ca să îi urmărești data de expirare." icon="basket-outline" />
        )}
      />
      <View style={styles.footer}>
        <PrimaryButton label="Adaugă aliment" icon="plus" onPress={() => router.navigate('/adauga')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  header: { gap: 10, paddingBottom: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleBlock: { flex: 1, gap: 4 },
  title: { ...editorialTitle, color: colors.ink, fontSize: 39 },
  note: { color: colors.muted, fontSize: 13 },
  history: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  searchInput: { flex: 1, minHeight: 49, fontSize: 16, color: colors.ink },
  clear: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  categories: { gap: 7 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, alignSelf: 'flex-start', paddingHorizontal: 8, borderRadius: 12 },
  filterButtonLabel: { color: colors.greenDark, fontSize: 14, fontWeight: '700' },
  filterPanel: { backgroundColor: colors.white, padding: 12, borderRadius: 15, gap: 8 },
  filterTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { paddingHorizontal: 11, paddingVertical: 6, minHeight: 44, justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  choiceSelected: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  choiceLabel: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  reset: { minHeight: 44, justifyContent: 'center' },
  footer: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8 },
});
