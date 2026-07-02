# MongoDB compatibility

What `micromongo` supports today versus current MongoDB, across three API dimensions —
**collection methods**, **query/projection operators**, and **aggregation** — plus the
broader MongoDB feature areas that are out of scope.

Status is derived from the live MongoDB manual cross-referenced against the implementation
(`src/crud/match/`, `src/crud/project.ts`, `src/aggregate/index.ts`). Reflects `master`
(v0.3.1); regenerate when operators or methods change.

> **Extending the query engine.** Operators are registered in `src/crud/match/registry.ts`; add a
> custom one with `mm.registerOperator(kind, name, fn)` (`kind` ∈ `'pre'`/`'post'`/`'preprocess'`).
> Built-ins self-register from `src/crud/match/operators/`.

> For where the library _could_ go next — a `Collection`/`Cursor` API, indexes, the
> refactor that enables them — see [roadmap.md](roadmap.md).

> **Doc-example test coverage.** Every implemented operator/stage that has an official MongoDB
> doc example is tested verbatim against it in a `*-mongodoc.js` file (see the CLAUDE.md rule).
> Exceptions, where MongoDB's docs provide **no portable before/after example** to port:
> `$unset` (doc shows only the result report, not document state) and `$currentDate` (yields a
> nondeterministic `Date`). These are covered by hand-written unit tests in
> `test/crud/update-operators.js` instead. (`$setOnInsert` _does_ have a portable upsert example and
> is ported verbatim in `test/crud/update-upsert-mongodoc.js`.)

**Contents**

- [Legend](#legend)
- [Summary at a glance](#summary-at-a-glance)
- [Collection methods](#collection-methods)
  - [Mutation contract](#mutation-contract)
- [Query & projection operators](#query--projection-operators)
- [Text search (`$text` + `$meta`)](#text-search-text--meta)
- [Update operators](#update-operators)
- [Aggregation](#aggregation)
- [Compatibility matrix — auto-generated](#compatibility-matrix--auto-generated)
- [MongoDB driver mock (`micromongo/mock`)](#mongodb-driver-mock-micromongomock)
- [Known bugs](#known-bugs)
- [Beyond CRUD & aggregation: the rest of MongoDB](#beyond-crud--aggregation-the-rest-of-mongodb)

---

## Legend

| Symbol | Meaning                                                          |
| ------ | ---------------------------------------------------------------- |
| ✅     | Implemented and exercised by tests                               |
| ⚠️     | Implemented with documented limitations                          |
| ➕     | micromongo-specific (no MongoDB equivalent) — extension or alias |
| ❌     | Not present in the code                                          |
| N/A    | Not meaningful for plain in-memory arrays (no DB engine)         |

> **Scope note.** An **absent** stage/operator throws at runtime (`'Invalid stage operator'` for a
> stage, an unknown-operator error for a query/update operator) — it's not silently ignored. There are
> currently **no stubs** (registered-but-`throw`ing placeholders): every operator/stage the engine
> registers is fully implemented.

---

## Summary at a glance

> For exact, always-current per-operation status and counts, see the **[auto-generated compatibility
> matrix](#compatibility-matrix--auto-generated)** below (read live from the registries). This hand-curated
> roll-up gives the shape at a glance.

<!-- GENERATED:summary -->
_Roll-up of the detailed tables below — derived from the same manifest, so it can't drift. Projection operators (`$slice`/`$elemMatch`/`$`/`$meta`) live in `src/crud/project.ts` (outside the match registries) and are covered in the [Query & projection](#query--projection-operators) section, not this matrix._

| Bucket | Collection methods | Query operators | Update operators | Aggregation stages | Aggregation expr. operators |
|---|---|---|---|---|---|
| ✅ Implemented | `Collection` `Cursor` `bulkWrite` `collection` `configure` `copyTo` `count` `countDocuments` `createIndex` `createIndexes` `deleteMany` `deleteOne` `distinct` `drop` `dropIndex` `dropIndexes` `estimatedDocumentCount` `find` `findOne` `findOneAndDelete` `findOneAndReplace` `findOneAndUpdate` `getIndexes` `indexExists` `indexInformation` `indexStats` `indexes` `insert` `insertMany` `insertOne` `listIndexes` `registerOperator` `reindex` `remove` `replaceOne` `toArray` `updateMany` `updateOne` | `$and` `$bitsAllClear` `$bitsAllSet` `$bitsAnyClear` `$bitsAnySet` `$box` `$center` `$centerSphere` `$comment` `$elemMatch` `$eq` `$exists` `$expr` `$geoWithin` `$geometry` `$gt` `$gte` `$in` `$lt` `$lte` `$maxDistance` `$minDistance` `$mod` `$near` `$nearSphere` `$nor` `$not` `$options` `$or` `$polygon` `$size` `$uniqueDocs` | `$addToSet` `$bit` `$inc` `$max` `$min` `$mul` `$pop` `$pull` `$pullAll` `$push` `$rename` `$set` `$setOnInsert` `$unset` | `$addFields` `$count` `$geoNear` `$group` `$indexStats` `$limit` `$lookup` `$match` `$out` `$project` `$redact` `$replaceRoot` `$replaceWith` `$sample` `$set` `$skip` `$sortByCount` `$unset` | `$abs` `$add` `$and` `$arrayElemAt` `$ceil` `$cmp` `$concat` `$concatArrays` `$cond` `$divide` `$eq` `$filter` `$floor` `$gt` `$gte` `$ifNull` `$in` `$lt` `$lte` `$map` `$mergeObjects` `$mod` `$multiply` `$ne` `$not` `$or` `$pow` `$rand` `$reverseArray` `$round` `$size` `$split` `$sqrt` `$strLenCP` `$substr` `$substrCP` `$subtract` `$switch` `$toLower` `$toUpper` `$trim` |
| ⚠️ Implemented w/ limits | `aggregate` | `$all` `$geoIntersects` `$ne` `$nin` `$regex` `$text` `$type` `$where` | `$currentDate` | `$sort` `$unwind` | — |
| ❌ Absent | `createSearchIndex` `createSearchIndexes` `dropSearchIndex` `initializeOrderedBulkOp` `initializeUnorderedBulkOp` `isCapped` `listSearchIndexes` `options` `rename` `updateSearchIndex` `watch` | `$jsonSchema` `$rand` | — | `$bucket` `$bucketAuto` `$changeStream` `$changeStreamSplitLargeEvent` `$collStats` `$densify` `$documents` `$facet` `$fill` `$graphLookup` `$listSampledQueries` `$listSearchIndexes` … _(+8 more — see table below)_ | `$accumulator` `$acos` `$acosh` `$addToSet` `$allElementsTrue` `$anyElementTrue` `$arrayToObject` `$asin` `$asinh` `$atan` `$atan2` `$atanh` … _(+108 more — see table below)_ |
<!-- /GENERATED:summary -->

**The headline state vs. current MongoDB:**

- **Writes/updates exist** — `updateOne`/`updateMany`/`replaceOne`/`findOneAnd*`/`bulkWrite` plus
  field, array, the query-bound positional `$`, all-positional `$[]`/filtered `$[<id>]` (with
  `arrayFilters`), and bitwise (`$bit`) update operators, and `upsert` (`upsertedId`/`upsertedCount`,
  live `$setOnInsert`). `bulkWrite` batches all six write kinds with `ordered` true/false semantics.
- **Geospatial, bitwise, `$sample`, `$geoNear`, and the projection operators are now implemented**
  (this was a large batch of former stubs). Geo supports legacy + GeoJSON with planar/haversine
  distance (no spatial index).
- **Aggregation expressions exist** — the expression engine powers `$group` (+ accumulators),
  computed `$project`, and `$addFields`/`$set`. Pragmatic operator core (no date/type-conversion/
  set operators yet).
- **No stubs remain** — `$redact`, `$lookup`, `$indexStats`, `$text`/`$meta`, and `$out` all shipped.
  Every aggregation stage micromongo supports is implemented; the only unsupported stages are absent
  by design (see the generated stages table below).
- `$expr` (query) and `$rand` (aggregation expression) are now implemented (both reuse the
  aggregation expression engine — `$expr` matches a doc on the truthiness of an expression,
  `$rand` returns a random float in `[0,1)`). `$jsonSchema` remains deferred by choice (a large
  validation dialect, out of scope for a matcher — see [roadmap.md](roadmap.md)). `$type` and `$regex`
  diverge from the modern spec (JS types vs. BSON types; `RegExp`-object requirement).

The sections below give the per-item detail behind this matrix.

---

## Collection methods

The public API in [`src/index.ts`](../src/index.ts). Unlike the MongoDB driver, every method
is **synchronous** and takes the array as its **first argument** (`mm.find(array, query, …)`) —
there is no `Collection` object, cursor, or Promise.

### Mutation contract

micromongo follows a single consistent rule, mirroring MongoDB's own read/write split:

|                       | Methods                                                                       | Source array         | Return value                                                                                   |
| --------------------- | ----------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| **Reads** (pure)      | `find` · `findOne` · `count` · `aggregate` · `copyTo`                         | **never touched**    | a new value (deep-copied docs, or a number)                                                    |
| **Writes** (in-place) | `insertOne` · `insertMany` · `insert` · `deleteOne` · `deleteMany` · `remove` | **mutated in place** | a small report object —`{ nInserted }` / `{ deletedCount }` / `{ nRemoved }`, **not** the data |

Guarantees, verified empirically:

- **Reads are deep-immutable.** The objects a read returns are full deep copies — mutating a
  returned document (at any nesting depth, including nested objects and arrays) does **not**
  affect the source. `aggregate` deep-copies the source up front (`copyTo` → `deepAssign`) so
  even its in-place `$sort` cannot touch the input.
- **Writes mutate the array you passed**, because that array _is_ the collection
  (`mm.deleteMany(myArray, q)` reads as "delete from `myArray`"). They return an
  acknowledgement, mirroring the driver — so you don't reassign; `myArray` is already updated.

Why this split (and not all-immutable): the library exists to be **MongoDB-shaped over a
caller-owned array**. Mongo's `find()` is pure and its `insertOne()`/`deleteMany()` mutate the
collection and return `{insertedId}`/`{deletedCount}`. Imperatively-named functions (`insert`,
`delete`) mutating in place is the least-surprising behavior; making writes return a new array
instead would silently leave the caller's `myArray` stale. If you want copy-on-write semantics,
that belongs at a future `Collection` layer that _owns_ its data — see
the design constraint that indexes require a data-owning Collection — not the functional API.

### Implemented / absent

The full per-method table — every MongoDB collection method, its status (✅ / ⚠️ / ❌ / ➕
micromongo-specific), return shape, and notes — is
[**generated below**](#collection-methods) from the live `mm.*` **and `Collection`** surfaces ⋈
MongoDB's method set, so it can't drift from what the engine actually exports. Highlights: reads
(`find`/`findOne`/`count`/`countDocuments`/`estimatedDocumentCount`/`distinct`) and the full write
family (`insert*`/`delete*`/`update*`/`replaceOne`/`findOneAnd*`/`bulkWrite`) are implemented;
`update` (legacy), `mapReduce`, and server/storage-bound methods (`stats`/`rename`/watch/…) are out of
scope (no server). The index family (`createIndex(es)`/`dropIndex(es)`/`indexes`/`listIndexes`/
`indexExists`/`indexInformation`) exists **on `Collection`** only (see
[Indexes](#indexes-collection-only)) — indexes need a data-owning Collection to stay valid, so they're
not on the functional `mm.*` API. (`drop`/`countDocuments`/`estimatedDocumentCount` are on both.)

> **Update operators are implemented** — field, array, positional, and bitwise.
> `updateOne`/`updateMany`/`replaceOne` accept an operator document; the families are:
> field (`$set` `$unset` `$inc` `$mul` `$min` `$max` `$rename` `$currentDate` `$setOnInsert` `$bit`),
> array (`$push` `$pull` `$pop` `$addToSet` `$pullAll` + `$each`/`$slice`/`$sort`/`$position`), and
> positional: the query-bound `$` (first array element matched by the query — the array field must
> appear in the query, or a `$elemMatch` on it), all-positional `$[]`, and filtered `$[<id>]` (with
> `arrayFilters`). `{ upsert: true }` inserts on no match (with `upsertedId`/`upsertedCount` and live
> `$setOnInsert`). The query/projection operator tables below cover **query** operators only.

### Indexes (Collection-only)

Indexes are an **opt-in accelerator on a `Collection`** — _not_ on the functional `mm.*` API. The
functional API (`mm.find(array, …)`) is and stays **unindexed by design**: it operates on a
caller-owned array it can't observe mutations to, so an index there couldn't be kept valid. Indexes
require the encapsulation a `Collection` provides (it owns its data and is the sole writer).

One **ordered** structure (sorted entries + binary search) backs every index _type_, mirroring
MongoDB (single-field / multikey / compound are one structure with different metadata). A small
**query planner** routes each query to the best applicable index, or to a scan.

```js
var c = new mm.Collection(bigArray);
c.createIndex("userId"); // single-field ordered index
c.createIndex({ a: 1, b: 1 }); // compound index
c.createIndex("tags"); // multikey (auto-detected when values are arrays)

c.find({ userId: 42 }); // equality      → index
c.find({ age: { $gt: 30, $lte: 50 } }); // range         → index (binary-search slice)
c.find({}).sort({ age: 1 }); // sort          → index order (no in-memory sort)
c.find({ tags: "x" }); // array contains → multikey index
c.find({ userId: { $in: [1, 2, 3] } }); // $in           → union of index lookups
c.find({ a: 1, b: 5 }); // compound prefix → index, then re-filter
c.find({ $or: [{ userId: 1 }, { age: { $gt: 9 } }] }); // $or  → union of per-branch index plans

c.find({ s: { $regex: /^a/ } }); // unindexable    → linear scan (same result)
```

**What the index serves:** single-field **equality** and **range** (`$gt/$gte/$lt/$lte`), **sort** on
an indexed field, `$in`, **array-field (multikey)** equality/range, **compound-prefix** equality, and
`$or` when every branch is index-served. **Everything else falls back to the linear scan** — `$regex`,
`$ne`, `$exists`, `$where`, mixed/un-indexed fields, the aggregation pipeline. The planner is **safe by
construction**: an index only ever supplies a _candidate superset_, which the full `match()` re-filters
unless the plan is exact — so an index can never change results, only speed.

**Consistency:** the index is **rebuilt after every `Collection` write** — O(n) but guaranteed correct
(an update that changes the indexed value re-places the entry). **Invariant:** the `Collection` must be
the _sole writer_ — mutating `toArray()` directly bypasses maintenance (call `reindex()` to recover).
Non-indexed Collections pay nothing. `$indexStats` reports per-index usage (MongoDB-style name, e.g.
`a_1_b_1`) via `Collection.aggregate`. A **single-field** index also keeps a value hash for O(1)
equality alongside the sorted entries (range/sort use the sorted entries). **`explain()`** —
`Collection.find(q).explain()` returns the chosen plan (index used / `COLLSCAN` / `IXSCAN`, exact vs
re-filtered, candidate count) without running the query.

**Measured win** ([`test/performance-index.js`](../test/performance-index.js)): equality ~120 µs scan →
~0.3–1 µs indexed at 100k docs; range (~top 1%) ~36–91×; full sort ~4–6× (the index removes the sort;
the result still deep-copies n docs). See the [README → Performance](../README.md#performance).

**Not indexed** (by design — see [roadmap.md](roadmap.md) → Deferred): the Mongo index
_types_ that need a server (hashed-for-sharding, TTL) or a specialized structure (text/geo/wildcard);
those _queries_ still work by scanning. A hash index purely for local equality speed is a proposed
micro-optimization. `unique`/`partial`/`sparse` index _properties_ are not implemented.

---

## Query & projection operators

The per-operator status and notes for **every** query operator (comparison, logical, element,
evaluation, array, bitwise, geospatial) live in the
[**generated Query-operators table**](#query-operators) — computed from the live match registries in
[`src/crud/match/registry.ts`](../src/crud/match/registry.ts) (`preOperators`, `postOperators`,
`preprocessOps`) ⋈ MongoDB's query-operator set. This section keeps only the notes that don't fit a
per-operator row:

- **Comparison / logical.** `$and`/`$or`/`$nor` are whole-document `pre`-operators; `$not` is a
  field-level `post`-operator. `$ne`/`$nin` use a strict (non-deep) compare.
- **Bitwise.** All four (`$bitsAllSet`/`$bitsAnySet`/`$bitsAllClear`/`$bitsAnyClear`) take a numeric
  bitmask **or** an array of bit positions; `BinData` masks are unsupported and the field value must be
  a number to match.
- **Geospatial** ([`src/crud/geo.ts`](../src/crud/geo.ts)). Legacy coordinate pairs `[x, y]` and
  GeoJSON; planar and spherical (haversine) distance; **coordinate order is `[longitude, latitude]`**.
  No `2d`/`2dsphere` index, no `BinData`. `$near`/`$nearSphere` filter but do **not** auto-sort by
  distance — use the `$geoNear` aggregation stage for ordering.
- **Projection.** Beyond inclusion/exclusion (`{ field: 1 }`/`{ field: 0 }`, `_id`-by-default), the
  specialized operators `$slice`, `$elemMatch`, positional `$`, and `$meta: "textScore"` are
  implemented in [`src/crud/project.ts`](../src/crud/project.ts). `$meta: "indexKey"` is not.

---

## Text search (`$text` + `$meta`)

`$text` ([`src/crud/text.ts`](../src/crud/text.ts)) does in-memory full-text search across all
string fields of each document — no index, tokenized per query (linear scan, matching the
library's unindexed design). `$meta: "textScore"` projects a relevance score. Three fidelity
modes, selected via `mm.configure({ textSearch: <mode> })`:

| Mode            | Default | Behavior                                                                                                                                    |
| --------------- | :-----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `'lightweight'` |   ✅    | Lowercase + tokenize on non-word chars,**exact-token** matching, term-frequency score. No linguistic processing. Cheapest, dependency-free. |
| `'stemming'`    |         | Adds diacritic folding (`café`≈`cafe`), stop-word removal, and a **vendored Porter stemmer** (so `bake` matches `baking`).                  |
| `'exact'`       |         | Same matching as`'stemming'`, plus a score derived from MongoDB's open-source `fts_spec.cpp` coefficient (`0.5·count/numTokens + 0.5`).     |

Supported query syntax: OR terms (`"coffee shop"`), phrases (`"\"coffee shop\""`), negation
(`-word`).

### ⚠️ Limitations (documented divergence from server MongoDB)

- **No text index / no persistence** — tokenization runs per query.
- **`'lightweight'` does not stem or drop stop words** — `run` won't match `running`.
- The **Porter stemmer** (`'stemming'`/`'exact'`) is the classic English Porter algorithm —
  Snowball-English is _based on_ it but they are not byte-identical, so a few words stem
  differently from MongoDB.
- **English only** — no per-language stop-words/stemming; `$language`, `$caseSensitive`,
  `$diacriticSensitive` options are not modeled.
- **`$meta: "textScore"` values do NOT equal MongoDB's.** Even `'exact'` mode _approximates_ the
  formula (field weights, exact normalization, and inverse-document-frequency are not modeled).
  The score gives a **sensible relative ordering**, not Mongo's numbers. `$meta: "indexKey"` is
  not implemented.

For true full-text fidelity (stemming per language, scoring, fuzzy/autocomplete), use a real
search engine — **MongoDB Atlas Search** (`$search`), which MongoDB itself recommends over `$text`.

---

## Update operators

The per-operator status and notes for **every** update operator (field, array, positional) live in
the [**generated Update-operators table**](#update-operators) — computed from the live
`updateOperators` map in [`src/crud/update.ts`](../src/crud/update.ts) ⋈ MongoDB's update-operator
set. Two structural facts that don't fit a per-operator row: **positional paths** (`$[]`, filtered
`$[<id>]` with `arrayFilters`) work with **any** field operator via a path-expansion layer
(`expandPositionalPaths`), so no per-operator support is needed; the **query-bound positional `$`**
is the one still absent. Behavior notes follow.

### Update behavior notes

- **Operator vs. replacement.** `updateOne`/`updateMany` require an operator document; a plain
  document is a replacement and must go through `replaceOne`. Mixing operator and non-operator
  keys throws (Mongo's rule).
- **`modifiedCount`** counts docs that actually changed — a matched doc set to its current value
  contributes 0, matching the driver.
- **`upsert`.** `{ upsert: true }` inserts on no match; the document is built from the query's
  **equality** fields + the update operators + `$setOnInsert` (query operators like `$gt` seed
  nothing; a generated `_id` is used when absent). The report adds `upsertedId`/`upsertedCount`.
  `replaceOne` upserts the replacement seeded with the query equality; `findOneAndUpdate`/
  `findOneAndReplace` upsert and return `null` (no before-doc).

---

## Aggregation

Comparison of [current MongoDB aggregation stages](https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/)
against the `_aggregateStageOps` map in [`src/aggregate/index.ts`](../src/aggregate/index.ts).
`aggregate(array, stages)` deep-copies the input and folds each stage's output into the next.

### Pipeline stages & expression operators

The per-stage and per-expression-operator status and notes live in the generated
[**Aggregation-stages**](#aggregation-stages) and
[**Aggregation-expression-operators**](#aggregation-expression-operators) tables — computed from the
live `_aggregateStageOps` map ([`src/aggregate/index.ts`](../src/aggregate/index.ts)) and the
`expressionOps` map ([`src/aggregate/expression.ts`](../src/aggregate/expression.ts)) ⋈ MongoDB's sets.

Every pipeline stage feasible in-memory is implemented (`$match`/`$project`/`$group`/`$unwind`/
`$lookup`/`$sample`/`$geoNear`/`$redact`/`$out`/…). Absent by design — they need a server, a
different data model, or are pure admin: `$bucket`/`$bucketAuto`/`$facet`, `$graphLookup`/
`$unionWith`, the time-series stages (`$densify`/`$fill`/`$setWindowFields`), `$documents`, and the
Atlas-search / `$collStats` / `$changeStream` family.

The **expression engine** ([`src/aggregate/expression.ts`](../src/aggregate/expression.ts)) is the
value-computing counterpart to the boolean match engine — it powers `$group` accumulators and computed
`$project`/`$addFields`/`$set`/`$redact`, with field references (`"$a.b"`), `$$` variables,
`$literal`, and a **pragmatic core** (arithmetic, string, comparison, conditional, boolean, array,
`$mergeObjects`, and the `$group` accumulators). **Not yet implemented:** date operators, type
conversion (`$toInt`/`$convert`/…), set operators (`$setUnion`/…), and the long tail
(`$regexMatch`/`$reduce`/`$zip`/`$firstN`/…) — see the generated table for the exact list. Adding one
is a single entry in the `expressionOps` table.

---

## Compatibility matrix — auto-generated

> **✅ full · ⚠️ partial · ❌ unsupported · ➕ micromongo-specific.** These tables are **generated**
> from the operation manifest ([`meta/manifest.js`](../meta/manifest.js)) — the live
> registries ⋈ MongoDB's set ([`mongo-operations.generated.json`](../test/crud/match/mongo-operations.generated.json))
>
> - hand-authored summaries ([`meta/summaries.js`](../meta/summaries.js)) — by
>   `scripts/gen-compat-tables.js`. The **status column is read from the running engine**, so it can
>   never drift from what's implemented; only the prose is authored. Run `npm run gen-compat-tables` to
>   refresh (a test fails if these are stale). The hand-written prose tables above stay as the narrative;
>   these are the exhaustive, always-current reference.

### Collection methods

<!-- GENERATED:methods -->
_27 of 38 MongoDB collection methods implemented (➕ = micromongo-specific). Generated from the live `mm.*` + `Collection` surfaces — do not edit by hand._

| Method | Status | Returns | Notes |
|---|---|---|---|
| `Collection` | ➕ | `Collection` | micromongo-specific — the data-owning `Collection` class (opt-in indexes, chainable Cursor). |
| `Cursor` | ➕ | `Cursor` | Lazy chainable `Cursor` (`sort`/`skip`/`limit`/`project` + terminals `toArray`/`forEach`/`map`/`count`/`next`/`hasNext`/`explain`). Also **streams**: `for…of`/spread, `for await` (`Symbol.asyncIterator`), and a Node `.stream()` — with **early termination on `limit`** (no-sort path stops scanning) and a **bounded top-K heap** for `sort`+`limit` (O(K) memory, never buffers the full sorted array). |
| `aggregate` | ⚠️ | `Array` | Subset of stages — see the [Aggregation](#aggregation) section. Deep-copies the input, then folds each stage's output into the next, so it never touches the source array. |
| `bulkWrite` | ✅ | `BulkWriteResult` | Batches all six write kinds (`insertOne`/`updateOne`/`updateMany`/`replaceOne`/`deleteOne`/`deleteMany`), each delegating to the matching single-write method (so positional `$`, `upsert`, `arrayFilters` all work in a batch). `ordered` true (fail-fast) / false (continue + `writeErrors`); aggregated `BulkWriteResult`. |
| `collection` | ➕ | `Collection` | micromongo-specific — register/retrieve a named collection (the `mm.db` namespace). |
| `configure` | ➕ | `Settings` | micromongo-specific — process-wide defaults (`idProjectionMongo`/`whereTimeout`/`textSearch`/`autoId`). |
| `copyTo` | ➕ | `Number` (count) | Deep-copies into `target`; **does not** clear it first. Non-standard return (Mongo's `copyTo` was server-side and removed in 4.2). |
| `count` | ✅ | `Number` | Empty/`undefined` query ⇒ total length. Maps to Mongo's `countDocuments()` semantics; Mongo's bare `count()` is deprecated. See also `countDocuments`/`estimatedDocumentCount` (the modern driver names). |
| `countDocuments` | ✅ | `Number` | The MongoDB driver's `countDocuments()` (bare `count()` is deprecated there). Identical semantics to micromongo's `count` — matches the query; empty/undefined ⇒ all. |
| `createIndex` | ✅ | `String` (index name) | **Collection-only** (the functional `mm.*` API can't own the array to keep an index valid). Accepts `createIndex('field')` or `createIndex({ a: 1, b: 1 })`; idempotent. Returns the Mongo-style index **name** (e.g. `a_1_b_-1`), matching the driver. Serves equality/range/sort/`$in`/compound-prefix/`$or`. Not `unique`/`partial`/`sparse`; no text/geo/hashed/TTL types. |
| `createIndexes` | ✅ | `Array` (index names) | **Collection-only.** Accepts driver `[{ key: {…} }]` specs or bare field specs; returns the created index **names** (`string[]`), matching the driver. |
| `createSearchIndex` | ❌ | — | — |
| `createSearchIndexes` | ❌ | — | — |
| `deleteMany` | ✅ | `{ acknowledged, deletedCount }` | Removes all matches in place (iterates backwards so the in-place `splice` doesn't skip elements). |
| `deleteOne` | ✅ | `{ acknowledged, deletedCount }` | Removes the first match in place. |
| `distinct` | ✅ | `Array` | Distinct values of `field` across matches; array fields flattened (each element distinct); dotted paths; deep-equal dedup. |
| `drop` | ✅ | `Boolean` | The driver's `drop()` — for a caller-owned array, empties it in place and returns `true`. On a `Collection` it also drops all indexes. (Mongo's server-side collection drop has no meaning for a plain array beyond clearing it.) |
| `dropIndex` | ✅ | `{ ok: 1 }` | **Collection-only.** Returns `{ ok: 1 }` (driver shape); a no-op when the index is absent. |
| `dropIndexes` | ✅ | `Boolean` | **Collection-only.** Removes all built indexes; returns `true` (driver shape). |
| `dropSearchIndex` | ❌ | — | — |
| `estimatedDocumentCount` | ✅ | `Number` | The driver's metadata-based estimate; for a plain array that is simply `array.length` (no query argument). |
| `find` | ✅ | `Array` | Deep copy of matches; `_id` included by default. |
| `findOne` | ✅ | `Object`\|`null` | First match, or `null`. |
| `findOneAndDelete` | ✅ | `Object`\|`null` | Deletes the first match and returns the removed document; `null` on no match. |
| `findOneAndReplace` | ✅ | `Object`\|`null` | Replaces the first match and returns the document **before** modification; `null` on no match. Honors `{ upsert: true }`. |
| `findOneAndUpdate` | ✅ | `Object`\|`null` | Applies an update and returns the document **before** modification (Mongo's default); `null` on no match. Honors `{ upsert: true }` (inserts, returning `null`). |
| `getIndexes` | ➕ | `Array` | **Collection-only.** Lists index names in micromongo's internal form (single-field indexes list as the bare field). For the driver-shaped specs use `indexes()`/`listIndexes()`. |
| `indexExists` | ✅ | `Boolean` | **Collection-only.** Accepts a name or an array of names (all must exist). |
| `indexInformation` | ✅ | `Object` | **Collection-only.** The driver's `indexInformation()` shape. |
| `indexStats` | ➕ | `Array` | **Collection-only.** Per-index `{ name, key, accesses: { ops } }` (Mongo-style names); also powers the `$indexStats` aggregation stage. |
| `indexes` | ✅ | `Array` | **Collection-only.** The driver's `indexes()`/`listIndexes()` shape, built from the same metadata `indexStats()` reports (Mongo-style names like `a_1_b_-1`). |
| `initializeOrderedBulkOp` | ❌ | — | — |
| `initializeUnorderedBulkOp` | ❌ | — | — |
| `insert` | ➕ | `{ acknowledged, … }` | Deprecated Mongo alias — dispatches to `insertOne`/`insertMany` by arg type. Kept as a convenience alias. |
| `insertMany` | ✅ | `{ acknowledged, insertedCount, insertedIds }` | Appends an array of docs in place. `options.ordered` (default `true`) stops the batch on a failing insert; preceding inserts persist. |
| `insertOne` | ✅ | `{ acknowledged, insertedId, insertedCount }` | Appends one doc in place. `options.ordered` accepted but ignored. `insertedId` is the doc's own `_id` (or generated when `configure({ autoId: true })`). |
| `isCapped` | ❌ | — | — |
| `listIndexes` | ✅ | `Array` | **Collection-only.** Same `[{ v, key, name }]` specs as `indexes()`. (The `micromongo/mock` adapter wraps this in an async cursor.) |
| `listSearchIndexes` | ❌ | — | — |
| `options` | ❌ | — | — |
| `registerOperator` | ➕ |  | micromongo-specific — the extension point for custom query operators. |
| `reindex` | ➕ | `Collection` | **Collection-only.** Recovery hook if `toArray()` was mutated directly (bypassing index maintenance). |
| `remove` | ➕ | `{ nRemoved }` | Deprecated Mongo alias over `deleteOne`/`deleteMany`. `options` = `{ justOne }` or boolean; returns the legacy `{ nRemoved }` shape. |
| `rename` | ❌ | — | — |
| `replaceOne` | ✅ | `{ acknowledged, matchedCount, modifiedCount[, upsertedId, upsertedCount] }` | Replaces the first match in place, preserving position; rejects operator docs. `{ upsert: true }` inserts the replacement (seeded with the query's equality fields) on no match. |
| `toArray` | ➕ | `Array` | **Collection-only.** Returns the live owned array (not a copy) — mutating it bypasses index maintenance (`reindex()` recovers). |
| `updateMany` | ✅ | `{ acknowledged, matchedCount, modifiedCount[, upsertedId, upsertedCount] }` | As `updateOne`, applied to all matches; same `upsert`/`arrayFilters` support. |
| `updateOne` | ✅ | `{ acknowledged, matchedCount, modifiedCount[, upsertedId, upsertedCount] }` | Field + array update operators (see the update-operator table); requires an operator document. `{ upsert: true }` inserts on no match; `{ arrayFilters }` drives `$[<id>]`. `modifiedCount` is 0 when matched-but-unchanged. |
| `updateSearchIndex` | ❌ | — | — |
| `watch` | ❌ | — | — |
<!-- /GENERATED:methods -->

### Aggregation stages

<!-- GENERATED:stages -->
_20 of 40 MongoDB aggregation stages implemented (➕ = micromongo-specific). Generated from the live `_aggregateStageOps` registry — do not edit by hand._

| Stage | Status | Notes |
|---|---|---|
| `$addFields` | ✅ | Add/overwrite fields with computed expression values, keeping existing fields. |
| `$bucket` | ❌ | — |
| `$bucketAuto` | ❌ | — |
| `$changeStream` | ❌ | — |
| `$changeStreamSplitLargeEvent` | ❌ | — |
| `$collStats` | ❌ | — |
| `$count` | ✅ | Single output doc `{ <field>: <n input docs> }`. |
| `$densify` | ❌ | — |
| `$documents` | ❌ | — |
| `$facet` | ❌ | — |
| `$fill` | ❌ | — |
| `$geoNear` | ✅ | Filter by distance + sort nearest-first + write `distanceField`; legacy planar / spherical; `query`/`min`/`maxDistance`/`distanceMultiplier`. |
| `$graphLookup` | ❌ | — |
| `$group` | ✅ | Group key (field/expression/object/`null`) + accumulators `$sum` `$avg` `$min` `$max` `$push` `$addToSet` `$first` `$last` `$count`. |
| `$indexStats` | ✅ | Per-index usage via `Collection.aggregate` (`options.indexStats`); empty for a bare-array `aggregate`. |
| `$limit` | ✅ | Number only. |
| `$listSampledQueries` | ❌ | — |
| `$listSearchIndexes` | ❌ | — |
| `$listSessions` | ❌ | — |
| `$lookup` | ✅ | Left outer equality join. `from` = a registered name, a `Collection`, or an array; array-valued `localField` matches each element. |
| `$match` | ✅ | Reuses the full query engine, so all query-operator support/limits apply. |
| `$merge` | ❌ | — |
| `$out` | ✅ | In-memory sink. `{ $out: "name" }` (registry), `{ $out: <Collection\|array> }`. Replaces the target's contents; must be the last stage. |
| `$planCacheStats` | ❌ | — |
| `$project` | ✅ | Inclusion/exclusion **and computed/expression fields** (`{ total: { $multiply: [...] } }`) via the expression engine. |
| `$redact` | ✅ | `$$DESCEND`/`$$PRUNE`/`$$KEEP` traversal over embedded docs + arrays-of-docs, via the expression engine. |
| `$replaceRoot` | ✅ | Promote the document resolved from `newRoot` (an expression, e.g. `$mergeObjects`) to the top level. |
| `$replaceWith` | ✅ | Promote the document resolved from `newRoot` (an expression, e.g. `$mergeObjects`) to the top level. |
| `$sample` | ✅ | Random sampling `{ size: n }`; size ≥ length returns all. |
| `$search` | ❌ | — |
| `$searchMeta` | ❌ | — |
| `$set` | ✅ | Add/overwrite fields with computed expression values, keeping existing fields. |
| `$setWindowFields` | ❌ | — |
| `$skip` | ✅ | Number only. |
| `$sort` | ⚠️ | Multi-key `{ a: 1, 'b.c': -1 }` supported; direction must be `1`/`-1`; **array/object sort values not supported**. |
| `$sortByCount` | ✅ | Group by expression + count, sorted by count desc (= `$group` + `$sort`). |
| `$unionWith` | ❌ | — |
| `$unset` | ✅ | Remove one field or a list of fields. |
| `$unwind` | ⚠️ | Supports string form and `{ path, includeArrayIndex, preserveNullAndEmptyArrays }`. (Two `includeArrayIndex` bugs fixed — see [Known bugs](#known-bugs).) |
| `$vectorSearch` | ❌ | — |
<!-- /GENERATED:stages -->

### Query operators

<!-- GENERATED:queryOps -->
_33 of 35 MongoDB query operators implemented (➕ = micromongo-specific). Generated from the live match registries — do not edit by hand._

| Operator | Status | Notes |
|---|---|---|
| `$all` | ⚠️ | No support for nested arrays or combination with `$elemMatch`. |
| `$and` | ✅ | All sub-queries match. |
| `$bitsAllClear` | ✅ | All given bits clear. |
| `$bitsAllSet` | ✅ | All given bits set. |
| `$bitsAnyClear` | ✅ | Any given bit clear. |
| `$bitsAnySet` | ✅ | Any given bit set. |
| `$box` | ➕ | Rectangle operand for `$geoWithin`. |
| `$center` | ➕ | Legacy circle operand for `$geoWithin`. |
| `$centerSphere` | ➕ | Spherical circle operand for `$geoWithin`. |
| `$comment` | ✅ | Implemented as a preprocess op; **logs the comment to the console**. |
| `$elemMatch` | ✅ | An array element matches the sub-query (query + projection forms). |
| `$eq` | ✅ | Deep-equals; array-aware (element-equals + array-equals). |
| `$exists` | ✅ | Field presence (boolean only). |
| `$expr` | ✅ | Evaluates an aggregation expression against the whole document and matches on truthiness (`{ $expr: { $gt: ['$a','$b'] } }`); reuses the aggregation expression evaluator as a `pre`-operator. Safe (no `vm`), unlike `$where`. |
| `$geoIntersects` | ⚠️ | Point within a `$geometry` polygon (treated as containment). |
| `$geoWithin` | ✅ | Shapes `$box`, `$center`, `$centerSphere`, `$polygon`, `$geometry` (GeoJSON Polygon/MultiPolygon). |
| `$geometry` | ➕ | GeoJSON operand — consumed by geo operators (inert alone). |
| `$gt` | ✅ | Native `>` (array-aware: any element). |
| `$gte` | ✅ | Native `>=`. |
| `$in` | ✅ | Array membership; supports regex members and array-valued fields. |
| `$jsonSchema` | ❌ | — |
| `$lt` | ✅ | Native `<`. |
| `$lte` | ✅ | Native `<=`. |
| `$maxDistance` | ✅ | Geo sub-operand — max distance for `$near`/`$nearSphere`. |
| `$minDistance` | ➕ | Geo sub-operand — min distance for `$near`/`$nearSphere`. |
| `$mod` | ✅ | `[divisor, remainder]`. |
| `$ne` | ⚠️ | Uses strict `!==`; **not** deep — `$ne` against an object/array won't deep-compare. |
| `$near` | ✅ | Legacy (planar) + GeoJSON (spherical/meters); `$minDistance`/`$maxDistance`. Filtering only — find does not auto-sort by distance (use `$geoNear` for ordering). |
| `$nearSphere` | ✅ | Legacy (planar) + GeoJSON (spherical/meters); `$minDistance`/`$maxDistance`. Filtering only — find does not auto-sort by distance (use `$geoNear` for ordering). |
| `$nin` | ⚠️ | Scalar membership only — does not handle array-valued document fields. |
| `$nor` | ✅ | No sub-query matches. |
| `$not` | ✅ | Field-level negation of its sub-expression. |
| `$options` | ✅ | Regex flags — consumed by `$regex` (inert on its own). |
| `$or` | ✅ | Any sub-query matches. |
| `$polygon` | ➕ | Polygon operand for `$geoWithin`. |
| `$rand` | ❌ | — |
| `$regex` | ⚠️ | Requires a `RegExp` object; `/pattern/` string form via `$options` partially handled; `o`/`x` options unsupported. |
| `$size` | ✅ | Exact array length (number only). |
| `$text` | ⚠️ | In-memory full-text search, 3 fidelity modes via `mm.configure({ textSearch })`; OR/phrase/negation. **Approximate** — see [Text search](#text-search-text--meta). |
| `$type` | ⚠️ | Accepts JS `typeof`-style names (`'boolean'`,`'number'`,`'string'`,`'object'`,`'undefined'`,`'null'`,`'array'`). **Diverges from MongoDB:** Mongo takes BSON aliases/codes (`"double"`,`"int"`,`"objectId"`,`2`,…) — micromongo rejects all of those, and its `'number'` is JS-`typeof` (any JS number), whereas Mongo's `"number"` is a BSON alias for double/int/long/decimal. Mongo has no `"undefined"` BSON type; micromongo does accept it. |
| `$uniqueDocs` | ➕ | Legacy no-op (deprecated in MongoDB). |
| `$where` | ⚠️ | Runs arbitrary JS; doc bound as `this`. Timeout `whereTimeout` (default 1000 ms, `mm.configure`). ⚠️ The Node `vm` is **not a security sandbox** — **trusted-input-only**. |
<!-- /GENERATED:queryOps -->

### Update operators

<!-- GENERATED:updateOps -->
_15 of 15 MongoDB update operators implemented (➕ = micromongo-specific). Generated from the live `updateOperators` registry — do not edit by hand._

| Operator | Status | Notes |
|---|---|---|
| `$addToSet` | ✅ | Add if absent (deep-equal dedup); `$each`. |
| `$bit` | ✅ | `{ $bit: { f: { and\|or\|xor: <int> } } }`; ops applied in spec order; missing field treated as `0`; non-numeric throws. |
| `$currentDate` | ⚠️ | `true` or `{ $type: 'date' }` ⇒ JS `Date`. `{ $type: 'timestamp' }` throws (no BSON Timestamp). |
| `$inc` | ✅ | Increment (missing ⇒ set to increment). Numeric only. |
| `$max` | ✅ | Writes only if new value `>` current; sets if missing. JS `>` comparison. |
| `$min` | ✅ | Writes only if new value `<` current; sets if field missing. JS `<` comparison (not BSON type order). |
| `$mul` | ✅ | Multiply (missing ⇒ 0). Numeric only. |
| `$pop` | ✅ | `1` removes last, `-1` removes first; no-op on missing/empty. |
| `$pull` | ✅ | By exact value **or** by query condition (reuses the match engine, e.g. `{ $gt: 5 }`). |
| `$pullAll` | ✅ | Remove every listed value (exact match). |
| `$push` | ✅ | Creates the array if missing; supports `$each`/`$position`/`$slice`/`$sort` modifiers. |
| `$rename` | ✅ | Rename a field (no-op if source absent; overwrites target). |
| `$set` | ✅ | Set/create a field; dotted paths supported. |
| `$setOnInsert` | ✅ | Applied only when an `upsert` inserts (no-op on matched update). |
| `$unset` | ✅ | Remove a field (no-op if absent). |
<!-- /GENERATED:updateOps -->

### Aggregation expression operators

<!-- GENERATED:exprOps -->
_41 of 161 MongoDB expression operators implemented (➕ = micromongo-specific). Generated from the live `expressionOps` registry — do not edit by hand._

| Operator | Status | Notes |
|---|---|---|
| `$abs` | ✅ | Absolute value. |
| `$accumulator` | ❌ | — |
| `$acos` | ❌ | — |
| `$acosh` | ❌ | — |
| `$add` | ✅ | Sum of numbers. |
| `$addToSet` | ❌ | — |
| `$allElementsTrue` | ❌ | — |
| `$and` | ✅ | Logical AND. |
| `$anyElementTrue` | ❌ | — |
| `$arrayElemAt` | ✅ | Element at an index. |
| `$arrayToObject` | ❌ | — |
| `$asin` | ❌ | — |
| `$asinh` | ❌ | — |
| `$atan` | ❌ | — |
| `$atan2` | ❌ | — |
| `$atanh` | ❌ | — |
| `$avg` | ❌ | — |
| `$binarySize` | ❌ | — |
| `$bottom` | ❌ | — |
| `$bottomN` | ❌ | — |
| `$bsonSize` | ❌ | — |
| `$ceil` | ✅ | Round up to integer. |
| `$cmp` | ✅ | Three-way compare (-1/0/1). |
| `$concat` | ✅ | Concatenate strings. |
| `$concatArrays` | ✅ | Concatenate arrays. |
| `$cond` | ✅ | If/then/else. |
| `$convert` | ❌ | — |
| `$cos` | ❌ | — |
| `$cosh` | ❌ | — |
| `$count` | ❌ | — |
| `$covariancePop` | ❌ | — |
| `$covarianceSamp` | ❌ | — |
| `$dateAdd` | ❌ | — |
| `$dateDiff` | ❌ | — |
| `$dateFromParts` | ❌ | — |
| `$dateFromString` | ❌ | — |
| `$dateSubtract` | ❌ | — |
| `$dateToParts` | ❌ | — |
| `$dateToString` | ❌ | — |
| `$dateTrunc` | ❌ | — |
| `$dayOfMonth` | ❌ | — |
| `$dayOfWeek` | ❌ | — |
| `$dayOfYear` | ❌ | — |
| `$degreesToRadians` | ❌ | — |
| `$denseRank` | ❌ | — |
| `$derivative` | ❌ | — |
| `$divide` | ✅ | Quotient of two numbers. |
| `$documentNumber` | ❌ | — |
| `$eq` | ✅ | Equality (expression form). |
| `$exp` | ❌ | — |
| `$expMovingAvg` | ❌ | — |
| `$filter` | ✅ | Keep elements matching a condition. |
| `$first` | ❌ | — |
| `$firstN` | ❌ | — |
| `$floor` | ✅ | Round down to integer. |
| `$function` | ❌ | — |
| `$getField` | ❌ | — |
| `$gt` | ✅ | Greater-than. |
| `$gte` | ✅ | Greater-or-equal. |
| `$hour` | ❌ | — |
| `$ifNull` | ✅ | First non-null of its args. |
| `$in` | ✅ | Membership test (value in array). |
| `$indexOfArray` | ❌ | — |
| `$indexOfBytes` | ❌ | — |
| `$indexOfCP` | ❌ | — |
| `$integral` | ❌ | — |
| `$isArray` | ❌ | — |
| `$isNumber` | ❌ | — |
| `$isoDayOfWeek` | ❌ | — |
| `$isoWeek` | ❌ | — |
| `$isoWeekYear` | ❌ | — |
| `$last` | ❌ | — |
| `$lastN` | ❌ | — |
| `$let` | ❌ | — |
| `$literal` | ❌ | — |
| `$ln` | ❌ | — |
| `$log` | ❌ | — |
| `$log10` | ❌ | — |
| `$lt` | ✅ | Less-than. |
| `$lte` | ✅ | Less-or-equal. |
| `$ltrim` | ❌ | — |
| `$map` | ✅ | Transform each element. |
| `$max` | ❌ | — |
| `$maxN` | ❌ | — |
| `$median` | ❌ | — |
| `$mergeObjects` | ✅ | Merge objects left-to-right. |
| `$meta` | ❌ | — |
| `$millisecond` | ❌ | — |
| `$min` | ❌ | — |
| `$minN` | ❌ | — |
| `$minute` | ❌ | — |
| `$mod` | ✅ | Remainder. |
| `$month` | ❌ | — |
| `$multiply` | ✅ | Product of numbers. |
| `$ne` | ✅ | Inequality. |
| `$not` | ✅ | Logical NOT. |
| `$objectToArray` | ❌ | — |
| `$or` | ✅ | Logical OR. |
| `$percentile` | ❌ | — |
| `$pow` | ✅ | Base raised to an exponent. |
| `$push` | ❌ | — |
| `$radiansToDegrees` | ❌ | — |
| `$rand` | ✅ | Random float in `[0,1)` (also usable in `$expr`). |
| `$range` | ❌ | — |
| `$rank` | ❌ | — |
| `$reduce` | ❌ | — |
| `$regexFind` | ❌ | — |
| `$regexFindAll` | ❌ | — |
| `$regexMatch` | ❌ | — |
| `$replaceAll` | ❌ | — |
| `$replaceOne` | ❌ | — |
| `$reverseArray` | ✅ | Reverse an array. |
| `$round` | ✅ | Round to a given precision. |
| `$rtrim` | ❌ | — |
| `$second` | ❌ | — |
| `$setDifference` | ❌ | — |
| `$setEquals` | ❌ | — |
| `$setField` | ❌ | — |
| `$setIntersection` | ❌ | — |
| `$setIsSubset` | ❌ | — |
| `$setUnion` | ❌ | — |
| `$shift` | ❌ | — |
| `$sin` | ❌ | — |
| `$sinh` | ❌ | — |
| `$size` | ✅ | Array length. |
| `$slice` | ❌ | — |
| `$sortArray` | ❌ | — |
| `$split` | ✅ | Split a string on a delimiter. |
| `$sqrt` | ✅ | Square root. |
| `$stdDevPop` | ❌ | — |
| `$stdDevSamp` | ❌ | — |
| `$strLenBytes` | ❌ | — |
| `$strLenCP` | ✅ | Code-point length of a string. |
| `$strcasecmp` | ❌ | — |
| `$substr` | ✅ | Substring (bytes). |
| `$substrBytes` | ❌ | — |
| `$substrCP` | ✅ | Substring (code points). |
| `$subtract` | ✅ | Difference of two numbers. |
| `$sum` | ❌ | — |
| `$switch` | ✅ | Multi-branch case expression. |
| `$tan` | ❌ | — |
| `$tanh` | ❌ | — |
| `$toBool` | ❌ | — |
| `$toDate` | ❌ | — |
| `$toDecimal` | ❌ | — |
| `$toDouble` | ❌ | — |
| `$toHashedIndexKey` | ❌ | — |
| `$toInt` | ❌ | — |
| `$toLong` | ❌ | — |
| `$toLower` | ✅ | Lowercase a string. |
| `$toObjectId` | ❌ | — |
| `$toString` | ❌ | — |
| `$toUpper` | ✅ | Uppercase a string. |
| `$top` | ❌ | — |
| `$topN` | ❌ | — |
| `$trim` | ✅ | Trim whitespace/chars. |
| `$trunc` | ❌ | — |
| `$type` | ❌ | — |
| `$week` | ❌ | — |
| `$year` | ❌ | — |
| `$zip` | ❌ | — |
<!-- /GENERATED:exprOps -->

---

## MongoDB driver mock (`micromongo/mock`)

A drop-in, `mongodb`-driver-shaped adapter over the in-memory engine, so **other projects can run
their test suites against micromongo instead of a live MongoDB** (subpath export
[`micromongo/mock`](../src/mock/); tests in [`test/mock-driver.js`](../test/mock-driver.js)). It's a
micromongo-specific surface (no MongoDB doc example to port), so it's covered by plain unit tests.

Wire it in without touching the code under test — e.g. Jest
`moduleNameMapper: { '^mongodb$': 'micromongo/mock' }` — or `require('micromongo/mock')` directly.

| Driver surface | Fidelity |
| -------------- | -------- |
| `MongoClient` (`connect`/`db`/`close`/`startSession`/`withSession`) | ✅ in-memory; `connect()` is a no-op resolve, `db(name)` returns an isolated per-client `Db`. |
| `Db` (`collection`/`createCollection`/`dropCollection`/`listCollections`/`command`/`admin`) | ✅ over an **isolated** per-`Db` registry (not the global `mm.db`), so test files don't share state. |
| `Collection` — CRUD (`insertOne/Many`, `find`, `findOne`, `updateOne/Many`, `replaceOne`, `deleteOne/Many`, `findOneAnd*`, `countDocuments`, `estimatedDocumentCount`, `distinct`, `aggregate`) | ✅ async (`Promise`) results in the driver's shapes; auto-`ObjectId` `_id` on insert. |
| `Collection` — `bulkWrite` + fluent `initializeOrderedBulkOp`/`initializeUnorderedBulkOp` | ✅ over the same batch engine. |
| `Collection` — indexes (`createIndex(es)`, `dropIndex(es)`, `indexes`, `listIndexes`, `indexInformation`, `indexExists`) | ✅ over the real [Collection index metadata](#indexes-collection-only). |
| `FindCursor` / `AggregationCursor` | ✅ async: `toArray()`/`next()`/`hasNext()`/`forEach()` return Promises, `Symbol.asyncIterator` (`for await`), chainable `sort`/`skip`/`limit`/`project`/`map`/`filter`/`clone`/`rewind`/`stream`. Wire/planner hints (`hint`/`collation`/`maxTimeMS`/…) are chainable **no-ops** (meaningless in-memory). |
| `ObjectId` | ✅ uses the consumer's real `bson.ObjectId` if installed (optional peer dep), else a self-contained 24-hex fallback with `equals`/`toHexString`/`isValid`. |
| Sessions / **transactions** | ⚠️ the session API exists and `withTransaction(fn)` **runs the body**, but with **no real isolation** — `abortTransaction()` does not roll back (there is a single in-memory array). Documented no-op. |
| Change streams (`watch`), Atlas Search (`*SearchIndex*`) | ❌ **throw** loudly (require a real server) — so a test relying on them fails instead of silently passing. |

---

## Known bugs

All bugs in this section have been **fixed** (Phase 0); kept here for the record with regression tests in
[`test/aggregate/aggregate-unwind.js`](../test/aggregate/aggregate-unwind.js).

**✅ Fixed — `$unwind` `includeArrayIndex` placement & `path` scoping** (`src/aggregate/index.ts`).
Two defects in the same function:

1. _Index placement (observable)._ With a **nested** array path (e.g. `$a.c`), the index field
   was placed _nested_ next to the array field (`{ a: { c: 10, idx: 0 } }`) instead of at the
   **top level** as MongoDB does (`{ a: { c: 10 }, idx: 0 }`). This was a real divergence for any
   nested-path `$unwind` with `includeArrayIndex`.
2. _`path` scoping (latent)._ The inner `_unwindDoc` wrote the unwound value via `_.set(newDoc, p, …)` using the outer-closure `p` rather than its own `path` parameter — correct only because
   the call site happened to pass `p` as `path`, so they were equal.

Fix: the `includeArrayIndex` branch now does `_.set(newDoc, includeArrayIndex, i)` (top level),
and the value write uses the function's own `path`.

**✅ Fixed — `project.js` stray `console.log`** (`src/crud/project.ts`). The unused
`projectionCheckInit` helper logged `mode, newMode` on every call. The function was dead code
(its only call sites are commented out and it was never exported), so it was removed entirely.

---

## Beyond CRUD & aggregation: the rest of MongoDB

The tables above cover the document-query surface. MongoDB is much larger
([manual top-level areas](https://www.mongodb.com/docs/manual/)). This section sets
**expectations of scope**: micromongo is a query/match engine over a plain in-memory JavaScript
array — there is no server, storage engine, persistence, cluster, or session. Most MongoDB
feature areas are therefore not "missing features" but **categorically out of scope**.

### Could plausibly be added (operate on the array, fit the model)

| Feature                                                                                        | Status  | Note                                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | :-----: | ---------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| **Field update operators** + `updateOne`/`updateMany`/`replaceOne`/`findOneAnd*`               | ✅ done | `$set`/`$inc`/`$mul`/`$min`/`$max`/`$unset`/`$rename`/`$currentDate`/`$setOnInsert`/`$bit` + the update/replace/find-and-modify methods. |
| **Array + positional update operators** (`$push`/`$pull`/`$addToSet`/…, `$[]`, `$[<id>]`)      | ✅ done | Array ops + positional `$[]`/`$[<id>]` (with `arrayFilters`); query-bound `$` still pending.                                             |     |     |
| **`upsert`** (`upsertedId`/`upsertedCount`, live `$setOnInsert`)                               | ✅ done | `{ upsert: true }` on update/replace/findOneAnd\* methods.                                                                               |
| **Bitwise operators** (`$bitsAllSet`/…)                                                        | ✅ done | Numeric bitmask + bit-position array.                                                                                                    |
| **Geospatial query** (`$geoWithin`/`$near`/`$geoNear`/…)                                       | ✅ done | Legacy + GeoJSON, planar + haversine. See[`geo.js`](../src/crud/geo.ts).                                                                 |
| **`$sample`** + projection `$slice`/`$elemMatch`/`$`                                           | ✅ done | Implemented this round.                                                                                                                  |
| **`distinct`**                                                                                 | ✅ done | One pass over the array collecting unique values; array fields flattened.                                                                |
| **`$group` + accumulators** (`$sum`/`$avg`/`$push`/…)                                          | ✅ done | Via the expression engine (`$sum`/`$avg`/`$min`/`$max`/`$push`/`$addToSet`/`$first`/`$last`/`$count`).                                   |
| **Aggregation stages** (`$addFields`/`$set`/`$unset`/`$count`/`$replaceRoot`/`$sortByCount`/…) | ✅ done | The common reshape/group/join stages;`$facet`/`$bucket`/`$graphLookup`/etc. remain absent (generated table).                             |
| **Aggregation expression operators** (`$add`/`$concat`/`$cond`/…)                              | ✅ done | Pragmatic core; date/type-conversion/set operators and the long tail remain (generated exprOps table).                                   |
| **Collation** (locale-aware string compare/sort)                                               |   ❌    | Could wrap`$sort`/comparisons; today uses raw JS `<`/`>`. **The only still-open item in this table.**                                    |

### Possible, but a different shape than this library

| Feature                                                     |        Status        | Note                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | :------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Indexes** (`createIndex`)                                 | ✅ done (Collection) | Opt-in**ordered** indexes on a `Collection` — single-field / multikey / compound — serving equality, range, sort, `$in`, compound-prefix, and `$or`, chosen by a query planner; linear scan stays the correctness fallback. Functional `mm.*` API remains unindexed by design. See [Indexes](#indexes-collection-only). |
| **Cursors / chaining** (`.sort().limit().skip().toArray()`) |       ✅ done        | `Collection.find()` returns a lazy chainable `Cursor` (`sort`/`skip`/`limit`/`project` + terminals `toArray`/`forEach`/`map`/`count`/`hasNext`/`next`, plus `explain()`). The functional `mm.find()` still returns an array (non-breaking).                                                                             |
| **Streaming cursors** (`for…of` / `for await` / `.stream()`) |       ✅ done        | The `Cursor` also streams one doc at a time: `[Symbol.iterator]` (`for…of`/spread), `[Symbol.asyncIterator]` (`for await`), and a Node Readable `.stream()`. **Early-terminates on `limit`** with no sort (constant memory; the tail is never scanned), and uses a **bounded top-K heap** for `sort`+`limit` (O(N·log K) time, O(K) memory — never materializes the full sorted array). `[...cursor]` always deep-equals `toArray()`. `.stream()` is Node-only (throws in the browser build). See [`test/cursor-stream.js`](../test/cursor-stream.js). |
| **`explain()`**                                             | ✅ done (Collection) | `Collection.find(q).explain()` returns the query plan without running it: `COLLSCAN` vs `IXSCAN`/`IXSCAN+FILTER`/`OR`, index name, `exact` vs re-filtered, `usedHash`, candidate-vs-total count, `sortFromIndex`.                                                                                                       |
| **Async / Promises**                                        |         N/A          | Entire API is synchronous. The driver is Promise-based; matching that is an API-shape decision, not a feature.                                                                                                                                                                                                          |
| **Schema validation** (`$jsonSchema`, validators)           |          ❌          | Validation logic could run in-memory, but there's no collection definition to attach rules to.                                                                                                                                                                                                                          |
| **Views** (read-only stored pipelines)                      |          ❌          | Would just be "save a stages array and re-run" — no engine support needed, but no API concept for it exists.                                                                                                                                                                                                            |
| **GridFS** (large-file chunking)                            |         N/A          | A storage convention over collections; nothing to store.                                                                                                                                                                                                                                                                |

### Inherently N/A — require a server / storage / cluster

These have no meaning for a plain array and should never be expected:

| Area                                                                   | Why N/A                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Persistence / storage engine**                                       | Data lives in a caller-owned JS array; nothing is stored.              |
| **Replication** (replica sets, failover)                               | No nodes, no oplog.                                                    |
| **Sharding** (horizontal scaling, shard keys)                          | Single in-process array.                                               |
| **Transactions / sessions** (multi-doc ACID, `startSession`)           | No durability or isolation boundary; mutations are plain array writes. |
| **Change streams**                                                     | No oplog to tail.                                                      |
| **TTL / capped collections**                                           | Lifecycle features of a storage engine.                                |
| **Time-series collections**                                            | A storage/bucketing optimization on the server.                        |
| **Read/write concern, read preference**                                | Concern only when there are replicas.                                  |
| **Security** (authentication, authorization, RBAC, in-use encryption)  | No connection, no users, no wire protocol.                             |
| **Atlas Search / Vector Search** (`$search`/`$vectorSearch`)           | Backed by Lucene/Atlas infrastructure, not the query engine.           |
| **Data Federation**                                                    | Cross-cluster/external-source querying.                                |
| **Admin/diagnostics** (`stats`, `collStats`, `serverStatus`, profiler) | No server to report on.                                                |

> **Takeaway:** of everything in MongoDB beyond the current tables, the realistically in-scope
> roadmap has essentially all been built (updates, `distinct`, `$group`/accumulators, aggregation
> expressions, reshaping stages, bitwise, geo). What remains in-scope is **collation**; everything in the
> third table is a property of MongoDB-the-server and is out of scope for a library that queries an array.
> See [roadmap.md](roadmap.md) for the remaining work.
