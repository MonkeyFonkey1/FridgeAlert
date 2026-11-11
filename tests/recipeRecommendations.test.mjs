import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProject } from './support/loadProject.mjs';

const { matchIngredient, shoppingIdentity } = loadProject('src/data/ingredients.ts');
const { recipes } = loadProject('src/data/recipes.ts');
const { recommendRecipes } = loadProject('src/utils/recipeRecommendations.ts');
const { formatRecipeAmount } = loadProject('src/utils/recipeAmount.ts');

const today = '2026-11-10';
const omelette = recipes.find(({ id }) => id === 'omleta-cu-branza');
const pastaTuna = recipes.find(({ id }) => id === 'paste-cu-ton');

function food(name, expirationDate = '2026-11-20', fields = {}) {
  return { id: 1, name, expirationDate, category: 'Altele', quantity: 1, status: 'active', ...fields };
}

test('matches complete normalized names and explicit synonyms, without matching fragments or categories', () => {
  assert.equal(matchIngredient('  OUĂ  de  GĂINĂ '), 'egg');
  assert.equal(matchIngredient('ROȘIE CHERRY'), 'tomato');
  assert.equal(matchIngredient('rosii'), 'tomato');
  assert.equal(matchIngredient('telemea'), 'cheese');
  assert.equal(matchIngredient('sos de roșii'), 'passata');
  assert.equal(matchIngredient('iaurt natural'), 'yogurt');
  assert.equal(matchIngredient('lapte integral'), 'milk');
  for (const name of ['lapte vegetal', 'lapte de cocos', 'cafea cu lapte', 'sos cu roșii și ardei', 'roșii uscate', 'ou de ciocolată']) {
    assert.equal(matchIngredient(name), undefined, name);
  }
});

test('handles empty stock, one or two missing requirements, and optional ingredients', () => {
  const [empty] = recommendRecipes([pastaTuna], [], today);
  assert.deepEqual([empty.group, empty.availableCount, empty.missing.length], ['ideas', 0, 3]);

  const [twoMissing] = recommendRecipes([pastaTuna], [food('penne')], today);
  assert.deepEqual([twoMissing.group, twoMissing.availableCount, twoMissing.missing.length], ['nearly', 1, 2]);

  const [oneMissing] = recommendRecipes([pastaTuna], [food('penne'), food('passata')], today);
  assert.deepEqual(oneMissing.missing.map(({ id }) => id), ['tuna']);
  assert.equal(oneMissing.group, 'nearly');

  const [ready] = recommendRecipes([omelette], [food('ouă'), food('telemea')], today);
  assert.equal(ready.group, 'ready');
  assert.equal(ready.availableCount, 2);
  assert.equal(ready.optional.every(({ availability }) => availability === 'missing'), true);
});

test('rejects expired or archived inventory and does not infer an ingredient from the category', () => {
  const [entry] = recommendRecipes([omelette], [
    food('Ouă', '2026-11-09'),
    food('Ouă', '2026-11-15', { status: 'consumed' }),
    food('Ouă', '2026-11-15', { status: 'discarded' }),
    food('Lapte', '2026-11-15', { category: 'Lactate' }),
  ], today);
  assert.deepEqual(entry.missing.map(({ id }) => id), ['egg', 'cheese']);
  assert.equal(entry.expiringCount, 0);
});

test('leaves piece counts and mass requirements unverified when the inventory unit is ambiguous', () => {
  const [entry] = recommendRecipes([omelette], [
    food('Ouă', '2026-11-10', { quantity: 1 }),
    food('Brânză', '2026-11-14', { quantity: 200 }),
  ], today);
  assert.deepEqual(entry.required.map(({ amount, availability, expiringSoon }) => [formatRecipeAmount(amount), availability, expiringSoon]), [
    ['2 buc.', 'name-only', true], ['50 g', 'name-only', false],
  ]);
});

test('scales recipe quantities, including fractions, without changing qualitative amounts', () => {
  assert.equal(formatRecipeAmount(omelette.required[0].amount, omelette.servings, 4), '8 buc.');
  assert.equal(formatRecipeAmount(omelette.required[1].amount, omelette.servings, 4), '200 g');
  const salad = recipes.find(({ id }) => id === 'salata-cu-oua');
  assert.equal(formatRecipeAmount(salad.required[1].amount, salad.servings, 3), '0,75 buc.');
  const tuna = pastaTuna.required.find(({ id }) => id === 'tuna');
  assert.equal(formatRecipeAmount(tuna.amount, 2, 4), '2 conserve');
  assert.equal(formatRecipeAmount('după gust', 1, 4), 'după gust');
});

test('ranks feasibility first and then distinct soon-expiring ingredients with stable ties', () => {
  const salad = recipes.find(({ id }) => id === 'salata-de-legume');
  const yogurt = recipes.find(({ id }) => id === 'iaurt-cu-fructe');
  const stock = [
    food('Ouă'), food('Brânză'), food('Roșii', '2026-11-11'),
    food('Roșie cherry', '2026-11-12'), food('Castravete', '2026-11-13'), food('Salată verde'),
    food('Iaurt', '2026-11-12'), food('Măr', '2026-11-12'),
  ];
  const ranked = recommendRecipes([yogurt, omelette, salad], stock, today);
  assert.deepEqual(ranked.map(({ recipe, group, expiringCount }) => [recipe.id, group, expiringCount]), [
    [salad.id, 'ready', 2], [omelette.id, 'ready', 0], [yogurt.id, 'nearly', 2],
  ]);
  const [first, second] = recommendRecipes([{ ...omelette, id: 'b' }, { ...omelette, id: 'a' }], stock, today);
  assert.deepEqual([first.recipe.id, second.recipe.id], ['a', 'b']);
});

test('uses the same shopping identity for manual entries and recipe aliases', () => {
  assert.equal(shoppingIdentity('  RoȘIE '), shoppingIdentity('Roșii'));
  assert.equal(shoppingIdentity(' Cafea   Măcinată  '), shoppingIdentity('cafea macinata'));
  assert.notEqual(shoppingIdentity('sos de roșii'), shoppingIdentity('roșii'));
});
