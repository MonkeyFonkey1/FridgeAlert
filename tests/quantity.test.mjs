import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProject } from './support/loadProject.mjs';

const { isValidQuantity, parseQuantity } = loadProject('src/utils/quantity.ts');

test('accepts positive whole quantities and preserves their exact value', () => {
  assert.equal(parseQuantity('1'), 1);
  assert.equal(parseQuantity(' 006 '), 6);
  assert.equal(parseQuantity('9007199254740991'), Number.MAX_SAFE_INTEGER);
});

test('rejects nonpositive, fractional, malformed and unsafe quantities', () => {
  for (const input of ['', '0', '-2', '1.5', '1,5', '1e2', '3 buc.', '9007199254740992']) {
    assert.equal(parseQuantity(input), null, input);
  }
  for (const value of [0, -2, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isValidQuantity(value), false, String(value));
  }
});
