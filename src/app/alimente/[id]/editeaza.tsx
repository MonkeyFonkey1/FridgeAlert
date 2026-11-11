import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodForm } from '../../../components/FoodForm';
import { ScreenLoading, ScreenMessage } from '../../../components/ScreenMessage';
import { ScreenTopBar } from '../../../components/ScreenTopBar';
import { syncReminders } from '../../../services/expirationNotifications';
import { updateFood } from '../../../services/foodDatabase';
import { colors } from '../../../theme/theme';
import { useFood } from '../../../utils/useFood';

export default function EditFoodScreen() {
  const router = useRouter();
  const { result, retry } = useFood();
  const food = result.status === 'ready' ? result.data : null;

  function goBack() {
    if (router.canGoBack()) router.back();
    else if (food) router.replace({ pathname: '/alimente/[id]', params: { id: String(food.id) } });
    else router.replace('/frigider');
  }

  if (food?.status === 'active') {
    return (
      <FoodForm
        key={food.id}
        initialValues={food}
        onBack={goBack}
        onSave={async (values) => {
          const updated = await updateFood(food.id, values);
          if (updated) {
            await syncReminders();
            goBack();
          }
          return updated;
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenTopBar title="Editează aliment" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {result.status === 'loading' ? <ScreenLoading /> : result.status === 'error' ? (
          <ScreenMessage title="Nu am putut încărca alimentul" onRetry={retry} />
        ) : food ? (
          <ScreenMessage title="Alimentul este în istoric" description="Poți edita alimentele active din frigider." />
        ) : (
          <ScreenMessage title="Alimentul nu mai există" description="Revino la listă pentru a vedea alimentele disponibile." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingVertical: 16 },
});
