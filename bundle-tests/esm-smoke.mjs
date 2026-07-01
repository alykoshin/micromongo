// ESM smoke test — verifies the tsup-built `dist/index.mjs` is importable as native
// ESM and that the `export = mm` callable surfaces correctly as the default export
// with working methods. Run directly with Node (mocha's CJS loader can't `import`):
//   node test/esm-smoke.mjs
// Wired into the test gate as `test:esm`. Exits non-zero on any failure.

import assert from 'node:assert/strict';
import mm from '../dist/index.mjs';

const arr = [{ a: 1 }, { a: 2 }, { a: 3 }];

// core functional API
assert.deepEqual(mm.find(arr, { a: { $gte: 2 } }), [{ a: 2 }, { a: 3 }], 'find $gte');
assert.equal(mm.count(arr, { a: { $gte: 2 } }), 2, 'count $gte');
assert.deepEqual(mm.findOne(arr, { a: 2 }), { a: 2 }, 'findOne');

// aggregation
assert.deepEqual(
  mm.aggregate(arr, [{ $match: { a: { $gt: 1 } } }, { $count: 'n' }]),
  [{ n: 2 }],
  'aggregate $match+$count'
);

// Collection / Cursor (the named class on the default export)
const c = new mm.Collection([{ x: 1 }, { x: 2 }, { x: 3 }]);
assert.deepEqual(c.find({ x: { $gt: 1 } }).sort({ x: -1 }).toArray(), [{ x: 3 }, { x: 2 }], 'Collection cursor');

// $where function form (the no-vm direct-call path) works in ESM
assert.deepEqual(mm.find(arr, { $where: function () { return this.a === 2; } }), [{ a: 2 }], '$where fn');

// extension point present
assert.equal(typeof mm.registerOperator, 'function', 'registerOperator');

console.log('ESM smoke: OK (find/count/findOne/aggregate/Collection/$where-fn/registerOperator)');
