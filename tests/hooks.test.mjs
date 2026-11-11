import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'test-renderer';
import { loadProject } from './support/loadProject.mjs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('the displayed date updates at midnight and when Android returns to the foreground', async (t) => {
  const midnight = new Date(2026, 10, 10, 23, 59, 59, 500);
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: midnight });
  const remove = t.mock.fn();
  const addEventListener = t.mock.fn(() => ({ remove }));
  const { useToday } = loadProject('src/utils/useToday.ts', { 'react-native': { AppState: { addEventListener } } });
  function Clock() { return createElement('Text', null, useToday()); }

  const root = createRoot();
  try {
    await act(async () => root.render(createElement(Clock)));
    const currentDate = () => root.container.children[0].children[0];
    assert.equal(currentDate(), '2026-11-10');
    await act(async () => t.mock.timers.tick(500));
    assert.equal(currentDate(), '2026-11-11');
    const [, onState] = addEventListener.mock.calls[0].arguments;
    t.mock.timers.setTime(new Date(2026, 10, 14, 10).getTime());
    await act(async () => onState('background'));
    assert.equal(currentDate(), '2026-11-11');
    await act(async () => onState('active'));
    assert.equal(currentDate(), '2026-11-14');
  } finally {
    await act(async () => root.unmount());
  }
  assert.equal(remove.mock.callCount(), 1);
});

test('a focused query ignores an older response after the requested item changes', async (t) => {
  const { useFocusedData } = loadProject('src/utils/useFocusedData.ts', {
    'expo-router': { useFocusEffect: (effect) => useEffect(effect, [effect]) },
  });
  let finishOld;
  const oldQuery = t.mock.fn(() => new Promise((resolve) => { finishOld = resolve; }));
  const newQuery = t.mock.fn(async () => 'new item');
  function Screen({ load }) {
    const { result } = useFocusedData(load);
    return createElement('Text', null, result.status === 'ready' ? result.data : result.status);
  }
  const root = createRoot();
  t.after(() => act(async () => root.unmount()));
  await act(async () => root.render(createElement(Screen, { load: oldQuery })));
  assert.equal(root.container.children[0].children[0], 'loading');
  await act(async () => root.render(createElement(Screen, { load: newQuery })));
  assert.equal(root.container.children[0].children[0], 'new item');
  await act(async () => finishOld('old item'));
  assert.equal(root.container.children[0].children[0], 'new item');
  assert.equal(oldQuery.mock.callCount(), 1);
  assert.equal(newQuery.mock.callCount(), 1);
});
