import { useRouter } from 'expo-router';
import { FoodForm } from '../components/FoodForm';
import { syncReminders } from '../services/expirationNotifications';
import { addFood } from '../services/foodDatabase';

export default function AddFoodScreen() {
  const router = useRouter();
  const goHome = () => router.dismissTo('/');

  return (
    <FoodForm
      onBack={goHome}
      onSave={async (food) => {
        await addFood(food);
        await syncReminders();
        goHome();
      }}
    />
  );
}
