// Tree-shake guard — proves the self-registering built-in operators survive an
// aggressive downstream bundle. The built-in operators register by SIDE EFFECT
// (crud/match/index.ts does `require('./operators/…')` purely to run
// registerOperator()); nothing imports their exports. A bundler told `sideEffects:false`
// could drop them, silently breaking `$gt`/`$in`/etc. This test bundles a tiny app that
// uses ONLY `find` (with an operator) via esbuild with tree-shaking on, then runs the
// output and asserts the operator still works.
//   node bundle-tests/treeshake-guard.mjs
// Wired into `test:bundles`. Exits non-zero on failure.

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

// this file is <root>/bundle-tests/treeshake-guard.mjs → root is its parent's parent
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

// A minimal consumer that imports the ESM bundle and uses only `find` + operators.
const appSource = `
  import mm from ${JSON.stringify(path.join(root, 'dist', 'index.mjs'))};
  const d = [{ a: 5 }, { a: 1 }, { a: 9 }];
  export const gt   = mm.find(d, { a: { $gt: 3 } }).length;   // needs $gt operator
  export const inOp = mm.find(d, { a: { $in: [1, 9] } }).length; // needs $in operator
`;

// Bundle it the way a downstream app would, with tree-shaking ON and sideEffects honored.
const result = await build({
  stdin: { contents: appSource, resolveDir: root, sourcefile: 'app.mjs', loader: 'js' },
  bundle: true,
  format: 'esm',
  treeShaking: true,
  // 'node' so the `createRequire`/`vm` in dist/index.mjs resolve (a real downstream
  // Node app bundling micromongo uses this platform); tree-shaking is still ON, which
  // is what this test exercises — the operators must survive it.
  platform: 'node',
  write: false,
  logLevel: 'silent',
});

// Execute the bundled output. Write it to a real file under the project (not a data:
// URL) so the bundle's `createRequire(import.meta.url)` banner gets a valid file path.
const fs = await import('node:fs');
const outPath = path.join(here, '.treeshake-bundle.tmp.mjs');
fs.writeFileSync(outPath, result.outputFiles[0].text);
let mod;
try {
  mod = await import('file://' + outPath.replace(/\\/g, '/'));
} finally {
  try { fs.unlinkSync(outPath); } catch { /* ignore */ }
}

assert.equal(mod.gt, 2, '$gt survived tree-shaking (2 of {5,1,9} are > 3)');
assert.equal(mod.inOp, 2, '$in survived tree-shaking (2 of {5,1,9} are in [1,9])');

console.log('Tree-shake guard: OK ($gt/$in survive an aggressive downstream bundle)');
