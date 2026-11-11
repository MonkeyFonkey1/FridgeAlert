import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const project = fileURLToPath(new URL('../../', import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const compiled = new Map();

function resolveSource(filename) {
  const candidates = extname(filename) ? [filename] :
    [filename + '.ts', filename + '.tsx', resolve(filename, 'index.ts'), resolve(filename, 'index.tsx')];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error('Test could not resolve source: ' + filename);
  return match;
}

// Load the real TypeScript modules in isolated CommonJS graphs so mocks need no Node loader flags.
export function loadProject(entry, mocks = {}, { dev = false } = {}) {
  const modules = new Map();
  function load(filename) {
    const path = relative(project, filename).replaceAll('\\', '/');
    if (Object.hasOwn(mocks, path)) return mocks[path];
    if (path.startsWith('assets/') && ['.webp', '.ttf'].includes(extname(path))) return path;
    if (modules.has(filename)) return modules.get(filename).exports;
    if (!compiled.has(filename)) {
      const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext },
      });
      compiled.set(filename, new Function('require', 'module', 'exports', '__DEV__', outputText + '\n//# sourceURL=' + filename));
    }
    const module = { exports: {} };
    modules.set(filename, module);
    const require = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('.')) return load(resolveSource(resolve(dirname(filename), specifier)));
      return nodeRequire(specifier);
    };
    compiled.get(filename)(require, module, module.exports, dev);
    return module.exports;
  }
  return load(resolveSource(resolve(project, entry)));
}
