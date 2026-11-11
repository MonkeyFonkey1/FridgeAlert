import assert from 'node:assert/strict';
import test from 'node:test';
import { act } from 'react';
import { renderScreen } from './support/ui.mjs';
import { testDatabase } from './support/testDatabase.mjs';

const lot = {
  id: 7, name: 'Iaurt', category: 'Lactate', quantity: 5, expirationDate: '2026-11-15',
  status: 'active', createdAt: '2026-11-01T10:00:00Z',
};
const foodPath = 'src/app/alimente/[id]/index.tsx';
const byRole = (ui, role) => ui.findAll((node) => node.props.accessibilityRole === role);
const roleText = (ui, role, text) => byRole(ui, role).find((node) => ui.textOf(node) === text);
const args = (spy) => spy.mock.calls.map(({ arguments: values }) => values);

test('add screen validates inputs and saves a trimmed name, selected date and incremented quantity', async (t) => {
  const addFood = t.mock.fn(async () => {});
  const ui = await renderScreen(t, 'src/app/adauga.tsx', { data: { addFood } });
  assert.equal(ui.byLabel('Cantitate').props.value, '1');
  assert.equal(ui.byLabel('Scade: Cantitate').props.disabled, true);
  await ui.press(ui.byLabel('Salvează produs'));
  assert.equal(addFood.mock.callCount(), 0);
  ui.byText('Scrie numele alimentului.');
  ui.byText('Alege o categorie.');
  await ui.change('Nume aliment', '  Iaurt  ');
  await ui.press(ui.option('Lactate'));
  await ui.press(ui.byLabel('Alege data de expirare'));
  await ui.date(15);
  await ui.press(ui.byLabel('Mărește: Cantitate'));
  await ui.press(ui.byLabel('Salvează produs'));
  assert.deepEqual(args(addFood), [[{ name: 'Iaurt', category: 'Lactate', quantity: 2, expirationDate: '2026-11-15' }]]);
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 1);
  assert.deepEqual(args(ui.router.dismissTo), [['/']]);
});

test('edit screen pre-fills the item, reports a stale save, and refreshes reminders on success', async (t) => {
  const updateFood = t.mock.fn(async () => true);
  updateFood.mock.mockImplementationOnce(async () => false);
  const ui = await renderScreen(t, 'src/app/alimente/[id]/editeaza.tsx', {
    params: { id: '7' }, data: { getFoodById: async () => lot, updateFood },
  });
  assert.equal(ui.byLabel('Nume aliment').props.value, lot.name);
  assert.equal(ui.byLabel('Cantitate').props.value, '5');
  await ui.change('Cantitate', '2');
  await ui.press(ui.byLabel('Salvează modificările'));
  ui.byText('Alimentul nu mai este disponibil pentru editare.');
  assert.equal(ui.router.back.mock.callCount(), 0);
  await ui.press(ui.byLabel('Salvează modificările'));
  assert.deepEqual(args(updateFood).at(-1), [7, {
    name: 'Iaurt', category: 'Lactate', quantity: 2, expirationDate: '2026-11-15',
  }]);
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 1);
  assert.equal(ui.router.back.mock.callCount(), 1);
});

test('food details guard partial consumption and support cancelling before saving', async (t) => {
  const consumeFood = t.mock.fn(async () => true);
  const ui = await renderScreen(t, foodPath, { params: { id: '7' }, data: { getFoodById: async () => lot, consumeFood } });
  await ui.press(ui.byLabel('Am consumat produsul'));
  await ui.change('Cantitate', '6');
  assert.equal(ui.byLabel('Confirmă consumul').props.disabled, true);
  await ui.press(ui.byLabel('Anulează'));
  assert.equal(consumeFood.mock.callCount(), 0);
  await ui.press(ui.byLabel('Am consumat produsul'));
  await ui.press(ui.byLabel('Mărește: Cantitate'));
  await ui.press(ui.byLabel('Confirmă consumul'));
  assert.deepEqual(args(consumeFood), [[7, 2, lot]]);
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 1);
});

test('details only delete after confirmation and reject invalid route IDs', async (t) => {
  const deleteFood = t.mock.fn(async () => true);
  const getFoodById = t.mock.fn(async () => lot);
  const ui = await renderScreen(t, foodPath, { params: { id: '7' }, data: { getFoodById, deleteFood } });
  await ui.press(ui.byLabel('Șterge definitiv'));
  const [, , options] = args(ui.alert.alert)[0];
  assert.deepEqual(options.map(({ text }) => text), ['Anulează', 'Șterge']);
  options[0].onPress?.();
  assert.equal(deleteFood.mock.callCount(), 0);
  await act(async () => options[1].onPress());
  assert.deepEqual(args(deleteFood), [[7]]);
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 1);

  const invalid = await renderScreen(t, foodPath, { params: { id: '7a' }, data: { getFoodById } });
  invalid.byText('Alimentul nu mai există');
  assert.deepEqual(args(getFoodById), [[7]]);
});

test('dashboard shows real counts and supports search, navigation and the history sections', async (t) => {
  const foods = [lot, { ...lot, id: 8, name: 'Măr', category: 'Fructe', expirationDate: '2026-11-10' }];
  const ui = await renderScreen(t, 'src/app/index.tsx', { data: { getActiveFoods: async () => foods } });
  ui.byLabel('Produse active, 2');
  ui.byLabel('În max. 3 zile, 1');
  await ui.change('Caută după numele alimentului', 'produse inexistente');
  ui.byText('Niciun rezultat');
  await ui.change('Caută după numele alimentului', 'mar');
  await ui.press(roleText(ui, 'button', 'Filtre și sortare'));
  await ui.press(ui.option('Lactate'));
  ui.byText('Niciun rezultat');
  await ui.press(ui.option('Fructe'));
  const apple = byRole(ui, 'button').find((node) => node.props.accessibilityHint === 'Deschide detaliile alimentului');
  assert.match(ui.textOf(apple), /Măr/);
  await ui.press(apple);
  await ui.press(ui.byLabel('Istoric'));
  await ui.press(ui.byLabel('Vezi toate rețetele'));
  assert.deepEqual(args(ui.router.navigate), [[{ pathname: '/alimente/[id]', params: { id: '8' } }], ['/istoric'], ['/retete']]);

  const history = await renderScreen(t, 'src/app/istoric.tsx', {
    data: { getHistoryFoods: async () => [{ ...lot, status: 'consumed' }, { ...foods[1], status: 'discarded' }] },
  });
  history.byText('Consumate');
  history.byText('Aruncate');
  history.byText('Consumat');
  history.byText('Aruncat');
});

test('recipe details scale missing and already matched ingredients before adding them to the cart', async (t) => {
  const addRecipeShoppingItems = t.mock.fn(async () => {});
  const ui = await renderScreen(t, 'src/app/retete/[id].tsx', {
    params: { id: 'omleta-cu-branza' },
    data: { getActiveFoods: async () => [{ ...lot, name: 'Ouă' }], addRecipeShoppingItems },
  });
  await ui.change('Număr de porții', '4');
  ui.byText('Ouă · 8 buc.');
  ui.byText('Brânză · 200 g');
  await ui.press(ui.byLabel('Adaugă ingredientele lipsă pe lista de cumpărături'));
  await ui.press(ui.byLabel('Adaugă toate ingredientele obligatorii'));
  assert.deepEqual(args(addRecipeShoppingItems), [
    ['omleta-cu-branza', [{ name: 'Brânză', amount: '200 g' }]],
    ['omleta-cu-branza', [{ name: 'Ouă', amount: '8 buc.' }, { name: 'Brânză', amount: '200 g' }]],
  ]);
  await ui.change('Număr de porții', '101');
  assert.equal(ui.byLabel('Adaugă toate ingredientele obligatorii').props.disabled, true);
});

test('recipes screen groups the catalog and opens a recipe and the cart', async (t) => {
  const ui = await renderScreen(t, 'src/app/retete/index.tsx', {
    data: { getActiveFoods: async () => [{ ...lot, name: 'Ouă' }, { ...lot, id: 8, name: 'Telemea' }] },
  });
  for (const title of ['Poți găti acum', 'Îți lipsesc puține ingrediente', 'Alte idei']) ui.byText(title);
  const omelette = byRole(ui, 'button').find((node) =>
    node.props.accessibilityHint === 'Deschide rețeta' && ui.textOf(node).includes('Omletă cu brânză'));
  await ui.press(omelette);
  await ui.press(ui.byLabel('Lista de cumpărături'));
  assert.deepEqual(args(ui.router.navigate), [[{ pathname: '/retete/[id]', params: { id: 'omleta-cu-branza' } }], ['/cumparaturi']]);
});

test('cart checkboxes do not confirm automatically and checkout submits once with actual quantities and dates', async (t) => {
  let items = [{ id: 1, name: 'Ouă', checked: false, recipeAmounts: [] }, { id: 2, name: 'Lapte', checked: false, recipeAmounts: [] }];
  const setShoppingItemChecked = t.mock.fn(async (id, checked) => {
    items = items.map((item) => item.id === id ? { ...item, checked } : item);
  });
  const confirmShoppingPurchases = t.mock.fn(async () => true);
  const data = { getShoppingItems: async () => items, setShoppingItemChecked, confirmShoppingPurchases };
  const cart = await renderScreen(t, 'src/app/cumparaturi.tsx', { data });
  assert.equal(cart.findAll(({ props }) => props.accessibilityLabel?.startsWith('Confirmă cumpărăturile')).length, 0);
  await cart.press(cart.byLabel('Ouă'));
  await cart.press(cart.byLabel('Lapte'));
  assert.equal(confirmShoppingPurchases.mock.callCount(), 0);
  await cart.press(cart.byLabel('Confirmă cumpărăturile (2)'));
  assert.deepEqual(args(cart.router.navigate), [['/confirma-cumparaturile']]);

  const checkout = await renderScreen(t, 'src/app/confirma-cumparaturile.tsx', { data });
  assert.equal(checkout.byLabel('Adaugă în frigider').props.disabled, true);
  await checkout.press(checkout.byLabel('Alege aceeași dată pentru toate'));
  await checkout.date(18);
  await checkout.press(checkout.byLabel('Data expirării pentru Lapte: 18.11.2026'));
  await checkout.date(20);
  await checkout.change('Cantitate pentru Ouă', '8');
  await checkout.press(checkout.byLabel('Adaugă în frigider'));
  assert.equal(confirmShoppingPurchases.mock.callCount(), 1);
  assert.deepEqual(args(confirmShoppingPurchases)[0][0], [
    { id: 1, name: 'Ouă', quantity: 8, expirationDate: '2026-11-18' },
    { id: 2, name: 'Lapte', quantity: 1, expirationDate: '2026-11-20' },
  ]);
  assert.equal(checkout.reminders.syncReminders.mock.callCount(), 1);
  assert.deepEqual(args(checkout.router.dismissTo), [['/']]);
});

test('settings persist changes before rescheduling and show diagnostic controls only in development', async (t) => {
  const saveReminderPreferences = t.mock.fn(async () => {});
  const ui = await renderScreen(t, 'src/app/setari.tsx', { dev: true, data: { saveReminderPreferences } });
  await act(async () => ui.byLabel('Notificări de expirare').props.onValueChange(true));
  await ui.press(ui.option('Cu 3 zile înainte'));
  assert.deepEqual(args(saveReminderPreferences), [[{ enabled: true, daysBefore: 1 }], [{ enabled: true, daysBefore: 3 }]]);
  assert.deepEqual(args(ui.reminders.syncReminders).slice(-2), [[true], [false]]);
  await ui.press(ui.byLabel('Testează acum'));
  assert.deepEqual(args(ui.reminders.testReminder), [['immediate']]);

  const release = await renderScreen(t, 'src/app/setari.tsx');
  assert.equal(release.findAll(({ props }) => props.accessibilityLabel?.startsWith('Testează')).length, 0);
});

test('dashboard can recover from a failed query, and discarding refreshes reminders', async (t) => {
  const getActiveFoods = t.mock.fn(async () => [lot]);
  getActiveFoods.mock.mockImplementationOnce(async () => { throw new Error('database unavailable'); });
  const home = await renderScreen(t, 'src/app/index.tsx', { data: { getActiveFoods } });
  home.byText('Nu am putut încărca produsele');
  await home.press(home.byLabel('Încearcă din nou'));
  home.byLabel('Produse active, 1');
  assert.equal(getActiveFoods.mock.callCount(), 2);

  const changeFoodQuantity = t.mock.fn(async () => true);
  const details = await renderScreen(t, foodPath, { params: { id: '7' }, data: { getFoodById: async () => lot, changeFoodQuantity } });
  await details.press(details.byLabel('Am aruncat produsul'));
  await details.press(details.byLabel('Mărește: Cantitate'));
  assert.equal(changeFoodQuantity.mock.callCount(), 0);
  await details.press(details.byLabel('Confirmă aruncarea'));
  assert.deepEqual(args(changeFoodQuantity), [[7, 'discarded', 2, lot]]);
  assert.equal(details.reminders.syncReminders.mock.callCount(), 1);
  assert.equal(details.router.back.mock.callCount(), 1);
});

test('root layout configures notifications once and refreshes alarms on foreground', async (t) => {
  const ui = await renderScreen(t, 'src/app/_layout.tsx');
  assert.equal(ui.reminders.configureNotificationPresentation.mock.callCount(), 1);
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 1);
  const [event, callback] = args(ui.appState.addEventListener)[0];
  assert.equal(event, 'change');
  await act(async () => callback('background'));
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 1);
  await act(async () => callback('active'));
  assert.equal(ui.reminders.syncReminders.mock.callCount(), 2);
});

test('dashboard opens statistics, and period filters update activity independently of current inventory', async (t) => {
  const home = await renderScreen(t, 'src/app/index.tsx');
  await home.press(home.byLabel('Statistici'));
  assert.deepEqual(args(home.router.navigate), [['/statistici']]);

  const activity = {
    id: 1, type: 'consumed', name: 'Iaurt', quantity: 2, unit: 'buc.', finalized: 0,
    occurredAt: new Date(2026, 10, 1, 12).toISOString(),
  };
  const stats = await renderScreen(t, 'src/app/statistici.tsx', {
    data: { getActiveFoods: async () => [lot], getInventoryActivity: async () => [activity] },
  });
  stats.byText('Produse active');
  stats.byText('Nicio activitate în perioada selectată.');
  await stats.press(roleText(stats, 'button', 'Ultimele 30 de zile'));
  stats.byText('Ai consumat 2 buc. · Iaurt');
  stats.byText('Consumate · 2 buc.');
  assert.equal(roleText(stats, 'button', 'Ultimele 30 de zile').props.accessibilityState.selected, true);
  await stats.press(roleText(stats, 'button', 'Tot timpul'));
  stats.byText('Acțiuni pe lună');
  await stats.press(stats.byLabel('Înapoi'));
  assert.deepEqual(args(stats.router.dismissTo), [['/']]);
});

test('statistics retries after a failed journal read and renders an empty state', async (t) => {
  const getInventoryActivity = t.mock.fn(async () => []);
  getInventoryActivity.mock.mockImplementationOnce(async () => { throw new Error('journal unavailable'); });
  const stats = await renderScreen(t, 'src/app/statistici.tsx', { data: { getInventoryActivity } });
  stats.byText('Nu am putut încărca statisticile');
  await stats.press(stats.byLabel('Încearcă din nou'));
  stats.byText('Activitate recentă');
  assert.equal(getInventoryActivity.mock.callCount(), 2);
});

test('takes scaled recipe ingredients through checkout into the live inventory and journal', async (t) => {
  const { db, reopen } = testDatabase(t);
  const recipe = await renderScreen(t, 'src/app/retete/[id].tsx', {
    data: db, params: { id: 'omleta-cu-branza' },
  });
  await recipe.change('Număr de porții', '4');
  await recipe.press(recipe.byLabel('Adaugă ingredientele lipsă pe lista de cumpărături'));

  const cart = await renderScreen(t, 'src/app/cumparaturi.tsx', { data: db });
  await cart.press(cart.byLabel('Ouă'));
  await cart.press(cart.byLabel('Brânză'));
  assert.deepEqual(await db.getInventoryActivity(), []);

  const checkout = await renderScreen(t, 'src/app/confirma-cumparaturile.tsx', { data: db });
  await checkout.press(checkout.byLabel('Alege aceeași dată pentru toate'));
  await checkout.date(18);
  await checkout.change('Cantitate pentru Ouă', '8');
  await checkout.press(checkout.byLabel('Adaugă în frigider'));
  assert.deepEqual(await db.getShoppingItems(), []);
  assert.equal((await db.getActiveFoods()).find(({ name }) => name === 'Ouă').quantity, 8);

  const saved = reopen();
  const today = new Date();
  const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')].join('-');
  const stats = await renderScreen(t, 'src/app/statistici.tsx', {
    data: saved, mocks: { 'src/utils/useToday.ts': { useToday: () => localDate } },
  });
  stats.byText('Ai cumpărat 8 buc. · Ouă');
  stats.byText('Ai cumpărat 1 buc. · Brânză');
  stats.byText('Nicio cantitate consumată sau aruncată în această perioadă.');
});

test('two rapid confirmations send one partial disposal to SQLite', async (t) => {
  let finish;
  const changeFoodQuantity = t.mock.fn(() => new Promise((resolve) => { finish = resolve; }));
  const details = await renderScreen(t, foodPath, {
    params: { id: '7' }, data: { getFoodById: async () => lot, changeFoodQuantity },
  });
  await details.press(details.byLabel('Am aruncat produsul'));
  const confirm = details.byLabel('Confirmă aruncarea').props.onPress;
  await act(async () => {
    confirm();
    confirm();
  });
  assert.deepEqual(args(changeFoodQuantity), [[7, 'discarded', 1, lot]]);
  assert.equal(details.byLabel('Confirmă aruncarea').props.accessibilityState.busy, true);
  await act(async () => finish(true));
  assert.equal(details.router.back.mock.callCount(), 1);
});
