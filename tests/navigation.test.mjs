import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { getExactRoutes } = require('expo-router/build/getRoutes.js');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig.js');
const { getStateFromPath } = require('expo-router/build/fork/getStateFromPath.js');

test('Expo Router matches public tab URLs and registers secondary screens in the root stack', () => {
  const files = readdirSync(new URL('../src/app/', import.meta.url), { recursive: true })
    .filter((path) => path.endsWith('.tsx'));
  const context = Object.assign(() => ({ default: () => null }), {
    keys: () => files.map((path) => `./${path}`),
  });
  const config = getReactNavigationConfig(getExactRoutes(context));

  function destination(path) {
    const state = getStateFromPath(path, config);
    assert.ok(state, path);
    const root = state.routes.at(-1);
    return root.state ? [root.name, root.state.routes.at(-1).name] : [root.name];
  }

  for (const [path, tab] of [
    ['/', 'index'], ['/frigider', 'frigider'], ['/retete', 'retete'], ['/cumparaturi', 'cumparaturi'],
  ]) {
    assert.deepEqual(destination(path), ['(tabs)', tab]);
  }

  for (const [path, screen] of [
    ['/adauga', 'adauga'], ['/istoric', 'istoric'], ['/setari', 'setari'], ['/statistici', 'statistici'],
    ['/confirma-cumparaturile', 'confirma-cumparaturile'], ['/retete/omleta-cu-branza', 'retete/[id]'],
    ['/alimente/42', 'alimente/[id]/index'], ['/alimente/42/editeaza', 'alimente/[id]/editeaza'],
  ]) {
    assert.deepEqual(destination(path), [screen]);
  }
});
