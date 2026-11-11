import type { RecipeAmount, RecipeUnit } from '../models/recipe';

export const maximumServings = 100;

const plurals: Record<RecipeUnit, string> = {
  'buc.': 'buc.', g: 'g', ml: 'ml', felie: 'felii',
  lingură: 'linguri', linguriță: 'lingurițe', cățel: 'căței', conservă: 'conserve',
};
const amountFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

export function formatRecipeAmount(amount: RecipeAmount, baseServings = 1, servings = baseServings): string {
  if (typeof amount === 'string') return amount;
  const quantity = amount.quantity * servings / baseServings;
  const unit = quantity === 1 ? amount.unit : plurals[amount.unit];
  return `${amountFormat.format(quantity)} ${unit}`;
}
