export const defaultQuantity = 1;

export function isValidQuantity(value: number): boolean {
  return Number.isSafeInteger(value) && value >= defaultQuantity;
}

export function parseQuantity(input: string): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return isValidQuantity(value) ? value : null;
}
