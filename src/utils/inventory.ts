import type { Food, FoodCategory } from '../models/food';
import { daysUntilExpiration, expiringSoonDays } from './expiration';

export type ExpirationFilter = 'all' | 'soon' | 'later' | 'expired';
export type InventoryFilters = {
  query: string;
  category: FoodCategory | 'all';
  expiration: ExpirationFilter;
  order: 'asc' | 'desc';
};

export const defaultInventoryFilters: InventoryFilters = {
  query: '', category: 'all', expiration: 'all', order: 'asc',
};

function compareExpiration(a: Food, b: Food) {
  return a.expirationDate.localeCompare(b.expirationDate) || a.id - b.id;
}

export function inventoryOverview(foods: Food[], today: string) {
  const entries = foods.map((food) => ({ food, days: daysUntilExpiration(food.expirationDate, today) }))
    .sort((a, b) => compareExpiration(a.food, b.food));
  const upcoming = entries.filter(({ days }) => days >= 0);
  return {
    entries,
    priority: upcoming.slice(0, 3),
    soon: upcoming.filter(({ days }) => days <= expiringSoonDays).length,
    expired: entries.length - upcoming.length,
    totalQuantity: foods.reduce((total, food) => total + BigInt(food.quantity), 0n).toString(),
  };
}

function normalizeName(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filterInventory(entries: ReturnType<typeof inventoryOverview>['entries'], filters: InventoryFilters) {
  const query = normalizeName(filters.query);
  const filtered = entries.filter(({ food, days }) => {
    if (filters.category !== 'all' && food.category !== filters.category) return false;
    if (query && !normalizeName(food.name).includes(query)) return false;
    switch (filters.expiration) {
      case 'soon': return days >= 0 && days <= expiringSoonDays;
      case 'later': return days > expiringSoonDays;
      case 'expired': return days < 0;
      default: return true;
    }
  });
  return filters.order === 'desc' ? filtered.reverse() : filtered;
}
