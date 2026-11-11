import assert from 'node:assert/strict';
import { act, createElement as element, Fragment, useEffect } from 'react';
import { createRoot } from 'test-renderer';
import { loadProject } from './loadProject.mjs';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const part = (value) => typeof value === 'function' ? element(value) : value;
function FlatList({ data, keyExtractor, renderItem, ListHeaderComponent, ListEmptyComponent }) {
  return element('FlatList', null, part(ListHeaderComponent),
    data.length ? data.map((item, index) => element(Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index }))) :
      part(ListEmptyComponent));
}
function SectionList({ sections, keyExtractor, renderSectionHeader, renderItem, ListHeaderComponent, ListEmptyComponent }) {
  return element('SectionList', null, part(ListHeaderComponent),
    sections.length ? sections.map((section) => element(Fragment, { key: section.key }, renderSectionHeader({ section }),
      section.data.map((item, index) => element(Fragment, { key: keyExtractor(item, index) }, renderItem({ item, index, section }))))) :
      part(ListEmptyComponent));
}

export async function renderScreen(t, path, { data = {}, params = {}, mocks = {}, dev = false, props = {}, canGoBack = true, reduceMotion = false } = {}) {
  const router = { navigate: t.mock.fn(), dismissTo: t.mock.fn(), replace: t.mock.fn(), back: t.mock.fn(), canGoBack: () => canGoBack };
  const datePicker = { open: t.mock.fn() };
  const alert = { alert: t.mock.fn() };
  const backHandler = { addEventListener: t.mock.fn(() => ({ remove() {} })) };
  const appState = { addEventListener: t.mock.fn(() => ({ remove() {} })) };
  const database = {
    getActiveFoods: async () => [], getHistoryFoods: async () => [], getFoodById: async () => null,
    getShoppingItems: async () => [], getReminderPreferences: async () => ({ enabled: false, daysBefore: 1 }),
    ...data,
  };
  const reminders = {
    configureNotificationPresentation: t.mock.fn(),
    syncReminders: t.mock.fn(async () => ({ state: 'disabled' })),
    testReminder: t.mock.fn(async () => 'sent'),
  };
  const haptics = { AndroidHaptics: { Confirm: 'confirm' }, performAndroidHapticsAsync: t.mock.fn(async () => {}) };
  const animation = { duration: () => animation, reduceMotion: () => animation };
  const Stack = Object.assign(({ children }) => element('Stack', null, children), { Screen: 'StackScreen' });
  const Tabs = Object.assign(({ children, ...options }) => element('Tabs', options, children), { Screen: 'TabScreen' });
  let focused = true;
  const loaded = loadProject(path, {
    'react-native': {
      Image: 'Image', Platform: { OS: 'android' }, Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput',
      ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Switch: 'Switch', FlatList, SectionList,
      StyleSheet: { create: (styles) => styles, absoluteFill: {} },
      Keyboard: { dismiss: t.mock.fn() }, BackHandler: backHandler, AppState: appState, Alert: alert,
      Linking: { openSettings: t.mock.fn(async () => {}) },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': {
      useRouter: () => router, useFocusEffect: (effect) => useEffect(() => focused ? effect() : undefined, [effect, focused]),
      useLocalSearchParams: () => params, Stack, Tabs,
    },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' }, FadeInUp: animation, ZoomIn: animation, ReduceMotion: { System: 'system' },
      useReducedMotion: () => reduceMotion, useSharedValue: (initial) => {
        let value = initial;
        return { get: () => value, set: (next) => { value = next; } };
      },
      useAnimatedStyle: (factory) => factory(), withTiming: (value) => value,
    },
    'expo-haptics': haptics,
    'expo-constants': { expoVersion: '58.0.0', expoRuntimeVersion: '58.0.0', executionEnvironment: 'storeClient' },
    'expo-font': { useFonts: () => [true, null] },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    '@react-native-community/datetimepicker': { DateTimePickerAndroid: datePicker },
    'src/components/AppIcon.tsx': { AppIcon: 'AppIcon' },
    'src/services/foodDatabase.ts': database,
    'src/services/expirationNotifications.ts': reminders,
    'src/utils/useToday.ts': { useToday: () => '2026-11-10' },
    ...mocks,
  }, { dev });
  const screen = loaded.default ?? loaded.FoodForm ?? loaded.QuantityInput;
  const root = createRoot();
  t.after(() => act(async () => root.unmount()));
  await act(async () => root.render(element(screen, props)));

  function findAll(predicate, node = root.container) {
    if (typeof node === 'string') return [];
    return [...(predicate(node) ? [node] : []), ...node.children.flatMap((child) => findAll(predicate, child))];
  }
  function textOf(node) {
    return typeof node === 'string' ? node : node.children.map(textOf).join('');
  }
  function findOne(predicate, description) {
    const matches = findAll(predicate);
    assert.equal(matches.length, 1, description);
    return matches[0];
  }
  const byLabel = (label) => findOne((node) => node.props.accessibilityLabel === label, label);
  const byText = (text) => findOne((node) => node.type === 'Text' && textOf(node) === text, text);
  async function press(node) {
    assert.equal(Boolean(node.props.disabled), false, 'Button is disabled');
    await act(async () => node.props.onPress());
  }
  async function change(label, text) {
    await act(async () => byLabel(label).props.onChangeText(text));
  }
  async function date(day) {
    const [options] = datePicker.open.mock.calls.at(-1).arguments;
    await act(async () => options.onValueChange(null, new Date(2026, 10, day, 12)));
  }
  const option = (label) => findOne(
    (node) => node.props.accessibilityRole === 'radio' && textOf(node) === label, label,
  );
  async function focus(value) {
    focused = value;
    await act(async () => root.render(element(screen, props)));
  }
  return { root, router, focus, haptics, datePicker, alert, backHandler, appState, reminders, byLabel, byText, findAll, textOf, option, press, change, date };
}
