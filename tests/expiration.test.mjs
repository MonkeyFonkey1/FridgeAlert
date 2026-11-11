import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProject } from './support/loadProject.mjs';

const {
  dateForPicker,
  daysUntilExpiration,
  expirationLabel,
  expirationReminderDate,
  isDateKey,
  localDateKey,
} = loadProject('src/utils/expiration.ts');

test('validates actual calendar dates in YYYY-MM-DD format', () => {
  assert.equal(isDateKey('2028-02-29'), true);
  for (const invalid of ['', '2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '0000-01-01']) {
    assert.equal(isDateKey(invalid), false, invalid);
  }
});

test('counts calendar days across DST and year boundaries', () => {
  assert.equal(daysUntilExpiration('2026-03-30', '2026-03-29'), 1);
  assert.equal(daysUntilExpiration('2026-10-26', '2026-10-25'), 1);
  assert.equal(daysUntilExpiration('2027-01-02', '2026-12-30'), 3);
  assert.equal(daysUntilExpiration('2026-11-09', '2026-11-10'), -1);
  assert.equal(daysUntilExpiration('2026-11-10', '2026-11-10'), 0);
});

test('preserves the selected local day before and after UTC midnight', () => {
  assert.equal(localDateKey(new Date(2026, 10, 10, 0, 5)), '2026-11-10');
  assert.equal(localDateKey(new Date(2026, 10, 10, 23, 55)), '2026-11-10');
  assert.equal(localDateKey(dateForPicker('2028-02-29')), '2028-02-29');
});

test('labels expired dates separately from today and tomorrow', () => {
  assert.equal(expirationLabel(-1), 'Expirat de o zi');
  assert.equal(expirationLabel(0), 'Expiră azi');
  assert.equal(expirationLabel(1), 'Expiră mâine');
  assert.equal(expirationLabel(3), '3 zile rămase');
});

test('schedules reminders at local 09:00 across month, year and daylight-saving boundaries', () => {
  assert.deepEqual(expirationReminderDate('2026-03-30', 1), new Date(2026, 2, 29, 9));
  assert.deepEqual(expirationReminderDate('2026-10-27', 3), new Date(2026, 9, 24, 9));
  assert.deepEqual(expirationReminderDate('2027-01-02', 2), new Date(2026, 11, 31, 9));
});
