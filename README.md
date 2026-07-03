[![npm version](https://img.shields.io/npm/v/micromongo.svg)](https://www.npmjs.com/package/micromongo)
[![CI](https://github.com/alykoshin/micromongo/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/alykoshin/micromongo/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/alykoshin/micromongo/badge.svg?branch=master)](https://coveralls.io/github/alykoshin/micromongo?branch=master)
[![node](https://img.shields.io/node/v/micromongo.svg)](https://www.npmjs.com/package/micromongo)
[![license](https://img.shields.io/npm/l/micromongo.svg)](https://github.com/alykoshin/micromongo/blob/master/LICENSE)

# micromongo

MongoDB-like queries over plain JavaScript arrays of objects — **zero database, in-memory**.

📖 **[Full documentation & live playground →](https://alykoshin.github.io/micromongo/)**

An array of objects (documents, in MongoDB's terms) is a very common data structure. If your app
works with this kind of data, you want something lightweight, and you already know MongoDB's query
syntax, `micromongo` lets you run the same `find`/`update`/`aggregate` you'd write against MongoDB —
directly over the array. It runs in **Node and the browser**, ships TypeScript types, and needs no
server.

```js
var mm = require("micromongo");
var orders = [
  { status: "A", qty: 30 },
  { status: "B", qty: 10 },
  { status: "A", qty: 50 },
];

// Functional API — query/aggregate any array directly (linear scan):
mm.find(orders, { status: "A", qty: { $gte: 30 } });
// [ {status:'A',qty:30}, {status:'A',qty:50} ]

mm.aggregate(orders, [{ $group: { _id: "$status", total: { $sum: "$qty" } } }]);
// [ {_id:'A',total:80}, {_id:'B',total:10} ]
```

For larger collections, wrap the data in a `Collection` and add an ordered index (single-field /
multikey / compound) to serve equality, range, sort, `$in`, compound-prefix and `$or` queries from the
index instead of scanning. The functional `mm.find(array, …)` API stays a scan by design (it can't own
the caller's array to keep an index valid); the `Collection` API is the path to scale.

```js
// Collection API — chainable cursors + opt-in indexes (the scale path):
var c = new mm.Collection(orders);
c.createIndex({ status: 1 });
c.find({ status: "A" }).sort({ qty: -1 }).limit(1).toArray();
// [ {status:'A',qty:50} ]  — served via IXSCAN
```

Cursors also **stream** — `for…of`, `for await`, spread, or a Node `.stream()` — pulling one doc at a
time and **stopping early on `limit`** (so `find(q).limit(5)` over a huge array never scans the rest).
When a `sort` is combined with a `limit`, it uses a bounded **top-K** heap (O(K) memory — it never
materializes the full sorted array):

```js
for (const order of c.find({ status: "A" }).limit(5)) {
  /* … */
} // stops after 5
c.find({}).sort({ qty: -1 }).limit(10); // top-10 without buffering all N
```

The library is **written in TypeScript** and ships type definitions (`.d.ts`), so the read/write/
aggregate surface is typed against your document shape. `require('micromongo')` and the `bin` are
unchanged — it's still CommonJS, with ESM (`import`) and a browser IIFE build also provided.

## Installation

```sh
npm install --save micromongo
```

```js
var mm = require("micromongo");
```

## Documentation

The full reference — every method, query/update operator, aggregation stage, the CLI, and a
**live in-browser playground** — lives on the docs site:

> ### 📖 [alykoshin.github.io/micromongo](https://alykoshin.github.io/micromongo/)

Quick links:

- **[Reads](https://alykoshin.github.io/micromongo/#reads)** — `count` `find` `findOne` `distinct` +
  lazy `Cursor`.
- **[Writes & updates](https://alykoshin.github.io/micromongo/#writes)** — `insert*`
  `deleteOne`/`deleteMany` `updateOne`/`updateMany` `replaceOne` `findOneAnd*` `bulkWrite`, with field,
  array, positional (`$`, `$[]`, `$[<id>]`) and bitwise update operators, plus `upsert`.
- **[Query operators](https://alykoshin.github.io/micromongo/#query-operators)** — comparison,
  logical, element, evaluation (`$regex`/`$where`/`$mod`/`$text`/`$expr`), array, bitwise, geospatial.
- **[Aggregation](https://alykoshin.github.io/micromongo/#aggregation)** — every pipeline stage
  feasible in-memory + a pragmatic expression-operator core.
- **[Collections & indexes](https://alykoshin.github.io/micromongo/#collections)** — opt-in ordered
  indexes with a query planner and `explain()`.
- **[Streaming cursors](https://alykoshin.github.io/micromongo/#streaming)** — `for…of` / `for await` /
  Node `.stream()`, with early-termination on `limit` and bounded top-K for `sort` + `limit`.
- **[Extensibility](https://alykoshin.github.io/micromongo/#extend)** — register custom query
  operators via `mm.registerOperator`.
- **[CLI / REPL](https://alykoshin.github.io/micromongo/#cli)** — a mongosh-flavored, in-memory shell.
- **[MongoDB driver mock](https://alykoshin.github.io/micromongo/#mock)** — `micromongo/mock`, a
  drop-in `mongodb`-driver-shaped adapter for testing (see below).
- **[Performance](https://alykoshin.github.io/micromongo/#performance)** — scan-vs-index benchmarks.

Runnable snippets are in the [`examples/`](examples/) directory (`node examples/index.js`); the
[`experiments/`](experiments/) directory shows advanced use — extending the engine at runtime with
custom query/aggregate operators (`registerOperator`); and the tests in [`test/`](test/) double as
executable specs.

Target `node` version: **>= 8**.

## Compatibility

`micromongo` aims for MongoDB-compatible semantics (baseline: MongoDB 3.2 docs, plus selected newer
operators like `$expr`/`$rand`). The **full, per-operator status matrix** — every method, query/update
operator and aggregation stage, with per-operator notes — lives in two always-in-sync places:

- **[Compatibility on the docs site →](https://alykoshin.github.io/micromongo/#compatibility)** (with a
  live ops table that runs the real engine in your browser), and
- **[`planning/compatibility.md`](planning/compatibility.md)** — the generated Markdown table.

Both are verified by the `*-mongodoc.js` tests (ported verbatim from the MongoDB docs) and a differential
harness that replays the same examples against a real MongoDB server.

> **⚠️ Security — `$where`:** `$where` executes arbitrary JavaScript against each document (in Node via
> the `vm` module — which is **not** a security sandbox — and in the browser via `new Function`). Treat
> `$where` as **trusted-input-only**: only pass it queries your own code builds, never a `$where`
> expression assembled from end-user input. For computed queries over untrusted input, prefer a
> value-based query or [`$expr`](https://alykoshin.github.io/micromongo/#expr) (which runs no JS).

## MongoDB driver mock (`micromongo/mock`)

`micromongo/mock` is a drop-in, `mongodb`-driver-shaped adapter backed by the in-memory engine — so
**other projects can run their existing test suites against micromongo instead of a live MongoDB**. It
mirrors the native driver (`MongoClient` / `Db` / `Collection` / cursors / `ObjectId`, async results,
`for await`), so you can point the code under test at it without touching that code — e.g. in Jest:

```js
// jest.config.js
module.exports = { moduleNameMapper: { "^mongodb$": "micromongo/mock" } };
```

See **[the mock adapter docs →](https://alykoshin.github.io/micromongo/#mock)** for the full surface,
the `bson` `ObjectId` handling, and which server-only features are no-ops vs. throw.

## Testing

```sh
npm run _test
```

If you have different needs regarding the functionality, please add a
[feature request](https://github.com/alykoshin/micromongo/issues).

## Credits

[Alexander](https://github.com/alykoshin/)

## Links

[github.com](https://github.com/alykoshin/micromongo) &nbsp;
[npmjs.com](https://www.npmjs.com/package/micromongo) &nbsp;
[docs & playground](https://alykoshin.github.io/micromongo/)

## License

MIT
