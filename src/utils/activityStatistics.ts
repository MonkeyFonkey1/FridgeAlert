import type { ActivityPeriod, InventoryActivity } from '../models/activity';
import { dateForPicker, daysUntilExpiration, localDateKey } from './expiration';
import { inventoryOverview } from './inventory';
import type { Food } from '../models/food';

export function activityStatistics(foods: Food[], events: InventoryActivity[], period: ActivityPeriod, today: string) {
  const inventory = inventoryOverview(foods, today);
  const totals = { consumed: 0, discarded: 0 };
  const quantities = new Map<string, { consumed: bigint; discarded: bigint }>();
  const evolution = new Map<string, number>();
  const recent: InventoryActivity[] = [];

  if (period !== 'all') {
    const firstDay = dateForPicker(today);
    firstDay.setDate(firstDay.getDate() - period + 1);
    const step = period === 7 ? 1 : 7;
    for (let offset = 0; offset < period; offset += step) {
      const start = new Date(firstDay);
      start.setDate(start.getDate() + offset);
      evolution.set(localDateKey(start), 0);
    }
  }

  for (const event of events) {
    const day = localDateKey(new Date(event.occurredAt));
    const age = daysUntilExpiration(today, day);
    if (age < 0 || (period !== 'all' && age >= period)) continue;

    if (recent.length < 10) recent.push(event);
    let bucket = day;
    if (period === 'all') {
      bucket = day.slice(0, 7);
    } else if (period === 30) {
      const start = dateForPicker(today);
      start.setDate(start.getDate() - 29 + Math.floor((29 - age) / 7) * 7);
      bucket = localDateKey(start);
    }
    evolution.set(bucket, (evolution.get(bucket) ?? 0) + 1);

    if (event.type === 'consumed' || event.type === 'discarded') {
      if (event.finalized === 1) totals[event.type] += 1;
      const unit = quantities.get(event.unit) ?? { consumed: 0n, discarded: 0n };
      unit[event.type] += BigInt(event.quantity);
      quantities.set(event.unit, unit);
    }
  }

  return {
    active: inventory.entries.length,
    soon: inventory.soon,
    totals,
    quantities: [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b)),
    evolution: [...evolution.entries()].sort(([a], [b]) => a.localeCompare(b)),
    recent,
  };
}
