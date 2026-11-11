import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { getFoodById } from '../services/foodDatabase';
import { useFocusedData } from './useFocusedData';

export function useFood() {
  const { id: parameter } = useLocalSearchParams<{ id?: string }>();
  const id = typeof parameter === 'string' && /^[1-9]\d*$/.test(parameter) ? Number(parameter) : NaN;
  const load = useCallback(() => (
    Number.isSafeInteger(id) ? getFoodById(id) : Promise.resolve(null)
  ), [id]);
  return useFocusedData(load);
}
