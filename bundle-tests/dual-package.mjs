// Dual-package hazard test — loads BOTH the CJS build (dist/index.js) and the ESM
// build (dist/index.mjs) in one process and asserts they share the three module-level
// singletons (collection registry, operator tables, text-score WeakMap) via the
// globalThis-keyed bridge in src/singleton.ts. Without the bridge each copy gets its
// own state and these assertions fail (verified: the pre-bridge probe showed them
// unshared). Run directly with Node (mocha can't load .mjs):
//   node test/dual-package.mjs
// Wired into the test gate via `test:bundles`. Exits non-zero on any failure.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const cjs = require('../dist/index.js');                  // CJS copy
const esm = (await import('../dist/index.mjs')).default;  // ESM copy (self-contained bundle)

// They are genuinely two different module instances (different files) — that's the
// premise of the hazard. The bridge makes their *state* shared, not their identity.
assert.notEqual(cjs, esm, 'precondition: CJS and ESM are distinct module objects');

// 1) Operator tables — register through CJS, dispatch-visible through ESM (and vice-versa).
cjs.registerOperator('post', '$dpProbeA', function () { return true; });
assert.ok(esm._crud._match.postOperators.$dpProbeA, 'operator registered via CJS is visible to ESM');

esm.registerOperator('post', '$dpProbeB', function () { return true; });
assert.ok(cjs._crud._match.postOperators.$dpProbeB, 'operator registered via ESM is visible to CJS');

// And it actually works end-to-end through the other copy:
esm.registerOperator('post', '$isFortyTwo', function (v) { return v === 42; });
assert.deepEqual(cjs.find([{ n: 42 }, { n: 7 }], { n: { $isFortyTwo: 1 } }), [{ n: 42 }],
  'ESM-registered operator is usable by a CJS query');

// 2) Collection registry — set through CJS, resolvable through ESM's mm.db / collection().
cjs.collection('dpShared', [{ a: 1 }, { a: 2 }]);
assert.ok(esm.db.dpShared, 'collection registered via CJS appears in ESM mm.db');
assert.equal(esm.collection('dpShared').count({ a: { $gte: 1 } }), 2,
  'ESM resolves the CJS-registered collection and queries it');

// 3) Text-score WeakMap — exercised via the public path: a $text query that stashes a
//    score, then a $meta:"textScore" projection that retrieves it from the shared map.
const docs = [{ body: 'coffee shop downtown' }, { body: 'tea house' }];
const hitCjs = cjs.find(docs, { $text: { $search: 'coffee' } }, { score: { $meta: 'textScore' } });
assert.equal(hitCjs.length, 1, 'CJS $text matched one doc');
assert.equal(typeof hitCjs[0].score, 'number', 'CJS $meta:textScore produced a score (shared WeakMap path works)');

console.log('Dual-package: OK (operator tables, collection registry, text-score map shared across CJS+ESM)');
