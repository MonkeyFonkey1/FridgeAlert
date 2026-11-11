export const maxShoppingNameLength = 80;

export type ShoppingRecipeAmount = { recipeId: string; amount: string };

export type ShoppingItem = {
  id: number;
  name: string;
  checked: boolean;
  recipeAmounts: ShoppingRecipeAmount[];
};

export type ShoppingPurchase = {
  id: number;
  name: string;
  quantity: number;
  expirationDate: string;
};
