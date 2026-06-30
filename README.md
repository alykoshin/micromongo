[![npm version](https://badge.fury.io/js/micromongo.svg)](http://badge.fury.io/js/micromongo)
[![Build Status](https://travis-ci.org/alykoshin/micromongo.svg)](https://travis-ci.org/alykoshin/micromongo)
[![Coverage Status](https://coveralls.io/repos/alykoshin/micromongo/badge.svg?branch=master&service=github)](https://coveralls.io/github/alykoshin/micromongo?branch=master)
[![Code Climate](https://codeclimate.com/github/alykoshin/micromongo/badges/gpa.svg)](https://codeclimate.com/github/alykoshin/micromongo)
[![Inch CI](https://inch-ci.org/github/alykoshin/micromongo.svg?branch=master)](https://inch-ci.org/github/alykoshin/micromongo)

[![Dependency Status](https://david-dm.org/alykoshin/micromongo/status.svg)](https://david-dm.org/alykoshin/micromongo#info=dependencies)
[![devDependency Status](https://david-dm.org/alykoshin/micromongo/dev-status.svg)](https://david-dm.org/alykoshin/micromongo#info=devDependencies)

# micromongo

MongoDB-like queries over plain JavaScript arrays of objects — **zero database, in-memory**.

An array of objects (documents, in MongoDB's terms) is a very common data structure. If your app
works with this kind of data, you want something lightweight, and you already know MongoDB's query
syntax, `micromongo` lets you run the same `find`/`update`/`aggregate` you'd write against MongoDB —
directly over the array.

```js
var mm = require("micromongo");
var orders = [
  { status: "A", qty: 30 },
  { status: "B", qty: 10 },
  { status: "A", qty: 50 },
];

// Functional API — query/aggregate any array directly (linear scan):
mm.find(orders, { status: "A", qty: { $gte: 30 } }); // [ {status:'A',qty:30}, {status:'A',qty:50} ]
mm.aggregate(orders, [{ $group: { _id: "$status", total: { $sum: "$qty" } } }]); // [ {_id:'A',total:80}, {_id:'B',total:10} ]
```

By default a query is a **linear scan** over the array, which is plenty fast for typical in-memory
data. For larger collections, wrap the data in a [`Collection`](#collections-and-indexes) and add an
index (`createIndex(field)` — single-field / multikey / compound) to serve equality, range, sort,
`$in`, compound-prefix and `$or` queries from the index — see [Performance](#performance) for the
measured scan-vs-index numbers. The functional `mm.find(array, …)` API stays a scan by design (it
can't own the caller's array to keep an index valid); the `Collection` API is the path to scale.

```js
// Collection API — chainable cursors + opt-in indexes (the scale path):
var c = new mm.Collection(orders);
c.createIndex({ status: 1 });
c.find({ status: "A" }).sort({ qty: -1 }).limit(1).toArray(); // [ {status:'A',qty:50} ]  — served via IXSCAN
```

The library is now **written in TypeScript** and ships type definitions (`.d.ts`), so the read/write/
aggregate surface is typed against your document shape. `require('micromongo')` and the `bin` are
unchanged — it's still CommonJS.

```ts
import mm from "micromongo"; // needs esModuleInterop; otherwise: import mm = require('micromongo')

interface User {
  _id: number;
  email: string;
  age: number;
}
const users: User[] = [{ _id: 1, email: "a@b.c", age: 30 }];

mm.find(users, { age: { $gt: 18 } }); // inferred return type: User[]
mm.updateOne(users, { _id: 1 }, { $inc: { age: 1 } });

mm.find(users, { age: { $gt: "old" } }); // ✗ compile error — $gt on `age` wants a number
```

### What's supported

- **Reads** — [`count`](#count), [`find`](#find), [`findOne`](#findone), [`distinct`](#distinct),
  and a lazy chainable [`Cursor`](#collections-and-indexes) (`sort`/`skip`/`limit`/`project`).
- **Writes** — [`insert`/`insertOne`/`insertMany`](#insert), [`deleteOne`/`deleteMany`/`remove`](#deleteone),
  [`updateOne`/`updateMany`](#updateone--updatemany), [`replaceOne`](#replaceone), [`findOneAndUpdate`/`findOneAndReplace`/`findOneAndDelete`](#findoneandupdate--findoneandreplace--findoneanddelete),
  and [`bulkWrite`](#bulkwrite). Updates cover field, array, **positional** (`$`, `$[]`, `$[<id>]`),
  and bitwise operators, plus `upsert`.
- **Query operators** — comparison, logical, element, evaluation (`$regex`/`$where`/`$mod`/`$text`),
  array (`$all`/`$elemMatch`/`$size`), bitwise (`$bits*`), geospatial (`$geoWithin`/`$near`/…), and
  [`$expr`](#expr) (use an aggregation expression in a query).
- **Aggregation** — [`aggregate`](#aggregate) with every pipeline stage MongoDB defines that's
  feasible in-memory (`$match`/`$group`/`$project`/`$unwind`/`$lookup`/`$sample`/`$geoNear`/…) and a
  pragmatic expression-operator core (including [`$rand`](#rand)).
- **Collections & indexes** — opt-in ordered indexes (single-field / multikey / compound) with a
  query planner and [`explain()`](#collections-and-indexes).
- **Extensibility** — register custom query operators via [`mm.registerOperator`](#registeroperator).
- A **mongosh-flavored [CLI/REPL](#cli)**.

Every MongoDB-compatible operator/stage is verified by a `*-mongodoc.js` test ported verbatim from the
official MongoDB docs. For the full per-operator status see the
**[compatibility matrix](planning/compatibility.md)**.

Target `node` version: **>= 8**.

## Installation

```sh
npm install --save micromongo
```

```js
var mm = require("micromongo");
```

# Usage

## `count()`

Method `count()` return number of documents matching query.

Syntax:

```js
res = mm.count(array, query);
```

`array` - array of objects

`query` - query object

Following example returns number of elements with `a >= 2` (i.e. `2`):

```js
var mm = require("micromongo");
res = mm.count([{ a: 1 }, { a: 2 }, { a: 3 }], { a: { $gte: 2 } });

// res = 2
```

If `query` is `undefined` or empty object (`{}`), method returns total count of elements in array:

```js
var mm = require("micromongo");
res = mm.count([{ a: 1 }, { a: 2 }, { a: 3 }], {});

// res = 3
```

## `find()`

Method `find()` returns deep copy (with some type limitations) of array's documents matching query with fields matching projection.

If documents in array contains `_id` field, projection follows standard Mongo agreement to include it in output document by default.

```js
var mm = require("micromongo");

inventory = [
  { qty: 10, carrier: { fee: 3 }, price: 3 },
  { qty: 20, carrier: { fee: 2 }, price: 2 },
  { qty: 30, carrier: { fee: 1 }, price: 1 },
];

var query = { qty: { $gt: 20 } };

var res = mm.find(inventory, query);

// { qty: 30, carrier: { fee: 1 }, price: 1 },
```

## `findOne()`

Method `findOne()` returns deep copy (with some type limitations) of first array's documents matching query with fields matching projection.

If documents in array contains `_id` field, projection follows standard Mongo agreement to include it in output document by default.

```js
doc = mm.findOne(array, query, projection);
```

## `deleteOne()`

Removes the first document matching `query` from the array (mutates in place).

```js
var res = mm.deleteOne(array, query);

// { acknowledged: true, deletedCount: 1 }
```

## `deleteMany()`

Removes **all** documents matching `query` from the array (mutates in place).

```js
var res = mm.deleteMany(array, query);

// { acknowledged: true, deletedCount: 2 }
```

## `remove()`

> **Deprecated** — the MongoDB driver dropped `remove()` in v4. Use `deleteOne`/`deleteMany`. Kept
> for back-compat; it returns the **legacy** `{ nRemoved }` shape, not a driver `DeleteResult`.

Removes the first matching document (or all matching, with `justOne: false`).

```js
var res = mm.remove(array, query); // justOne defaults to false → removes all matches
// { nRemoved: 2 }

var res = mm.remove(array, query, true); // justOne: true → first match only
var res = mm.remove(array, query, { justOne: true });
// { nRemoved: 1 }
```

Parameters:

- `options` — boolean, or a document with a boolean `justOne` property. Optional, default `false`
  (remove all matches). A truthy value removes only the first match.

Returns `{ nRemoved }` — the number of deleted documents.

## `insert()`

Convenience wrapper: dispatches to `insertOne` (single document) or `insertMany` (array) based on the
argument. Unlike MongoDB, the array must already exist (`micromongo` doesn't create collections).

```js
mm.insert(array, doc); // → insertOne report
mm.insert(array, [docs]); // → insertMany report
```

Documents are deep-copied in. **`micromongo` does not auto-generate `_id`** (reads stay non-mutating),
so supply your own `_id` if you need one — `insertedId`/`insertedIds` reflect the document's own `_id`.

## `insertOne()`

Appends one document to the array.

```js
var res = mm.insertOne(array, { _id: 1, a: 1 });

// { acknowledged: true, insertedId: 1, insertedCount: 1 }
// (insertedId is the doc's own _id, or undefined if it had none)
```

> **Differs from MongoDB (configurable):** MongoDB auto-generates an `ObjectId` for `_id` when the
> document omits one, and `insertedId` returns that generated id. By default `micromongo` does **not**
> — a document with no `_id` is inserted as-is and `insertedId` is `undefined`. To match MongoDB, set
> `mm.configure({ autoId: true })`: then `insertOne`/`insertMany`/`insert`/`bulkWrite` **and `upsert`**
> generate an `_id` for any document that lacks one (an explicit `_id` is always preserved). The
> generated id is a unique string token (micromongo has no `ObjectId` type).

## `insertMany()`

Appends an array of documents.

```js
var res = mm.insertMany(array, [{ _id: 1 }, { _id: 2 }]);

// { acknowledged: true, insertedCount: 2, insertedIds: { '0': 1, '1': 2 } }
```

- `options.ordered` — `boolean` (default `true`). When `true`, a failing insert stops the batch;
  preceding inserts persist.

## `distinct()`

Returns an array of the distinct values for `field` across documents matching `query` (deep copies;
array-valued fields are flattened, like MongoDB).

```js
mm.distinct([{ a: 1 }, { a: 2 }, { a: 1 }], "a"); // [ 1, 2 ]
mm.distinct([{ tags: ["x", "y"] }, { tags: ["y"] }], "tags"); // [ 'x', 'y' ]
```

## `updateOne()` / `updateMany()`

`updateOne` updates the **first** document matching `query`; `updateMany` updates **all** of them. The
`update` argument must be an **operator document** (`$set`, `$inc`, …) — for a whole-document
replacement use [`replaceOne`](#replaceone). Both mutate the array in place and return a driver-shaped
report.

```js
var res = mm.updateOne(array, { _id: 1 }, { $set: { status: "C" } });
// { acknowledged: true, matchedCount: 1, modifiedCount: 1 }

var res = mm.updateMany(array, { status: "A" }, { $inc: { qty: 1 } });
// { acknowledged: true, matchedCount: 2, modifiedCount: 2 }
```

`modifiedCount` follows MongoDB: a matched document whose values don't actually change contributes `0`.

**Update operators** — field (`$set` `$unset` `$inc` `$mul` `$min` `$max` `$rename` `$currentDate`
`$setOnInsert` `$bit`), array (`$push` `$addToSet` `$pop` `$pull` `$pullAll`, with the `$each`/
`$position`/`$slice`/`$sort` modifiers), and **positional** — the query-bound [`$`](#positional--update-operator),
all-positional `$[]`, and filtered `$[<id>]` (with `arrayFilters`).

**`upsert`** — with `{ upsert: true }`, a no-match update inserts a document built from the query's
equality fields plus the update (and `$setOnInsert`):

```js
var res = mm.updateOne(array, { _id: 7 }, { $set: { x: 1 } }, { upsert: true });
// { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: 7, upsertedCount: 1 }
```

## `replaceOne()`

Replaces the first document matching `query` with `replacement` (a plain document — **no** operators).
Supports `{ upsert: true }`.

```js
var res = mm.replaceOne(array, { _id: 1 }, { _id: 1, status: "Z" });
// { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
```

## `findOneAndUpdate()` / `findOneAndReplace()` / `findOneAndDelete()`

Like the corresponding write, but **return the affected document** rather than a report. By default
they return the document **as it was before** the modification (MongoDB's default), or `null` if
nothing matched.

```js
var before = mm.findOneAndUpdate(array, { _id: 1 }, { $set: { a: 2 } }); // the pre-update doc
var before = mm.findOneAndReplace(array, { _id: 1 }, { _id: 1, a: 9 });
var deleted = mm.findOneAndDelete(array, { _id: 1 }); // the removed doc
```

`findOneAndUpdate`/`findOneAndReplace` accept `{ upsert: true }`.

## `bulkWrite()`

Execute a batch of heterogeneous writes in one call, returning an aggregated `BulkWriteResult`. Each
operation is exactly one of `insertOne` / `updateOne` / `updateMany` / `replaceOne` / `deleteOne` /
`deleteMany`, and delegates to the matching single-write method (so positional `$`, `upsert`,
`arrayFilters` all work inside a batch).

```js
var res = mm.bulkWrite(pizzas, [
  {
    insertOne: { document: { _id: 3, type: "beef", size: "medium", price: 6 } },
  },
  { updateOne: { filter: { type: "cheese" }, update: { $set: { price: 8 } } } },
  { deleteOne: { filter: { type: "pepperoni" } } },
  {
    replaceOne: {
      filter: { type: "vegan" },
      replacement: { type: "tofu", size: "small", price: 4 },
    },
  },
]);
// {
//   acknowledged: true,
//   insertedCount: 1, matchedCount: 2, modifiedCount: 2, deletedCount: 1, upsertedCount: 0,
//   insertedIds: { '0': 3 }, upsertedIds: {}
// }   // matched 2 = the cheese updateOne + the vegan replaceOne
```

- `options.ordered` — `boolean` (default `true`). When `true`, the batch runs in order and **stops at
  the first error** (preceding writes persist). When `false`, every operation is attempted and
  per-operation failures are collected into a `writeErrors: [{ index, errmsg }]` array on the result
  instead of throwing.

## `$expr`

Use an [aggregation expression](#aggregate) inside a query — e.g. to compare two fields of the same
document. A document matches when the expression evaluates truthy. Unlike [`$where`](#where), `$expr`
runs **no arbitrary JS** (no `vm`), so it's safe over computed/untrusted input.

```js
var budget = [
  { _id: 1, budget: 400, spent: 450 },
  { _id: 2, budget: 100, spent: 50 },
];

mm.find(budget, { $expr: { $gt: ["$spent", "$budget"] } });
// [ { _id: 1, budget: 400, spent: 450 } ]   // spent > budget
```

## `$rand`

An aggregation expression operator: `{ $rand: {} }` returns a random float in `[0, 1)`. Used inside an
expression — most often via `$expr` to sample documents:

```js
// keep ~half the documents at random:
mm.find(voters, { $expr: { $lt: [0.5, { $rand: {} }] } });
```

## Positional `$` update operator

The query-bound positional `$` updates the **first array element matched by the query**. The array
field **must** appear in the query condition (MongoDB's requirement) — either directly or via
`$elemMatch`.

```js
var students = [{ _id: 1, grades: [85, 80, 80] }];

mm.updateOne(students, { _id: 1, grades: 80 }, { $set: { "grades.$": 82 } });
// students[0] → { _id: 1, grades: [ 85, 82, 80 ] }   // first 80 (index 1) updated

// into an array of sub-documents, via $elemMatch:
mm.updateOne(
  arr,
  { _id: 4, grades: { $elemMatch: { grade: 85 } } },
  { $set: { "grades.$.std": 6 } },
);
```

(For updating _every_ element use `$[]`; for a filtered subset use `$[<id>]` with `arrayFilters`.)

## `aggregate()`

```js
var res = mm.aggregate(array, stages);
```

`stages` — array of aggregation pipeline stages. `aggregate` deep-copies the input, then folds each
stage's output into the next, so it's non-mutating (it never touches the source array).

**Every aggregation stage MongoDB defines that's feasible in-memory is implemented:** `$match`,
`$project`, `$limit`, `$skip`, `$sort`, `$unwind`, `$group` (with accumulators), `$addFields`/`$set`,
`$unset`, `$count`, `$sortByCount`, `$replaceRoot`/`$replaceWith`, `$sample`, `$redact`, `$geoNear`,
`$lookup`, `$out`, `$indexStats`. Computed-field stages (`$project`/`$group`/`$addFields`/`$redact`)
use a pragmatic expression-operator core (arithmetic/string/comparison/conditional/boolean/array +
group accumulators, plus [`$rand`](#rand)). See the
[compatibility matrix](planning/compatibility.md) for the per-operator detail.

```js
mm.aggregate(orders, [
  { $match: { status: "A" } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 5 },
]);
```

`$unwind` accepts the shorthand or the full form:

```js
mm.aggregate(array, [{ $unwind: "$customer.items" }]);

mm.aggregate(array, [
  {
    $unwind: {
      path: "$customer.items",
      includeArrayIndex: "idx",
      preserveNullAndEmptyArrays: true,
    },
  },
]);
```

## Collections and indexes

For larger data (or when you want a stateful, MongoDB-driver-shaped object), wrap the array in a
`Collection`. It owns the array, forwards reads/writes/aggregations to the same engine, and adds
**opt-in ordered indexes**:

```js
var orders = new mm.Collection([
  /* … */
]);

orders.createIndex({ status: 1 }); // single-field / multikey / compound
orders.find({ status: "A" }).sort({ qty: -1 }).limit(2).toArray(); // lazy Cursor
orders.find({ status: "A" }).explain(); // { stage: 'IXSCAN', … } — does not run the query
```

The index is a **pure accelerator, safe by construction**: it only ever supplies a candidate
_superset_ that the match engine re-filters, so it never changes results — only speed. Strip every
index and queries return identical answers. It serves equality, range (`$gt`/`$gte`/`$lt`/`$lte`),
sort, `$in`, array (multikey), compound-prefix, and `$or` (when every branch is index-served);
everything else transparently falls back to the scan. See [Performance](#performance) for numbers.

`mm.collection(name, array)` / `mm.db.<name>` register named collections (so `$out`/`$lookup` can
resolve a collection by name).

## `registerOperator()`

Extend the query engine with a custom operator (the blessed extension point):

```js
mm.registerOperator(
  "post",
  "$isEven",
  function (value /* the field's value */) {
    return value % 2 === 0;
  },
);

mm.find([{ n: 1 }, { n: 2 }], { n: { $isEven: true } }); // [ { n: 2 } ]
```

`kind` is `'post'` (field-level comparison), `'pre'` (whole-document/logical), or `'preprocess'`
(run once before matching). A registered operator — including yours — is visible immediately.

# Examples

## count()

```js
//var mm = require('../');
var mm = require("micromongo");

var array, query, res;

array = [{ a: 1 }, { a: 2 }, { a: 3 }];

query = { a: { $gte: 2 } };

res = mm.count(array, query);
console.log(res);

// 2

query = {};

res = mm.count(array, query);
console.log(res);

// 3
```

## Example find()

```js
//var mm = require('../');
var mm = require("micromongo");

var array, query, projection, res;

array = [
  { qty: 10, price: 10 },
  { qty: 10, price: 0 },
  { qty: 20, price: 10 },
  { qty: 20, price: 0 },
  { qty: 30, price: 10 },
  { qty: 30, price: 0 },
];

query = { $or: [{ quantity: { $eq: 20 } }, { price: { $lt: 10 } }] };

projection = { qty: 1 };

res = mm.find(array, query, projection);
console.log(res);

// [ { qty: 10 }, { qty: 20 }, { qty: 30 } ]
```

You can find these examples in `examples/` subdirectory.
To run all the examples at once you may start `node examples\index.js`.

For more examples please also have a look on tests in `tests/` subdirectory.

If you have different needs regarding the functionality, please add a [feature request](https://github.com/alykoshin/micromongo/issues).

# CLI

`micromongo` ships a command-line tool ([`cli.js`](cli.js)) whose invocation mirrors
[`mongosh`](https://www.mongodb.com/docs/mongodb-shell/reference/options/), minus the parts that
imply a server (micromongo is in-memory). Since there's no server to connect to, instead of a
connection string you load local JSON arrays as collections with `--load file.json:name`. `--load` is
**repeatable** — pass it once per collection to register several at startup (handy for `$lookup`).

### Interactive shell (bare invocation, like `mongosh`)

```sh
micromongo --load orders.json:orders

# repeat --load to register multiple collections:
micromongo --load orders.json:orders --load customers.json:customers
```

Drops you into a REPL where `db.<collection>` resolves a `Collection`, with tab-completion of
collection/method names:

```
micromongo> show collections
[ { name: 'orders', count: 5 }, { name: 'customers', count: 12 } ]
micromongo> db.orders.find({ status: 'A' }).sort({ qty: -1 }).limit(2).toArray()
[ { _id: 3, status: 'A', qty: 90 }, … ]
micromongo> db.orders.createIndex({ status: 1 })
{ collection: 5 docs, indexes: [status] }
micromongo> db.orders.find({ status: 'A' }).explain()
{ stage: 'IXSCAN', indexed: true, exact: true, plan: { index: 'status_1', op: 'eq', usedHash: true }, … }
micromongo> db.orders.aggregate([ { $group: { _id: "$status", n: { $sum: 1 } } } ])
micromongo> db.orders.aggregate([ { $lookup: { from: 'customers', localField: 'custId', foreignField: '_id', as: 'cust' } } ])
```

Shell commands: `show collections` / `show dbs`, `use <name>` (single namespace — cosmetic),
`load("file.json","name")`, `save("name","file.json")`, `help`, `exit`. Anything else runs as
JavaScript against the live API (`mm.configure(...)`, `mm.registerOperator(...)`, … all work).

### One-shot `--eval` (like `mongosh --eval`)

Evaluate one or more expressions; repeatable, and only the **last** result prints (mongosh's rule):

```sh
micromongo --eval "db.orders.find({status:'A'}).toArray()" --load orders.json:orders
micromongo --eval "db.orders.createIndex({status:1})" \
           --eval "db.orders.find({status:'A'}).explain()" --load orders.json:orders
micromongo --json --eval "db.orders.find({status:'B'}).toArray()" --load orders.json:orders
```

### Run a script file (`--file` / `-f`, like `mongosh --file`)

```sh
micromongo --file report.js --load orders.json:orders
```

The script runs in the same sandbox (`db`, `mm`, `print()` in scope). Add `--shell` to drop into the
interactive shell after `--eval`/`--file`; `--quiet` suppresses the startup banner.

See [`examples/cli/run.sh`](examples/cli/run.sh) and [`examples/cli/report.js`](examples/cli/report.js)
for runnable examples.

# Testing

For unit tests run:

```sh
npm run _test
```

# Performance

A bare query (the functional `mm.*` API, or a `Collection` with no index) is a linear scan — O(n) in
the array length. That's fast for typical in-memory sizes; the numbers below show where it stands, and
the [indexed-lookups](#indexed-lookups-collection-vs-linear-scan) section shows how a `Collection`
index accelerates equality (→ O(1)), range, and sort queries for larger data.

> **Measurement system:** AMD Ryzen 7 5800HS (16 logical cores) · 31 GB RAM · Node v22.16.0 · Windows.
> Numbers are from one run, best of 5, and vary between runs/machines — read the **shape** (how each
> column grows with size), not the absolute values.

Linear-scan timings for `count`, `find`, and `aggregate $sort` over arrays of `1 000` / `10 000` /
`100 000` elements (whole-operation latency, ms):

```
  size      count (ms)   find (ms)   $sort (ms)
  ----------------------------------------------
  1 000      0.39         1.15        1.54
  10 000     2.32         6.29       12.77
  100 000   21.41        63.33      127.91
```

Each scales ~**10× per 10×** more data, as expected for an O(n) scan (`$sort` adds the O(n·log n)
comparison pass). `count` is cheapest (no projection/copy); `find` and `$sort` also deep-copy the
result. For single-equality, range, and sort queries this is exactly what a `Collection` index
removes — see [Indexed lookups](#indexed-lookups-collection-vs-linear-scan) below.

`$where` is far slower — it runs JS in a Node `vm` per document:

```
  size      $where (ms)
  ---------------------
  1 000      534
  5 000     2527
```

These cases live in [`test/performance.js`](test/performance.js) (the `10 000`/`100 000` rows are
`it.skip`-ped by default — un-skip to reproduce). The `#performance` console output prints via
`npm run _test`; cases assert only loosely, since wall-clock assertions are flaky on shared machines.

## Indexed lookups (Collection) vs. linear scan

The functional API (`mm.find(array, …)`) is **always** a linear scan — it can't be otherwise, because
the caller owns the array and mutates it directly, so micromongo can't keep an index valid (see the
[Indexes section in planning/compatibility.md](planning/compatibility.md)). A [`Collection`](planning/architecture.md),
which _owns_ its data, can opt into an **ordered index** (single-field / multikey / compound) that
serves equality, range, sort, `$in`, compound-prefix and `$or` queries from the index instead of
scanning:

```js
var c = new mm.Collection(bigArray);
c.createIndex("sku"); // build the ordered index once
c.findOne({ sku: "sku-42" }); // equality → O(1) hash hit
c.find({ sku: { $gte: "x" } }); // range   → binary-search slice of the index
c.find({}).sort({ sku: 1 }); // sort    → returned in index order, no sort pass
c.find({ status: { $regex: /^a/ } }); // unindexable → transparently falls back to a scan
```

Measured by [`test/performance-index.js`](test/performance-index.js): an index-less `Collection`
(linear scan) vs. one with `createIndex('sku')`, timed with `process.hrtime.bigint()` (nanosecond
resolution), best of several warmed-up runs to shed GC/scheduler noise. Reproduce with
`node ./node_modules/mocha/bin/_mocha test/performance-index.js`.

> **Measurement system:** AMD Ryzen 7 5800HS (16 logical cores) · 31 GB RAM · Node v22.16.0 · Windows.
> Numbers are from one run and vary slightly between runs and machines — read the **shape** (how each
> column scales with size), not the absolute values.

**Single-equality `findOne`** (lookups spread evenly across the array, so the average scan depth grows
with `n`):

```
  Collection size  scan (µs/lookup)  indexed (µs/lookup)  speedup
  ----------------------------------------------------------------
  1 000             126.57            2.74                 46x
  10 000           1107.03            1.91                579x
  100 000         10707.10            1.17               9138x
```

The O(1)-vs-O(n) story in numbers: scan cost grows ~**10× per 10×** more data (~100 µs → ~1 ms →
~10 ms per lookup), while the indexed lookup stays ~1–3 µs **regardless of collection size** (a single
hash hit) — so the speedup itself scales with the data, from ~50× at 1 000 docs to ~9 000× at 100 000.

**Range `$gte` (≈top 1%)** — a binary-search slice of the ordered index instead of a full scan:

```
  size      scan (ms)   indexed (ms)   speedup
  ---------------------------------------------
  1 000      0.746       0.034          22x
  10 000     2.615       0.094          28x
  100 000   27.896       0.830          34x
```

**Full sort by the indexed field** — returned in index order, skipping the comparison sort:

```
  size      scan (ms)   indexed (ms)   speedup
  ---------------------------------------------
  1 000      1.928       0.940           2x
  10 000    18.200       6.812           3x
  100 000  263.616     111.824           2x
```

(Sort speedup is bounded — both paths still materialize/copy every doc; the index just removes the
O(n·log n) comparison pass, not the O(n) copy.)

Caveats: the index serves equality, range (`$gt`/`$gte`/`$lt`/`$lte`), sort on an indexed field,
`$in`, array-field (multikey) equality/range, compound-prefix equality, and `$or` when every branch is
index-served. **Everything else transparently falls back to the scan** — `$regex`, `$ne`, `$exists`,
`$where`, mixed/un-indexed fields, and the aggregation pipeline — returning identical results.
Maintenance is **rebuild-after-write** (provably consistent; O(n) per write, so best for read-heavy
use), and the `Collection` must be the sole writer (mutating `toArray()` directly bypasses it;
`reindex()` recovers). Indexes are opt-in and never change _what_ a query returns — only how fast.
Use `c.find(q).explain()` to see the chosen plan (`COLLSCAN`/`IXSCAN`/`IXSCAN+FILTER`/`OR`).

# Compatibility matrix

`micromongo` aims for MongoDB-compatible semantics (baseline: MongoDB 3.2 docs, plus selected newer
operators like `$expr`/`$rand`). The **full, per-operator status table lives in
[`planning/compatibility.md`](planning/compatibility.md)** — it's the canonical, maintained source and is
verified by the `*-mongodoc.js` tests. A high-level summary:

| Area                        | Status                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reads**                   | `count` `find` `findOne` `distinct` + lazy `Cursor` (`sort`/`skip`/`limit`/`project`) — ✅                                                          |
| **Writes**                  | `insert*` `deleteOne`/`deleteMany`/`remove` `updateOne`/`updateMany` `replaceOne` `findOneAnd*` `bulkWrite` — ✅                                    |
| **Comparison**              | `$eq` `$ne` `$gt` `$gte` `$lt` `$lte` `$in` `$nin` — ✅ (`$ne`/`$nin` use strict, non-deep compare)                                                 |
| **Logical**                 | `$and` `$or` `$nor` `$not` — ✅                                                                                                                     |
| **Element**                 | `$exists` `$type` — ✅ (`$type` uses JS types, not BSON type numbers)                                                                               |
| **Evaluation**              | `$mod` `$regex` `$where` `$text` `$expr` — ✅ (`$regex` needs a `RegExp` object; `$where` runs JS — see security note)                              |
| **Array**                   | `$all` `$elemMatch` `$size` — ✅                                                                                                                    |
| **Bitwise**                 | `$bitsAllSet` `$bitsAnySet` `$bitsAllClear` `$bitsAnyClear` — ✅                                                                                    |
| **Geospatial**              | `$geoWithin` `$geoIntersects` `$near` `$nearSphere` (legacy + GeoJSON, planar/haversine; no spatial index) — ✅                                     |
| **Projection**              | inclusion/exclusion,`_id` default, `$slice` `$elemMatch` `$` `$meta:"textScore"` — ✅                                                               |
| **Update operators**        | field, array (+ modifiers), positional`$`/`$[]`/`$[<id>]`, `$bit`, `upsert` — ✅                                                                    |
| **Aggregation stages**      | every stage feasible in-memory (`$match`/`$group`/`$project`/`$unwind`/`$lookup`/`$sample`/`$geoNear`/…) — ✅                                       |
| **Aggregation expressions** | pragmatic core (arithmetic/string/comparison/conditional/boolean/array + accumulators,`$rand`); date/type-conversion/set operators are partial — ⚠️ |
| **Not supported**           | `mapReduce`, legacy `update`, `$jsonSchema`, and server/storage-bound methods (`stats`/`drop`/sharding/…) — by design (no server)                   |

If documents contain an `_id` field, projection follows the standard Mongo convention of including
`_id` by default.

> **⚠️ Security — `$where`:** `$where` executes arbitrary JavaScript against each document via Node's
> `vm` module. **`vm` is not a security sandbox** (Node's own docs say so; a `$where` string can
> escape to the host process). The `whereTimeout` only caps synchronous runaway loops, not escapes.
> So treat `$where` as **trusted-input-only** — only pass it queries your own code builds, never a
> `$where` expression assembled from end-user input. This matches MongoDB's posture (server-side JS is
> disabled by default). For _computed_ queries over untrusted input, prefer a value-based query or
> [`$expr`](#expr) (which runs no JS) instead of `$where`.

## Credits

[Alexander](https://github.com/alykoshin/)

# Links to package pages:

[github.com](https://github.com/alykoshin/micromongo) &nbsp; [npmjs.com](https://www.npmjs.com/package/micromongo) &nbsp; [travis-ci.org](https://travis-ci.org/alykoshin/micromongo) &nbsp; [coveralls.io](https://coveralls.io/github/alykoshin/micromongo) &nbsp; [inch-ci.org](https://inch-ci.org/github/alykoshin/micromongo)

## License

MIT
