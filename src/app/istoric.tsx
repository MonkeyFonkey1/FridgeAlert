import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodCard } from '../components/FoodCard';
import { ScreenLoading, ScreenMessage } from '../components/ScreenMessage';
import { ScreenTopBar } from '../components/ScreenTopBar';
import { getHistoryFoods } from '../services/foodDatabase';
import { colors } from '../theme/theme';
import { useFocusedData } from '../utils/useFocusedData';

export default function HistoryScreen() {
  const router = useRouter();
  const { result, retry } = useFocusedData(getHistoryFoods);
  const foods = result.status === 'ready' ? result.data : [];
  const sections = [
    { key: 'consumed', title: 'Consumate', data: foods.filter((food) => food.status === 'consumed') },
    { key: 'discarded', title: 'Aruncate', data: foods.filter((food) => food.status === 'discarded') },
  ].filter(({ data }) => data.length > 0);

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Istoric" onBack={() => router.dismissTo('/')} />
      <SectionList
        sections={sections}
        keyExtractor={(food) => String(food.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Text style={styles.description}>Alimentele pe care le-ai marcat ca fiind consumate sau aruncate.</Text>}
        renderSectionHeader={({ section }) => (
          <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <FoodCard
              food={item}
              onPress={() => router.navigate({ pathname: '/alimente/[id]', params: { id: String(item.id) } })}
            />
          </View>
        )}
        ListEmptyComponent={
          result.status === 'loading' ? <ScreenLoading /> : result.status === 'error' ? (
            <ScreenMessage title="Nu am putut încărca istoricul" onRetry={retry} />
          ) : (
            <ScreenMessage
              title="Istoricul este gol"
              description="Aici vor apărea alimentele pe care le consumi sau le arunci."
              icon="history"
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  description: { color: colors.muted, fontSize: 15, marginBottom: 16 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 8, marginBottom: 9 },
  item: { marginBottom: 8 },
});
