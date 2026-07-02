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
import mock from '../dist/mock/index.mjs';

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

// --- The cases: each is one driver-shaped operation over a fixture, plus how to read a result.
// `run(collection)` performs the op and returns the value to compare. Keep results ORDER-STABLE
// (add a final sort) so two backends compare deep-equal without incidental ordering noise.
const CASES = [
  {
    name: 'find + $gte, sorted',
    fixture: [{ _id: 1, qty: 30 }, { _id: 2, qty: 10 }, { _id: 3, qty: 50 }],
    run: (c) => c.find({ qty: { $gte: 30 } }).sort({ qty: 1 }).toArray(),
  },
  {
    name: '$or + projection',
    fixture: [{ _id: 1, s: 'A', n: 1 }, { _id: 2, s: 'B', n: 2 }, { _id: 3, s: 'A', n: 3 }],
    // NOTE: use an explicit inclusion ({ s: 1 }) rather than only { _id: 1 } — micromongo treats
    // a projection with no non-_id inclusion field as "include everything", which DIVERGES from
    // real Mongo (a known difference; that's precisely what a harness like this surfaces).
    run: (c) => c.find({ $or: [{ s: 'B' }, { n: { $gt: 2 } }] }, { projection: { _id: 0, s: 1 } }).sort({ s: 1 }).toArray(),
  },
  {
    name: 'updateMany $inc → read back',
    fixture: [{ _id: 1, s: 'A', v: 1 }, { _id: 2, s: 'A', v: 2 }, { _id: 3, s: 'B', v: 9 }],
    run: async (c) => {
      const report = await c.updateMany({ s: 'A' }, { $inc: { v: 10 } });
      const docs = await c.find({}).sort({ _id: 1 }).toArray();
      // Compare the driver-shaped write report AND the resulting docs.
      return { matchedCount: report.matchedCount, modifiedCount: report.modifiedCount, docs };
    },
  },
  {
    name: 'aggregate $group + $sort',
    fixture: [{ s: 'A', amt: 30 }, { s: 'B', amt: 10 }, { s: 'A', amt: 50 }],
    run: (c) => c.aggregate([
      { $group: { _id: '$s', total: { $sum: '$amt' } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
  },
  {
    name: '$elemMatch on array of subdocs',
    fixture: [{ _id: 1, items: [{ p: 5 }, { p: 20 }] }, { _id: 2, items: [{ p: 1 }] }],
    run: (c) => c.find({ items: { $elemMatch: { p: { $gt: 10 } } } }).sort({ _id: 1 }).toArray(),
  },
];

// Strip driver ObjectId noise: cases here all supply explicit _id or group, so results are
// directly comparable. (If a case omits _id, normalize before comparing.)
function normalize(v) {
  return JSON.parse(JSON.stringify(v)); // flatten BSON/ObjectId wrappers to plain JSON
}

let failures = 0;
const mockClient = mock.createClient();
const realClient = new RealMongoClient(URI);
await realClient.connect();

try {
  for (const kase of CASES) {
    // Fresh, isolated collection per case per backend.
    const coll = 'mmdiff_' + Math.abs(hashName(kase.name));
    const mockColl = await prep(mockClient, coll, kase.fixture);
    const realColl = await prep(realClient, coll, kase.fixture);

    const mockRes = normalize(await kase.run(mockColl));
    const realRes = normalize(await kase.run(realColl));

    // clean up the real collection (mock is in-memory, discarded with the process).
    await realColl.drop().catch(() => {});

    try {
      assert.deepStrictEqual(mockRes, realRes);
      console.log('  ✓ ' + kase.name);
    } catch {
      failures++;
      console.log('  ✗ ' + kase.name);
      console.log('    micromongo:', JSON.stringify(mockRes));
      console.log('    real mongo:', JSON.stringify(realRes));
    }
  }
} finally {
  await realClient.close();
  await mockClient.close();
}

console.log(failures === 0
  ? `\nDifferential conformance: OK (${CASES.length} cases, micromongo == real MongoDB)`
  : `\nDifferential conformance: ${failures}/${CASES.length} DIVERGED from real MongoDB`);
process.exit(failures === 0 ? 0 : 1);

// --- helpers ---
async function prep(client, name, fixture) {
  const db = client.db(TEST_DB);
  const c = db.collection(name);
  await c.deleteMany({}).catch(() => {});
  if (fixture.length) { await c.insertMany(fixture.map((d) => ({ ...d }))); }
  return c;
}
function hashName(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return h;
}
