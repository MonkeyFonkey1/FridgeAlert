import type { IngredientId } from '../data/ingredients';

export type RecipeIngredient = {
  id: IngredientId;
  amount: RecipeAmount;
};

export type RecipeUnit = 'buc.' | 'g' | 'ml' | 'felie' | 'lingură' | 'linguriță' | 'cățel' | 'conservă';
export type RecipeAmount = string | { quantity: number; unit: RecipeUnit };

export type Recipe = {
  id: string;
  name: string;
  description: string;
  minutes: number;
  difficulty: 'Ușoară' | 'Medie';
  servings: number;
  required: RecipeIngredient[];
  optional: RecipeIngredient[];
  water?: RecipeAmount;
  steps: string[];
};
