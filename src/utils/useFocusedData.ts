import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

type Result<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

export function useFocusedData<T>(load: () => Promise<T>, keepDataOnRefresh = false) {
  const [result, setResult] = useState<Result<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(useCallback(() => {
    let focused = true;
    setResult((previous) => keepDataOnRefresh && previous.status === 'ready' ? previous : { status: 'loading' });
    load().then(
      (data) => { if (focused) setResult({ status: 'ready', data }); },
      (error: unknown) => { if (focused) setResult({ status: 'error', error }); },
    );
    return () => { focused = false; };
    // A retry changes the subscription key so the focused screen loads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, attempt, keepDataOnRefresh]));

  return { result, retry: () => setAttempt((previous) => previous + 1) };
}
