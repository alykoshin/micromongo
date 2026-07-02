// Differential conformance harness: run the SAME driver-shaped operations against BOTH
// micromongo/mock AND a real MongoDB, and assert identical results. Because `micromongo/mock`
// mirrors the `mongodb` driver, one test body drives two backends — any divergence in
// query/update/aggregation semantics surfaces as a deep-equality failure.
//
// OPT-IN and source-agnostic: it runs only when a URI is available. The URI comes from
// `TEST_MONGODB_URI` — read from `.env` (gitignored) or the environment (env wins over .env).
// `MONGODB_URI` is also accepted as a fallback. With none set it exits 0 with a SKIP, so it
// never blocks a normal `npm test`. Point it at a THROWAWAY/test database — the harness
// creates and DROPS collections.
//
//   # .env:  TEST_MONGODB_URI=mongodb://localhost:27017
//   npm run test:mongo
//   # or ad-hoc:
//   TEST_MONGODB_URI=mongodb://localhost:27017 node test-mongo/differential.mjs
//
// This lives OUTSIDE test/ so mocha's `--recursive ./test/` never auto-runs it (no accidental
// dependency on a running mongod). See CLAUDE.md → "Validating against a real MongoDB".

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// --- tiny zero-dependency .env loader: parse KEY=VALUE lines from the repo-root .env.
// Only fills vars that aren't ALREADY set in the environment (env overrides .env). Supports
// `#` comments, blank lines, optional surrounding single/double quotes. No interpolation.
function loadDotEnv() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = path.join(root, '.env');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; } // no .env → nothing to load
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') { continue; }
    const eq = line.indexOf('=');
    if (eq < 0) { continue; }
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val[0] === '"' && val.endsWith('"')) || (val[0] === "'" && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) { process.env[key] = val; }
  }
}
loadDotEnv();

const URI = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
if (!URI) {
  console.log('SKIP: no TEST_MONGODB_URI — differential mongo tests need a real MongoDB.');
  console.log('      Set TEST_MONGODB_URI in .env (see .env.example) to a THROWAWAY database,');
  console.log('      or: TEST_MONGODB_URI=mongodb://localhost:27017 node test-mongo/differential.mjs');
  process.exit(0);
}

// The database to create the temp `mmdiff_*` collections in. Some accounts are scoped to a
// specific db (not free to create arbitrary ones), so this is configurable: TEST_MONGODB_DB,
// else the db in the URI path (mongodb://host/<db>), else 'mm_differential'.
function dbFromUri(uri) {
  const m = uri.replace(/^mongodb(\+srv)?:\/\//i, '').split('/')[1];
  if (!m) { return null; }
  const name = m.split('?')[0];
  return name || null;
}
const TEST_DB = process.env.TEST_MONGODB_DB || dbFromUri(URI) || 'mm_differential';
console.log('Differential harness → db "' + TEST_DB + '" (temp mmdiff_* collections, dropped after each case)');

// The real driver is a devDependency-or-peer; import lazily so the skip path needs nothing.
let RealMongoClient;
try {
  ({ MongoClient: RealMongoClient } = await import('mongodb'));
} catch {
  console.error('FAIL: MONGODB_URI is set but the `mongodb` driver is not installed (npm i -D mongodb).');
  process.exit(1);
}

// --- The cases: the ONE canonical example set (meta/mongo-examples.js). Each record's `do` op is
// run on a real MongoDB via `applyDriver`, and compared against BOTH the record's documented
// `expect` AND micromongo's result. So a passing case proves: documented == real Mongo == micromongo.
// The `real` field controls the live-Mongo comparison: 'exact' (default), 'skip:<why>' (non-
// deterministic — e.g. $rand), or 'structural:<kind>' (assert a weaker invariant).
const require2 = createRequire(import.meta.url);
const { examples } = require2('../meta/mongo-examples.js');
const { applyDriver, applyMicromongo, normalize } = require2('../meta/apply-example.js');
const mm = require2('../dist/index.js');

// regex in a `do` doesn't survive JSON round-trips (used for collection naming) — hash the op+title.
function caseId(ex, i) { return 'mmdiff_' + i + '_' + String(ex.op).replace(/[^a-z0-9]/gi, ''); }

let failures = 0, skipped = 0, checked = 0;
const realClient = new RealMongoClient(URI);
await realClient.connect();

try {
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    const mode = ex.real || 'exact';
    if (mode.startsWith('skip')) {
      skipped++;
      console.log('  ⊘ ' + ex.op + ' — ' + (ex.title || '') + '  (skip: ' + mode.slice(5) + ')');
      continue;
    }

    // Seed a fresh real collection with the fixture, run the op, read the result, then drop it.
    // `ex.collections` (for $lookup `from`) seeds auxiliary collections BY THEIR REAL NAME (so the
    // pipeline's `from: '<name>'` resolves), dropped afterwards.
    const coll = await prep(realClient, caseId(ex, i), ex.fixture);
    const auxNames = ex.collections ? Object.keys(ex.collections) : [];
    for (const name of auxNames) { await prep(realClient, name, ex.collections[name]); }
    let realRes;
    try {
      realRes = normalize(await applyDriver(coll, ex.do));
    } finally {
      await coll.drop().catch(() => {});
      for (const name of auxNames) { await realClient.db(TEST_DB).collection(name).drop().catch(() => {}); }
    }
    const mmRes = normalize(applyMicromongo(mm, ex.fixture, ex.do, ex.collections));
    const want = normalize(ex.expect);

    // Cross-engine normalization (NOT a micromongo behavior change — only fair comparison):
    //  - The real driver auto-assigns a 24-hex ObjectId `_id` to any inserted doc that lacked one;
    //    the documented/micromongo results (rightly) don't have it. Strip such AUTO ids (24-hex
    //    strings) so we compare the fields the example is about — an explicit small-int `_id` in
    //    the fixture is kept and still compared.
    //  - `distinct` result ORDER is unspecified in MongoDB — sort scalar-array results.
    const cmp = (v) => normForCompare(v);
    const realC = cmp(realRes), mmC = cmp(mmRes), wantC = cmp(want);

    checked++;
    try {
      if (mode.startsWith('structural')) {
        // Weaker invariant both engines must satisfy (e.g. same COUNT / same ORDER, not exact value).
        assertStructural(mode.slice('structural:'.length), realC, mmC, wantC, ex);
      } else {
        // exact: documented == real == micromongo
        assert.deepStrictEqual(realC, wantC);   // documented result holds on a live server
        assert.deepStrictEqual(mmC, wantC);     // micromongo matches it too
      }
      console.log('  ✓ ' + ex.op + ' — ' + (ex.title || ''));
    } catch (e) {
      failures++;
      console.log('  ✗ ' + ex.op + ' — ' + (ex.title || '') + '   ' + ex.source);
      console.log('    documented:', JSON.stringify(wantC));
      console.log('    real mongo:', JSON.stringify(realC));
      console.log('    micromongo:', JSON.stringify(mmC));
    }
  }
} finally {
  await realClient.close();
}

// Fair-comparison normalizer. Handles cross-engine noise that isn't a behavior difference:
//  - drop driver-AUTO `_id`s (24-hex ObjectId strings — never in a documented literal's small ints).
//  - sort SCALAR arrays (e.g. `distinct`, whose order is unspecified in MongoDB).
//  - sort NESTED doc-arrays whose elements all have `_id` (e.g. a `$lookup` `as` array — MongoDB
//    does NOT guarantee its order). The TOP-LEVEL result order is kept (it's often set by `$sort`),
//    so `depth === 0` is not reordered.
function normForCompare(v, depth) {
  depth = depth || 0;
  const AUTO_ID = /^[0-9a-f]{24}$/;
  if (Array.isArray(v)) {
    if (v.every((x) => x === null || typeof x !== 'object')) {
      return v.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    const mapped = v.map((x) => normForCompare(x, depth + 1));
    // nested array of docs with _id → order-insensitive (join arrays, etc.)
    if (depth > 0 && mapped.every((x) => x && typeof x === 'object' && x._id !== undefined)) {
      return mapped.slice().sort((a, b) => {
        const ai = JSON.stringify(a._id), bi = JSON.stringify(b._id);
        return ai < bi ? -1 : ai > bi ? 1 : 0;
      });
    }
    return mapped;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) {
      if (k === '_id' && typeof v[k] === 'string' && AUTO_ID.test(v[k])) { continue; } // driver auto id
      out[k] = normForCompare(v[k], depth + 1);
    }
    return out;
  }
  return v;
}

function assertStructural(kind, realRes, mmRes, want, ex) {
  if (kind === 'count') {
    // For a non-deterministic sample ($rand), exact counts differ run to run. Assert BOTH engines
    // return a non-degenerate result (>0 and <= the fixture size) — the shared invariant.
    const len = (x) => (Array.isArray(x) ? x.length : x);
    const n = ex.fixture.length;
    for (const [label, r] of [['real', realRes], ['mm', mmRes]]) {
      assert.ok(len(r) > 0 && len(r) <= n,
        ex.op + ' structural:count — ' + label + ' returned ' + len(r) + ' (expected 1..' + n + ')');
    }
  } else if (kind === 'order') {
    // compare only the _id order (values may be non-deterministic, e.g. $geoNear distances)
    const ids = (x) => x.map((d) => d && d._id);
    assert.deepStrictEqual(ids(realRes), ids(mmRes), ex.op + ' structural:order real vs mm');
  } else {
    throw new Error('unknown structural kind: ' + kind);
  }
}

console.log(
  '\nDifferential conformance vs real MongoDB: ' +
  (failures === 0 ? 'OK' : failures + ' DIVERGED') +
  ` (${checked} checked, ${skipped} skipped, ${examples.length} total)`
);
process.exit(failures === 0 ? 0 : 1);

// --- helpers ---
async function prep(client, name, fixture) {
  const db = client.db(TEST_DB);
  const c = db.collection(name);
  await c.deleteMany({}).catch(() => {});
  // Deep-clone each doc so the driver's insert can't mutate the shared fixture, and regexes in a
  // query aren't an issue here (fixtures are plain data; queries are applied via applyDriver).
  if (fixture.length) { await c.insertMany(fixture.map((d) => structuredClone(d))); }
  return c;
}
