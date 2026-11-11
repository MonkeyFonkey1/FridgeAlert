import type { FoodCategory } from '../models/food';

export const ingredients = {
  egg: { name: 'Ouă', aliases: ['ou', 'ou de găină', 'ouă de găină'] },
  cheese: { name: 'Brânză', aliases: ['brânză albă', 'brânză de vaci', 'telemea', 'brânză telemea'] },
  cheddar: { name: 'Cașcaval', aliases: ['cașcaval ras', 'cașcaval feliat'] },
  pasta: { name: 'Paste', aliases: ['paste făinoase', 'spaghete', 'penne', 'fusilli', 'macaroane', 'tagliatelle'] },
  tomato: { name: 'Roșii', aliases: ['roșie', 'tomată', 'tomate', 'roșie cherry', 'roșii cherry'] },
  passata: { name: 'Sos simplu de roșii', aliases: ['sos de roșii', 'passata', 'roșii pasate', 'piure de roșii'] },
  cucumber: { name: 'Castraveți', aliases: ['castravete', 'castravete proaspăt', 'castraveți proaspeți'] },
  lettuce: { name: 'Salată verde', aliases: ['salată romană', 'salată iceberg', 'lăptucă'] },
  bread: { name: 'Pâine', aliases: ['pâine albă', 'pâine integrală', 'pâine toast', 'toast', 'felie de pâine', 'felii de pâine'] },
  ham: { name: 'Șuncă', aliases: ['șuncă feliată', 'șuncă presată', 'șuncă fiartă'] },
  potato: { name: 'Cartofi', aliases: ['cartof', 'cartof alb', 'cartofi albi', 'cartof roșu', 'cartofi roșii'] },
  rice: { name: 'Orez', aliases: ['orez alb', 'orez basmati', 'orez jasmine', 'orez cu bob lung'] },
  carrot: { name: 'Morcovi', aliases: ['morcov'] },
  peas: { name: 'Mazăre', aliases: ['mazăre congelată', 'mazăre verde'] },
  onion: { name: 'Ceapă', aliases: ['ceapă galbenă', 'ceapă roșie', 'ceapă albă'] },
  garlic: { name: 'Usturoi', aliases: ['cățel de usturoi', 'căpățână de usturoi'] },
  tuna: { name: 'Ton la conservă', aliases: ['conservă de ton', 'ton în suc propriu', 'ton în ulei'] },
  yogurt: { name: 'Iaurt', aliases: ['iaurt natural', 'iaurt simplu', 'iaurt grecesc'] },
  tortilla: { name: 'Lipii', aliases: ['lipie', 'lipie de grâu', 'lipii de grâu', 'tortilla', 'tortillas'] },
  banana: { name: 'Banane', aliases: ['banană'] },
  apple: { name: 'Mere', aliases: ['măr', 'măr verde', 'mere verzi', 'măr roșu', 'mere roșii'] },
  mushroom: { name: 'Ciuperci', aliases: ['ciupercă', 'champignon', 'ciuperci champignon'] },
  chicken: { name: 'Piept de pui', aliases: ['file de piept de pui', 'file de pui'] },
  oil: { name: 'Ulei', aliases: ['ulei de măsline', 'ulei de floarea-soarelui', 'ulei de floarea soarelui', 'ulei de rapiță'] },
  salt: { name: 'Sare', aliases: ['sare fină', 'sare de mare', 'sare iodată'] },
  pepper: { name: 'Piper', aliases: ['piper negru', 'piper măcinat'] },
  lemon: { name: 'Lămâie', aliases: ['lămâi'] },
  paprika: { name: 'Boia', aliases: ['boia dulce', 'paprika', 'boia de ardei'] },
  basil: { name: 'Busuioc', aliases: ['busuioc proaspăt', 'busuioc uscat'] },
  oats: { name: 'Fulgi de ovăz', aliases: ['ovăz', 'fulgi ovăz'] },
  milk: { name: 'Lapte', aliases: ['lapte de vacă', 'lapte integral', 'lapte semidegresat', 'lapte degresat', 'lapte fără lactoză'] },
  cinnamon: { name: 'Scorțișoară', aliases: ['scorțișoară măcinată'] },
  honey: { name: 'Miere', aliases: ['miere de albine'] },
  butter: { name: 'Unt', aliases: ['unt nesărat', 'unt sărat'] },
  zucchini: { name: 'Dovlecei', aliases: ['dovlecel', 'zucchini'] },
  parsley: { name: 'Pătrunjel', aliases: ['pătrunjel verde', 'frunze de pătrunjel'] },
  mustard: { name: 'Muștar', aliases: ['muștar clasic', 'muștar Dijon'] },
} as const;

export type IngredientId = keyof typeof ingredients;

function normalize(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

const ingredientIds = Object.keys(ingredients) as IngredientId[];
const aliases = new Map<string, IngredientId>(
  ingredientIds.flatMap((id) => [ingredients[id].name, ...ingredients[id].aliases].map((name) => [normalize(name), id] as const)),
);

export function matchIngredient(name: string): IngredientId | undefined {
  return aliases.get(normalize(name));
}

export function shoppingIdentity(name: string): string {
  const ingredient = matchIngredient(name);
  return ingredient ? `ingredient:${ingredient}` : `name:${normalize(name)}`;
}

const shoppingCategories: Partial<Record<IngredientId, FoodCategory>> = {
  cheese: 'Lactate', cheddar: 'Lactate', yogurt: 'Lactate', milk: 'Lactate', butter: 'Lactate',
  ham: 'Carne', chicken: 'Carne', tuna: 'Carne',
  tomato: 'Legume', cucumber: 'Legume', lettuce: 'Legume', potato: 'Legume', carrot: 'Legume',
  peas: 'Legume', onion: 'Legume', garlic: 'Legume', mushroom: 'Legume', zucchini: 'Legume',
  banana: 'Fructe', apple: 'Fructe', lemon: 'Fructe',
};

export function shoppingFoodCategory(name: string): FoodCategory {
  const ingredient = matchIngredient(name);
  return (ingredient && shoppingCategories[ingredient]) || 'Altele';
}
