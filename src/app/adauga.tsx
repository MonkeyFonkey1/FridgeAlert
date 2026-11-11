import { useRouter } from 'expo-router';
import { FoodForm } from '../components/FoodForm';
import { syncReminders } from '../services/expirationNotifications';
import { addFood } from '../services/foodDatabase';

export default function AddFoodScreen() {
  const router = useRouter();
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/frigider');

  return (
    <FoodForm
      onBack={goBack}
      onSave={async (food) => {
        await addFood(food);
        await syncReminders();
        goBack();
      }}
    />
  );
}
