const dayInMs = 86_400_000;
export const expiringSoonDays = 3;

// Keep the calendar day selected on the phone, regardless of its UTC offset.
export function localDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateForPicker(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date;
}

function calendarDayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  // UTC is just a way to count calendar days. Local days may have 23 or 25 hours.
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  return utc.getTime() / dayInMs;
}

export function isDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key.startsWith('0000-')) return false;
  return new Date(calendarDayNumber(key) * dayInMs).toISOString().slice(0, 10) === key;
}

export function daysUntilExpiration(expirationDate: string, today: string): number {
  return calendarDayNumber(expirationDate) - calendarDayNumber(today);
}

export function expirationReminderDate(expirationDate: string, daysBefore: number): Date {
  const date = dateForPicker(expirationDate);
  date.setDate(date.getDate() - daysBefore);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function displayDate(key: string): string {
  const [year, month, day] = key.split('-');
  return `${day}.${month}.${year}`;
}

function dayLabel(days: number): string {
  return days === 1 ? 'o zi' : `${days}${days % 100 >= 20 || days % 100 === 0 ? ' de' : ''} zile`;
}

export function expirationLabel(days: number): string {
  if (days < 0) return `Expirat de ${dayLabel(-days)}`;
  if (days === 0) return 'Expiră azi';
  if (days === 1) return 'Expiră mâine';
  return `${dayLabel(days)} rămase`;
}
