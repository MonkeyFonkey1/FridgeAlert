export type ActivityType = 'added' | 'purchased' | 'consumed' | 'discarded';

export interface InventoryActivity {
  id: number;
  type: ActivityType;
  name: string;
  quantity: number;
  unit: string;
  occurredAt: string;
  finalized: number;
}

export type ActivityPeriod = 7 | 30 | 'all';
