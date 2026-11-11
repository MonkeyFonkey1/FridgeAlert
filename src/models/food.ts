export const categories = ['Lactate', 'Carne', 'Legume', 'Fructe', 'Băuturi', 'Altele'] as const;

export type FoodCategory = (typeof categories)[number];
export type FoodStatus = 'active' | 'consumed' | 'discarded';
export type HistoryStatus = Exclude<FoodStatus, 'active'>;

export type Food = {
  id: number;
  name: string;
  category: FoodCategory;
  expirationDate: string;
  quantity: number;
  status: FoodStatus;
  createdAt: string;
};

export type NewFood = Pick<Food, 'name' | 'category' | 'expirationDate' | 'quantity'>;

export const maxFoodNameLength = 80;
