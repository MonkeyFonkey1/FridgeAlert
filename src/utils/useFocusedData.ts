import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

type Result<T> =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; data: T };

export function useFocusedData<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<Result<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let focused = true;
    setResult({ status: 'loading' });
    load().then(
      (data) => { if (focused) setResult({ status: 'ready', data }); },
      () => { if (focused) setResult({ status: 'error' }); },
    );
    return () => { focused = false; };
  }, [load, attempt]));

  return { result, retry: () => setAttempt((previous) => previous + 1) };
}
