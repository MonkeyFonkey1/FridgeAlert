export const reminderDayOptions = [1, 2, 3] as const;
export type ReminderDays = (typeof reminderDayOptions)[number];

export type ReminderPreferences = {
  enabled: boolean;
  daysBefore: ReminderDays;
};
