'use strict';

// Browser IIFE smoke test — evaluates dist/index.global.js the way a <script> tag
// would (a fresh global with NO `require`/`module`/`exports`/Node builtins) and
// asserts it attaches a working `micromongo` global. This proves the IIFE is
// browser-loadable (no Node-only top-level dependency). String `$where` EVALUATES in
// the browser (via new Function + a one-time warn — Option C); everything else works.
//   node bundle-tests/browser-iife-smoke.cjs

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.global.js'), 'utf8');

// A minimal browser-like global: `window`/`self`/`globalThis`, but explicitly NO
// `require`, `module`, `exports`, or `process` — so any leaked Node dependency throws.
const sandbox = {};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = console;
vm.createContext(sandbox);

vm.runInContext(code, sandbox, { filename: 'index.global.js' });

const mm = sandbox.micromongo;
assert(mm && typeof mm.find === 'function', 'micromongo global attached with find()');

const arr = [{ a: 1 }, { a: 2 }, { a: 3 }];
// Use deepEqual (structural), not deepStrictEqual: the bundle returns objects from its
// own module realm, so prototypes differ from this test's literals even when the data is
// identical — strict equality would spuriously fail on that, not on a real difference.
assert.deepEqual(mm.find(arr, { a: { $gte: 2 } }), [{ a: 2 }, { a: 3 }], 'find works in IIFE');
assert.strictEqual(mm.count(arr, { a: { $gt: 1 } }), 2, 'count works in IIFE');
assert.deepEqual(
  mm.aggregate(arr, [{ $match: { a: { $gt: 1 } } }, { $count: 'n' }]),
  [{ n: 2 }],
  'aggregate works in IIFE'
);
// $where function form works (called directly, no vm)
assert.deepEqual(mm.find(arr, { $where: function () { return this.a === 3; } }), [{ a: 3 }], '$where fn in IIFE');

// string $where EVALUATES in the browser (Option C: new Function + a one-time warn, no
// Node vm/timeout). Both the `this.x` and free-variable `obj.x` forms must work.
assert.deepEqual(mm.find(arr, { $where: 'this.a === 3' }), [{ a: 3 }], 'string $where (this) evaluates in IIFE');
assert.deepEqual(
  mm.find([{ c: 5, d: 5 }, { c: 1, d: 9 }], { $where: 'obj.c === obj.d' }),
  [{ c: 5, d: 5 }],
  'string $where (obj free var) evaluates in IIFE'
);

console.log('Browser IIFE smoke: OK (find/count/aggregate work; $where fn + string both evaluate in-browser)');
