import { matchIngredient, type IngredientId } from '../data/ingredients.ts';
import type { Food } from '../models/food';
import type { Recipe, RecipeIngredient } from '../models/recipe';
import { daysUntilExpiration, expiringSoonDays } from './expiration.ts';

export const recipeGroups = [
  { id: 'ready', title: 'Poți găti acum' },
  { id: 'nearly', title: 'Îți lipsesc puține ingrediente' },
  { id: 'ideas', title: 'Alte idei' },
] as const;

export type RecipeGroup = (typeof recipeGroups)[number]['id'];
export type IngredientMatch = RecipeIngredient & {
  availability: 'name-only' | 'missing';
  expiringSoon: boolean;
};

export type RecipeRecommendation = {
  recipe: Recipe;
  group: RecipeGroup;
  required: IngredientMatch[];
  optional: IngredientMatch[];
  missing: IngredientMatch[];
  availableCount: number;
  expiringCount: number;
};

export function recommendRecipes(recipes: Recipe[], foods: Food[], today: string): RecipeRecommendation[] {
  const available = new Map<IngredientId, number>();

  for (const food of foods) {
    if (food.status !== 'active' || food.quantity < 1) continue;
    const days = daysUntilExpiration(food.expirationDate, today);
    if (!Number.isFinite(days) || days < 0) continue;
    const id = matchIngredient(food.name);
    if (!id) continue;

    // Use the nearest valid lot once per ingredient, even if several lots exist.
    available.set(id, Math.min(days, available.get(id) ?? Infinity));
  }

  function check(ingredient: RecipeIngredient): IngredientMatch {
    const days = available.get(ingredient.id);
    return {
      ...ingredient,
      // Inventory counts pieces or packages without recording their size or unit.
      availability: days === undefined ? 'missing' : 'name-only',
      expiringSoon: days !== undefined && days <= expiringSoonDays,
    };
  }

  const recommendations: RecipeRecommendation[] = recipes.map((recipe) => {
    const required = recipe.required.map(check);
    const optional = recipe.optional.map(check);
    const missing = required.filter(({ availability }) => availability === 'missing');
    const expiringCount = new Set([...required, ...optional].filter(({ expiringSoon }) => expiringSoon).map(({ id }) => id)).size;
    return {
      recipe,
      group: missing.length === 0 ? 'ready' : missing.length <= 2 ? 'nearly' : 'ideas',
      required,
      optional,
      missing,
      availableCount: required.length - missing.length,
      expiringCount,
    };
  });

  // Feasibility first, then use up as many soon-expiring ingredients as possible.
  const rank: Record<RecipeGroup, number> = { ready: 0, nearly: 1, ideas: 2 };
  return recommendations.sort((a, b) =>
    rank[a.group] - rank[b.group] ||
    b.expiringCount - a.expiringCount ||
    a.missing.length - b.missing.length ||
    b.availableCount - a.availableCount ||
    a.recipe.id.localeCompare(b.recipe.id),
  );
}
