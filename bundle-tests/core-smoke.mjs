// micromongo/core smoke test — verifies the lean functional-only entry (dist/core.mjs):
// (1) it works for the functional API + aggregate, (2) it does NOT bundle the
// Collection/Cursor/index layer (the whole point of the split), and (3) $out/$lookup by
// unregistered name degrades to a clear error (Collection unavailable in core).
//   node bundle-tests/core-smoke.mjs
// Wired into `test:bundles`. Exits non-zero on failure.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import mm from '../dist/core.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// 1. functional API + aggregation work
const arr = [{ a: 1 }, { a: 2 }, { a: 3 }];
assert.deepEqual(mm.find(arr, { a: { $gte: 2 } }), [{ a: 2 }, { a: 3 }], 'core find');
assert.deepEqual(mm.aggregate(arr, [{ $group: { _id: null, s: { $sum: '$a' } } }]), [{ _id: null, s: 6 }], 'core aggregate');
assert.equal(mm.updateOne(arr, { a: 1 }, { $set: { a: 9 } }).modifiedCount, 1, 'core updateOne');
assert.equal(typeof mm.registerOperator, 'function', 'core registerOperator');

// 2. the Collection layer is NOT part of the surface, and NOT in the bundle
assert.ok(!('Collection' in mm), 'core has no Collection');
assert.ok(!('collection' in mm), 'core has no collection()');
const coreSrc = readFileSync(path.join(root, 'dist', 'core.mjs'), 'utf8');
assert.ok(!/class Collection|OrderedIndex|_planQuery/.test(coreSrc),
  'core.mjs bundle excludes the Collection/Cursor/index layer');

// 3. $out/$lookup by unregistered name → clear error (Collection unavailable in core);
//    array/Collection targets still work, but by-name lazy-create needs the full entry.
assert.throws(
  () => mm.aggregate([{ x: 1 }], [{ $out: 'nowhere' }]),
  /functional-core build/,
  '$out by unregistered name throws a clear core error'
);

console.log('Core smoke: OK (functional API works; Collection/index excluded; $out-by-name degrades clearly)');
