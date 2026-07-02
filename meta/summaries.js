'use strict';

/**
 * The ONE hand-authored layer of the docs/tests skeleton (see manifest.js).
 *
 * Keyed by kind → operation name → { summary, notes?, returns?, partial?, extra?, example? }:
 *   - summary : the one-line prose describing micromongo's behavior. The irreducibly-human
 *               field — not derivable from the registry. Used where space is tight (the HTML
 *               ops table, quick summaries).
 *   - notes   : optional RICH note (may be several sentences / inline markdown) shown in the
 *               generated compat table's Notes column. This is where the former hand-written
 *               prose-table notes now live — one source of truth per op. Generated tables
 *               render `notes || summary`, so a short op needs only `summary`.
 *   - returns : optional return-type/shape string (e.g. '`Number`', '`{ deletedCount }`') —
 *               rendered as a Returns column in the methods table.
 *   - partial : true if supported but with documented limitations (⇒ status 'partial').
 *   - extra   : true if it's a micromongo-specific op/method (no Mongo equivalent) — kept
 *               here so its summary shows even though it's not in Mongo's set.
 *   - example : optional { seed, call, result } — one example that drives BOTH the docs
 *               and an executable test (see test/meta/examples.js). `seed` and `call` are
 *               JS-source strings; `result` is the expected value (deep-equal).
 *
 * A test (manifest-skeleton) fails if a SUPPORTED op lacks a summary — nothing ships
 * undescribed. Unsupported ops don't need one (they're gaps, auto-marked ❌).
 */

module.exports = {

  // ---- Collection methods --------------------------------------------------------------
  method: {
    // standard Mongo methods
    find: { summary: 'Deep copy of matches; `_id` included by default.', returns: '`Array`',
      example: { seed: '[{_id:1,s:"A"},{_id:2,s:"B"},{_id:3,s:"A"}]', call: 'mm.find(data, { s: "A" })', result: [{ _id: 1, s: 'A' }, { _id: 3, s: 'A' }] } },
    findOne: { summary: 'First match, or `null`.', returns: '`Object`|`null`',
      example: { seed: '[{_id:1,s:"A"},{_id:2,s:"B"}]', call: 'mm.findOne(data, { s: "B" })', result: { _id: 2, s: 'B' } } },
    count: { summary: 'Number of matches; empty/undefined query ⇒ total length (`countDocuments` semantics).', returns: '`Number`',
      notes: 'Empty/`undefined` query ⇒ total length. Maps to Mongo\'s `countDocuments()` semantics; Mongo\'s bare `count()` is deprecated. See also `countDocuments`/`estimatedDocumentCount` (the modern driver names).',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.count(data, { s: "A" })', result: 2 } },
    countDocuments: { summary: 'Modern driver alias of `count(query)`.', returns: '`Number`',
      notes: 'The MongoDB driver\'s `countDocuments()` (bare `count()` is deprecated there). Identical semantics to micromongo\'s `count` — matches the query; empty/undefined ⇒ all.',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.countDocuments(data, { s: "A" })', result: 2 } },
    estimatedDocumentCount: { summary: 'Fast total count — the array length (metadata estimate).', returns: '`Number`',
      notes: 'The driver\'s metadata-based estimate; for a plain array that is simply `array.length` (no query argument).',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.estimatedDocumentCount(data)', result: 3 } },
    drop: { summary: 'Empty the array in place; returns `true`.', returns: '`Boolean`',
      notes: 'The driver\'s `drop()` — for a caller-owned array, empties it in place and returns `true`. On a `Collection` it also drops all indexes. (Mongo\'s server-side collection drop has no meaning for a plain array beyond clearing it.)',
      example: { seed: '[{a:1},{a:2}]', call: '(mm.drop(data), data)', result: [] } },
    distinct: { summary: 'Distinct values of a field across matches; array fields flattened; deep-equal dedup.', returns: '`Array`',
      notes: 'Distinct values of `field` across matches; array fields flattened (each element distinct); dotted paths; deep-equal dedup.',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.distinct(data, "s")', result: ['A', 'B'] } },
    insertOne: { summary: 'Inserts one doc in place; returns `{ acknowledged, insertedId, insertedCount }`.', returns: '`{ acknowledged, insertedId, insertedCount }`',
      notes: 'Appends one doc in place. `options.ordered` accepted but ignored. `insertedId` is the doc\'s own `_id` (or generated when `configure({ autoId: true })`).',
      example: { seed: '[{_id:1}]', call: 'mm.insertOne(data, { _id: 2 })', result: { acknowledged: true, insertedId: 2, insertedCount: 1 } } },
    insertMany: { summary: 'Inserts many in place; returns `{ acknowledged, insertedCount, insertedIds }`.', returns: '`{ acknowledged, insertedCount, insertedIds }`',
      notes: 'Appends an array of docs in place. `options.ordered` (default `true`) stops the batch on a failing insert; preceding inserts persist.' },
    updateOne: { summary: 'Field/array update operators on the first match; requires an operator doc; supports `upsert`/`arrayFilters`.',
      returns: '`{ acknowledged, matchedCount, modifiedCount[, upsertedId, upsertedCount] }`',
      notes: 'Field + array update operators (see the update-operator table); requires an operator document. `{ upsert: true }` inserts on no match; `{ arrayFilters }` drives `$[<id>]`. `modifiedCount` is 0 when matched-but-unchanged.',
      example: { seed: '[{_id:1,n:1}]', call: 'mm.updateOne(data, { _id: 1 }, { $inc: { n: 5 } })', result: { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null } } },
    updateMany: { summary: 'As `updateOne`, applied to all matches.',
      returns: '`{ acknowledged, matchedCount, modifiedCount[, upsertedId, upsertedCount] }`',
      notes: 'As `updateOne`, applied to all matches; same `upsert`/`arrayFilters` support.' },
    replaceOne: { summary: 'Replaces the first match in place (position preserved); rejects operator docs; supports `upsert`.',
      returns: '`{ acknowledged, matchedCount, modifiedCount[, upsertedId, upsertedCount] }`',
      notes: 'Replaces the first match in place, preserving position; rejects operator docs. `{ upsert: true }` inserts the replacement (seeded with the query\'s equality fields) on no match.' },
    deleteOne: { summary: 'Removes the first match in place; returns `{ acknowledged, deletedCount }`.', returns: '`{ acknowledged, deletedCount }`',
      notes: 'Removes the first match in place.',
      example: { seed: '[{_id:1},{_id:2}]', call: 'mm.deleteOne(data, { _id: 1 })', result: { acknowledged: true, deletedCount: 1 } } },
    deleteMany: { summary: 'Removes all matches in place.', returns: '`{ acknowledged, deletedCount }`',
      notes: 'Removes all matches in place (iterates backwards so the in-place `splice` doesn\'t skip elements).' },
    findOneAndUpdate: { summary: 'Applies an update and returns the doc **before** modification (Mongo default); honors `upsert`.', returns: '`Object`|`null`',
      notes: 'Applies an update and returns the document **before** modification (Mongo\'s default); `null` on no match. Honors `{ upsert: true }` (inserts, returning `null`).' },
    findOneAndReplace: { summary: 'Replaces and returns the doc **before** modification; honors `upsert`.', returns: '`Object`|`null`',
      notes: 'Replaces the first match and returns the document **before** modification; `null` on no match. Honors `{ upsert: true }`.' },
    findOneAndDelete: { summary: 'Deletes and returns the removed doc.', returns: '`Object`|`null`',
      notes: 'Deletes the first match and returns the removed document; `null` on no match.' },
    bulkWrite: { summary: 'Batches all six write kinds; `ordered` true (fail-fast) / false (continue + `writeErrors`).',
      returns: '`BulkWriteResult`',
      notes: 'Batches all six write kinds (`insertOne`/`updateOne`/`updateMany`/`replaceOne`/`deleteOne`/`deleteMany`), each delegating to the matching single-write method (so positional `$`, `upsert`, `arrayFilters` all work in a batch). `ordered` true (fail-fast) / false (continue + `writeErrors`); aggregated `BulkWriteResult`.' },
    aggregate: { summary: 'Runs a pipeline (subset of stages); deep-copies input, folds each stage into the next.', partial: true,
      returns: '`Array`',
      notes: 'Subset of stages — see the [Aggregation](#aggregation) section. Deep-copies the input, then folds each stage\'s output into the next, so it never touches the source array.',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.aggregate(data, [{ $group: { _id: "$s", n: { $sum: 1 } } }])', result: [{ _id: 'A', n: 2 }, { _id: 'B', n: 1 }] } },
    // micromongo-specific (no Mongo Collection equivalent)
    Collection: { extra: true, summary: 'micromongo-specific — the data-owning `Collection` class (opt-in indexes, chainable Cursor).', returns: '`Collection`' },
    Cursor: { extra: true, summary: 'micromongo-specific — the lazy chainable `Cursor` returned by `Collection.find()`.', returns: '`Cursor`',
      notes: 'Lazy chainable `Cursor` (`sort`/`skip`/`limit`/`project` + terminals `toArray`/`forEach`/`map`/`count`/`next`/`hasNext`/`explain`). Also **streams**: `for…of`/spread, `for await` (`Symbol.asyncIterator`), and a Node `.stream()` — with **early termination on `limit`** (no-sort path stops scanning) and a **bounded top-K heap** for `sort`+`limit` (O(K) memory, never buffers the full sorted array).' },
    collection: { extra: true, summary: 'micromongo-specific — register/retrieve a named collection (the `mm.db` namespace).', returns: '`Collection`' },
    configure: { extra: true, summary: 'micromongo-specific — process-wide defaults (`idProjectionMongo`/`whereTimeout`/`textSearch`/`autoId`).', returns: '`Settings`' },
    registerOperator: { extra: true, summary: 'micromongo-specific — the extension point for custom query operators.' },
    copyTo: { extra: true, summary: 'Deep-copies matches into a target array (Mongo\'s server-side `copyTo` was removed in 4.2).', returns: '`Number` (count)',
      notes: 'Deep-copies into `target`; **does not** clear it first. Non-standard return (Mongo\'s `copyTo` was server-side and removed in 4.2).' },
    insert: { extra: true, summary: 'Deprecated Mongo shell alias — dispatches to `insertOne`/`insertMany` by arg type.', returns: '`{ acknowledged, … }`',
      notes: 'Deprecated Mongo alias — dispatches to `insertOne`/`insertMany` by arg type. Kept as a convenience alias.' },
    remove: { extra: true, summary: 'Deprecated Mongo shell alias over `deleteOne`/`deleteMany`.', returns: '`{ nRemoved }`',
      notes: 'Deprecated Mongo alias over `deleteOne`/`deleteMany`. `options` = `{ justOne }` or boolean; returns the legacy `{ nRemoved }` shape.' },
    // Collection-ONLY methods (on the `Collection` class, NOT the functional `mm.*` API —
    // indexes need a data-owning Collection to stay valid). MongoDB methods here get `full`;
    // the micromongo-specific ones (getIndexes/indexStats/reindex/toArray) get `extra`.
    createIndex: { summary: '**Collection-only.** Build an ordered index (single-field / multikey / compound).', returns: '`String` (index name)',
      notes: '**Collection-only** (the functional `mm.*` API can\'t own the array to keep an index valid). Accepts `createIndex(\'field\')` or `createIndex({ a: 1, b: 1 })`; idempotent. Returns the Mongo-style index **name** (e.g. `a_1_b_-1`), matching the driver. Serves equality/range/sort/`$in`/compound-prefix/`$or`. Not `unique`/`partial`/`sparse`; no text/geo/hashed/TTL types.' },
    createIndexes: { summary: '**Collection-only.** Build several indexes at once.', returns: '`Array` (index names)',
      notes: '**Collection-only.** Accepts driver `[{ key: {…} }]` specs or bare field specs; returns the created index **names** (`string[]`), matching the driver.' },
    dropIndex: { summary: '**Collection-only.** Drop one index by name/spec.', returns: '`{ ok: 1 }`',
      notes: '**Collection-only.** Returns `{ ok: 1 }` (driver shape); a no-op when the index is absent.' },
    dropIndexes: { summary: '**Collection-only.** Drop every index.', returns: '`Boolean`',
      notes: '**Collection-only.** Removes all built indexes; returns `true` (driver shape).' },
    indexes: { summary: '**Collection-only.** Index specs in driver shape `[{ v, key, name }]`.', returns: '`Array`',
      notes: '**Collection-only.** The driver\'s `indexes()`/`listIndexes()` shape, built from the same metadata `indexStats()` reports (Mongo-style names like `a_1_b_-1`).' },
    listIndexes: { summary: '**Collection-only.** Alias of `indexes()` (driver `listIndexes()`).', returns: '`Array`',
      notes: '**Collection-only.** Same `[{ v, key, name }]` specs as `indexes()`. (The `micromongo/mock` adapter wraps this in an async cursor.)' },
    indexInformation: { summary: '**Collection-only.** `{ <name>: [[field, dir], …] }` index map.', returns: '`Object`',
      notes: '**Collection-only.** The driver\'s `indexInformation()` shape.' },
    indexExists: { summary: '**Collection-only.** Whether an index (by Mongo-style name) exists.', returns: '`Boolean`',
      notes: '**Collection-only.** Accepts a name or an array of names (all must exist).' },
    // micromongo-specific Collection methods (no Mongo equivalent)
    getIndexes: { extra: true, summary: 'micromongo-specific — **Collection-only** list of internal index names.', returns: '`Array`',
      notes: '**Collection-only.** Lists index names in micromongo\'s internal form (single-field indexes list as the bare field). For the driver-shaped specs use `indexes()`/`listIndexes()`.' },
    indexStats: { extra: true, summary: 'micromongo-specific — **Collection-only** per-index usage stats.', returns: '`Array`',
      notes: '**Collection-only.** Per-index `{ name, key, accesses: { ops } }` (Mongo-style names); also powers the `$indexStats` aggregation stage.' },
    reindex: { extra: true, summary: 'micromongo-specific — **Collection-only** rebuild of all indexes.', returns: '`Collection`',
      notes: '**Collection-only.** Recovery hook if `toArray()` was mutated directly (bypassing index maintenance).' },
    toArray: { extra: true, summary: 'micromongo-specific — **Collection-only** access to the owned array.', returns: '`Array`',
      notes: '**Collection-only.** Returns the live owned array (not a copy) — mutating it bypasses index maintenance (`reindex()` recovers).' },
  },

  // ---- Aggregation stages --------------------------------------------------------------
  stage: {
    '$match': { summary: 'Reuses the full query engine, so all query-operator support/limits apply.',
      example: { seed: '[{n:1},{n:2},{n:3}]', call: 'mm.aggregate(data, [{ $match: { n: { $gte: 2 } } }])', result: [{ n: 2 }, { n: 3 }] } },
    '$project': { summary: 'Inclusion/exclusion **and** computed/expression fields via the expression engine.', notes: 'Inclusion/exclusion **and computed/expression fields** (`{ total: { $multiply: [...] } }`) via the expression engine.',
      example: { seed: '[{_id:1,a:2,b:3}]', call: 'mm.aggregate(data, [{ $project: { _id: 0, a: 1 } }])', result: [{ a: 2 }] } },
    '$addFields': { summary: 'Add/overwrite fields with computed expression values, keeping existing fields.',
      example: { seed: '[{a:2,b:3}]', call: 'mm.aggregate(data, [{ $addFields: { s: { $add: ["$a","$b"] } } }])', result: [{ a: 2, b: 3, s: 5 }] } },
    '$set': { summary: 'Alias of `$addFields`.', notes: 'Add/overwrite fields with computed expression values, keeping existing fields.',
      example: { seed: '[{a:2}]', call: 'mm.aggregate(data, [{ $set: { a2: { $multiply: ["$a",2] } } }])', result: [{ a: 2, a2: 4 }] } },
    '$unset': { summary: 'Remove one field or a list of fields.',
      example: { seed: '[{a:1,b:2}]', call: 'mm.aggregate(data, [{ $unset: "b" }])', result: [{ a: 1 }] } },
    '$count': { summary: 'Single output doc `{ <field>: <n input docs> }`.',
      example: { seed: '[{},{},{}]', call: 'mm.aggregate(data, [{ $count: "n" }])', result: [{ n: 3 }] } },
    '$replaceRoot': { summary: 'Promote the document resolved from `newRoot` to the top level.', notes: 'Promote the document resolved from `newRoot` (an expression, e.g. `$mergeObjects`) to the top level.',
      example: { seed: '[{a:{x:1}}]', call: 'mm.aggregate(data, [{ $replaceRoot: { newRoot: "$a" } }])', result: [{ x: 1 }] } },
    '$replaceWith': { summary: 'Alias of `$replaceRoot` (expression form).', notes: 'Promote the document resolved from `newRoot` (an expression, e.g. `$mergeObjects`) to the top level.',
      example: { seed: '[{a:{x:1}}]', call: 'mm.aggregate(data, [{ $replaceWith: "$a" }])', result: [{ x: 1 }] } },
    '$sortByCount': { summary: 'Group by expression + count, sorted by count desc (= `$group` + `$sort`).',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.aggregate(data, [{ $sortByCount: "$s" }])', result: [{ _id: 'A', count: 2 }, { _id: 'B', count: 1 }] } },
    '$limit': { summary: 'Number only.',
      example: { seed: '[{n:1},{n:2},{n:3}]', call: 'mm.aggregate(data, [{ $limit: 2 }])', result: [{ n: 1 }, { n: 2 }] } },
    '$skip': { summary: 'Number only.',
      example: { seed: '[{n:1},{n:2},{n:3}]', call: 'mm.aggregate(data, [{ $skip: 2 }])', result: [{ n: 3 }] } },
    '$sort': { summary: 'Multi-key supported; direction must be `1`/`-1`; array/object sort values not supported.', notes: 'Multi-key `{ a: 1, \'b.c\': -1 }` supported; direction must be `1`/`-1`; **array/object sort values not supported**.', partial: true,
      example: { seed: '[{n:3},{n:1},{n:2}]', call: 'mm.aggregate(data, [{ $sort: { n: 1 } }])', result: [{ n: 1 }, { n: 2 }, { n: 3 }] } },
    '$unwind': { summary: 'String form and `{ path, includeArrayIndex, preserveNullAndEmptyArrays }`.', notes: 'Supports string form and `{ path, includeArrayIndex, preserveNullAndEmptyArrays }`. (Two `includeArrayIndex` bugs fixed — see [Known bugs](#known-bugs).)', partial: true,
      example: { seed: '[{_id:1,t:["x","y"]}]', call: 'mm.aggregate(data, [{ $unwind: "$t" }])', result: [{ _id: 1, t: 'x' }, { _id: 1, t: 'y' }] } },
    '$sample': { summary: 'Random sampling `{ size: n }`; size ≥ length returns all.' },
    '$geoNear': { summary: 'Filter by distance + sort nearest-first + write `distanceField`; planar/spherical.', notes: 'Filter by distance + sort nearest-first + write `distanceField`; legacy planar / spherical; `query`/`min`/`maxDistance`/`distanceMultiplier`.' },
    '$group': { summary: 'Group key + accumulators (`$sum`/`$avg`/`$min`/`$max`/`$push`/`$addToSet`/`$first`/`$last`/`$count`).', notes: 'Group key (field/expression/object/`null`) + accumulators `$sum` `$avg` `$min` `$max` `$push` `$addToSet` `$first` `$last` `$count`.',
      example: { seed: '[{s:"A"},{s:"B"},{s:"A"}]', call: 'mm.aggregate(data, [{ $group: { _id: "$s", n: { $sum: 1 } } }])', result: [{ _id: 'A', n: 2 }, { _id: 'B', n: 1 }] } },
    '$redact': { summary: '`$$DESCEND`/`$$PRUNE`/`$$KEEP` traversal via the expression engine.', notes: '`$$DESCEND`/`$$PRUNE`/`$$KEEP` traversal over embedded docs + arrays-of-docs, via the expression engine.' },
    '$lookup': { summary: 'Left outer equality join; `from` = a registered name, a Collection, or an array.', notes: 'Left outer equality join. `from` = a registered name, a `Collection`, or an array; array-valued `localField` matches each element.',
      example: { seed: '[{_id:1,k:"a"}]', call: 'mm.aggregate(data, [{ $lookup: { from: [{k:"a",v:9}], localField: "k", foreignField: "k", as: "j" } }])', result: [{ _id: 1, k: 'a', j: [{ k: 'a', v: 9 }] }] } },
    '$out': { summary: 'In-memory sink; replaces the target\'s contents; must be the last stage.', notes: 'In-memory sink. `{ $out: "name" }` (registry), `{ $out: <Collection|array> }`. Replaces the target\'s contents; must be the last stage.' },
    '$indexStats': { summary: 'Per-index usage via `Collection.aggregate`; empty for a bare-array `aggregate`.', notes: 'Per-index usage via `Collection.aggregate` (`options.indexStats`); empty for a bare-array `aggregate`.' },
  },

  // ---- Aggregation expression operators ------------------------------------------------
  exprOp: {
    // arithmetic
    '$abs': { summary: 'Absolute value.' },
    '$add': { summary: 'Sum of numbers.',
      example: { seed: '[{a:2,b:3}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $add: ["$a","$b"] } } }])', result: [{ r: 5 }] } },
    '$subtract': { summary: 'Difference of two numbers.',
      example: { seed: '[{a:5,b:3}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $subtract: ["$a","$b"] } } }])', result: [{ r: 2 }] } },
    '$multiply': { summary: 'Product of numbers.',
      example: { seed: '[{a:2,b:3}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $multiply: ["$a","$b"] } } }])', result: [{ r: 6 }] } },
    '$divide': { summary: 'Quotient of two numbers.' }, '$mod': { summary: 'Remainder.' },
    '$ceil': { summary: 'Round up to integer.' }, '$floor': { summary: 'Round down to integer.' },
    '$round': { summary: 'Round to a given precision.' }, '$sqrt': { summary: 'Square root.' },
    '$pow': { summary: 'Base raised to an exponent.' },
    // string
    '$concat': { summary: 'Concatenate strings.',
      example: { seed: '[{a:"x",b:"y"}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $concat: ["$a","$b"] } } }])', result: [{ r: 'xy' }] } },
    '$toUpper': { summary: 'Uppercase a string.',
      example: { seed: '[{a:"hi"}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $toUpper: "$a" } } }])', result: [{ r: 'HI' }] } },
    '$toLower': { summary: 'Lowercase a string.' }, '$split': { summary: 'Split a string on a delimiter.' },
    '$strLenCP': { summary: 'Code-point length of a string.' }, '$substr': { summary: 'Substring (bytes).' },
    '$substrCP': { summary: 'Substring (code points).' }, '$trim': { summary: 'Trim whitespace/chars.' },
    // comparison / conditional / boolean
    '$eq': { summary: 'Equality (expression form).' }, '$ne': { summary: 'Inequality.' },
    '$gt': { summary: 'Greater-than.' }, '$gte': { summary: 'Greater-or-equal.' },
    '$lt': { summary: 'Less-than.' }, '$lte': { summary: 'Less-or-equal.' }, '$cmp': { summary: 'Three-way compare (-1/0/1).' },
    '$cond': { summary: 'If/then/else.',
      example: { seed: '[{a:5}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $cond: [{ $gt: ["$a",3] }, "big", "small"] } } }])', result: [{ r: 'big' }] } },
    '$ifNull': { summary: 'First non-null of its args.' },
    '$switch': { summary: 'Multi-branch case expression.' },
    '$and': { summary: 'Logical AND.' }, '$or': { summary: 'Logical OR.' }, '$not': { summary: 'Logical NOT.' },
    // array / object
    '$size': { summary: 'Array length.',
      example: { seed: '[{a:[1,2,3]}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $size: "$a" } } }])', result: [{ r: 3 }] } },
    '$arrayElemAt': { summary: 'Element at an index.' },
    '$in': { summary: 'Membership test (value in array).' }, '$concatArrays': { summary: 'Concatenate arrays.' },
    '$reverseArray': { summary: 'Reverse an array.' },
    '$map': { summary: 'Transform each element.',
      example: { seed: '[{a:[1,2]}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $map: { input: "$a", as: "x", in: { $multiply: ["$$x",10] } } } } }])', result: [{ r: [10, 20] }] } },
    '$filter': { summary: 'Keep elements matching a condition.',
      example: { seed: '[{a:[1,2,3,4]}]', call: 'mm.aggregate(data, [{ $project: { _id:0, r: { $filter: { input: "$a", as: "x", cond: { $gt: ["$$x",2] } } } } }])', result: [{ r: [3, 4] }] } },
    '$mergeObjects': { summary: 'Merge objects left-to-right.' },
    // misc
    '$rand': { summary: 'Random float in `[0,1)` (also usable in `$expr`).' },
  },

  // ---- Query operators -----------------------------------------------------------------
  queryOp: {
    // comparison
    '$eq': { summary: 'Deep-equals; array-aware (element-equals + array-equals).',
      example: { seed: '[{a:1},{a:2}]', call: 'mm.find(data, { a: { $eq: 2 } })', result: [{ a: 2 }] } },
    '$ne': { summary: 'Strict `!==` (not deep).', notes: 'Uses strict `!==`; **not** deep — `$ne` against an object/array won\'t deep-compare.', partial: true },
    '$gt': { summary: 'Native `>` (array-aware: any element).',
      example: { seed: '[{a:1},{a:5}]', call: 'mm.find(data, { a: { $gt: 3 } })', result: [{ a: 5 }] } },
    '$gte': { summary: 'Native `>=`.' },
    '$lt': { summary: 'Native `<`.' }, '$lte': { summary: 'Native `<=`.' },
    '$in': { summary: 'Array membership; supports regex members and array-valued fields.',
      example: { seed: '[{a:1},{a:2},{a:3}]', call: 'mm.find(data, { a: { $in: [1,3] } })', result: [{ a: 1 }, { a: 3 }] } },
    '$nin': { summary: 'Scalar membership only (no array-valued fields).', notes: 'Scalar membership only — does not handle array-valued document fields.', partial: true },
    // logical
    '$and': { summary: 'All sub-queries match.',
      example: { seed: '[{a:1,b:1},{a:1,b:2}]', call: 'mm.find(data, { $and: [{ a: 1 }, { b: 2 }] })', result: [{ a: 1, b: 2 }] } },
    '$or': { summary: 'Any sub-query matches.',
      example: { seed: '[{a:1},{a:9}]', call: 'mm.find(data, { $or: [{ a: 1 }, { a: 2 }] })', result: [{ a: 1 }] } },
    '$nor': { summary: 'No sub-query matches.' }, '$not': { summary: 'Field-level negation of its sub-expression.' },
    // element / eval
    '$exists': { summary: 'Field presence (boolean only).',
      example: { seed: '[{a:1},{b:2}]', call: 'mm.find(data, { a: { $exists: true } })', result: [{ a: 1 }] } },
    '$type': { summary: 'JS `typeof`-style names (diverges from BSON aliases).', notes: 'Accepts JS `typeof`-style names (`\'boolean\'`,`\'number\'`,`\'string\'`,`\'object\'`,`\'undefined\'`,`\'null\'`,`\'array\'`). **Diverges from MongoDB:** Mongo takes BSON aliases/codes (`"double"`,`"int"`,`"objectId"`,`2`,…) — micromongo rejects all of those, and its `\'number\'` is JS-`typeof` (any JS number), whereas Mongo\'s `"number"` is a BSON alias for double/int/long/decimal. Mongo has no `"undefined"` BSON type; micromongo does accept it.', partial: true },
    '$mod': { summary: '`[divisor, remainder]`.',
      example: { seed: '[{n:4},{n:5}]', call: 'mm.find(data, { n: { $mod: [2,0] } })', result: [{ n: 4 }] } },
    '$regex': { summary: 'Requires a `RegExp` object; partial `$options` support.', notes: 'Requires a `RegExp` object; `/pattern/` string form via `$options` partially handled; `o`/`x` options unsupported.', partial: true,
      example: { seed: '[{s:"abc"},{s:"xyz"}]', call: 'mm.find(data, { s: { $regex: /^a/ } })', result: [{ s: 'abc' }] } },
    '$options': { summary: 'Regex flags — consumed by `$regex` (inert on its own).' },
    '$where': { summary: 'Runs user JS (doc as `this`); timeout via `whereTimeout`. Trusted-input only.', notes: 'Runs arbitrary JS; doc bound as `this`. Timeout `whereTimeout` (default 1000 ms, `mm.configure`). ⚠️ The Node `vm` is **not a security sandbox** — **trusted-input-only**.', partial: true },
    '$expr': { summary: 'Match on the truthiness of an aggregation expression (safe, no `vm`).', notes: 'Evaluates an aggregation expression against the whole document and matches on truthiness (`{ $expr: { $gt: [\'$a\',\'$b\'] } }`); reuses the aggregation expression evaluator as a `pre`-operator. Safe (no `vm`), unlike `$where`.',
      example: { seed: '[{a:5,b:3},{a:1,b:9}]', call: 'mm.find(data, { $expr: { $gt: ["$a","$b"] } })', result: [{ a: 5, b: 3 }] } },
    '$comment': { summary: 'Logs the comment; no effect on matching.', notes: 'Implemented as a preprocess op; **logs the comment to the console**.' },
    '$text': { summary: 'In-memory full-text search, 3 fidelity modes; approximate.', notes: 'In-memory full-text search, 3 fidelity modes via `mm.configure({ textSearch })`; OR/phrase/negation. **Approximate** — see [Text search](#text-search-text--meta).', partial: true },
    // array
    '$all': { summary: 'Array contains all listed values.', notes: 'No support for nested arrays or combination with `$elemMatch`.', partial: true,
      example: { seed: '[{t:["x","y","z"]},{t:["x"]}]', call: 'mm.find(data, { t: { $all: ["x","y"] } })', result: [{ t: ['x', 'y', 'z'] }] } },
    '$elemMatch': { summary: 'An array element matches the sub-query (query + projection forms).',
      example: { seed: '[{a:[{n:1},{n:9}]}]', call: 'mm.find(data, { a: { $elemMatch: { n: { $gt: 5 } } } })', result: [{ a: [{ n: 1 }, { n: 9 }] }] } },
    '$size': { summary: 'Exact array length (number only).',
      example: { seed: '[{t:[1,2]},{t:[1]}]', call: 'mm.find(data, { t: { $size: 2 } })', result: [{ t: [1, 2] }] } },
    // bitwise
    '$bitsAllSet': { summary: 'All given bits set.',
      example: { seed: '[{f:6},{f:1}]', call: 'mm.find(data, { f: { $bitsAllSet: [1,2] } })', result: [{ f: 6 }] } },
    '$bitsAnySet': { summary: 'Any given bit set.' },
    '$bitsAllClear': { summary: 'All given bits clear.' }, '$bitsAnyClear': { summary: 'Any given bit clear.' },
    // geo (operators + sub-operands)
    '$geoWithin': { summary: 'Point within a shape (`$box`/`$center`/`$centerSphere`/`$polygon`/`$geometry`).', notes: 'Shapes `$box`, `$center`, `$centerSphere`, `$polygon`, `$geometry` (GeoJSON Polygon/MultiPolygon).',
      example: { seed: '[{loc:[1,1]},{loc:[9,9]}]', call: 'mm.find(data, { loc: { $geoWithin: { $center: [[0,0], 5] } } })', result: [{ loc: [1, 1] }] } },
    '$geoIntersects': { summary: 'Point within a `$geometry` polygon (treated as containment).', partial: true },
    '$near': { summary: 'Distance filter (legacy planar); `$min`/`$maxDistance`. No auto-sort (use `$geoNear`).', notes: 'Legacy (planar) + GeoJSON (spherical/meters); `$minDistance`/`$maxDistance`. Filtering only — find does not auto-sort by distance (use `$geoNear` for ordering).' },
    '$nearSphere': { summary: 'Distance filter (spherical/meters).', notes: 'Legacy (planar) + GeoJSON (spherical/meters); `$minDistance`/`$maxDistance`. Filtering only — find does not auto-sort by distance (use `$geoNear` for ordering).' },
    '$geometry': { extra: true, summary: 'GeoJSON operand — consumed by geo operators (inert alone).' },
    '$minDistance': { extra: true, summary: 'Geo sub-operand — min distance for `$near`/`$nearSphere`.' },
    '$maxDistance': { summary: 'Geo sub-operand — max distance for `$near`/`$nearSphere`.' },
    '$center': { extra: true, summary: 'Legacy circle operand for `$geoWithin`.' },
    '$centerSphere': { extra: true, summary: 'Spherical circle operand for `$geoWithin`.' },
    '$box': { extra: true, summary: 'Rectangle operand for `$geoWithin`.' },
    '$polygon': { extra: true, summary: 'Polygon operand for `$geoWithin`.' },
    '$uniqueDocs': { extra: true, summary: 'Legacy no-op (deprecated in MongoDB).' },
  },

  // ---- Update operators ----------------------------------------------------------------
  updateOp: {
    // NOTE: update examples call updateOne then read back data[0] (the mutated doc), since
    // the update methods return a report — the interesting artifact is the changed document.
    '$set': { summary: 'Set/create a field; dotted paths supported.',
      example: { seed: '[{_id:1,a:1}]', call: '(mm.updateOne(data, { _id: 1 }, { $set: { a: 9 } }), data[0])', result: { _id: 1, a: 9 } } },
    '$unset': { summary: 'Remove a field (no-op if absent).',
      example: { seed: '[{_id:1,a:1,b:2}]', call: '(mm.updateOne(data, { _id: 1 }, { $unset: { b: "" } }), data[0])', result: { _id: 1, a: 1 } } },
    '$inc': { summary: 'Increment (missing ⇒ set to increment). Numeric only.',
      example: { seed: '[{_id:1,n:1}]', call: '(mm.updateOne(data, { _id: 1 }, { $inc: { n: 5 } }), data[0])', result: { _id: 1, n: 6 } } },
    '$mul': { summary: 'Multiply (missing ⇒ 0). Numeric only.',
      example: { seed: '[{_id:1,n:3}]', call: '(mm.updateOne(data, { _id: 1 }, { $mul: { n: 2 } }), data[0])', result: { _id: 1, n: 6 } } },
    '$min': { summary: 'Write only if new value `<` current (JS compare).', notes: 'Writes only if new value `<` current; sets if field missing. JS `<` comparison (not BSON type order).',
      example: { seed: '[{_id:1,n:5}]', call: '(mm.updateOne(data, { _id: 1 }, { $min: { n: 3 } }), data[0])', result: { _id: 1, n: 3 } } },
    '$max': { summary: 'Write only if new value `>` current.', notes: 'Writes only if new value `>` current; sets if missing. JS `>` comparison.',
      example: { seed: '[{_id:1,n:5}]', call: '(mm.updateOne(data, { _id: 1 }, { $max: { n: 9 } }), data[0])', result: { _id: 1, n: 9 } } },
    '$rename': { summary: 'Rename a field (no-op if source absent; overwrites target).',
      example: { seed: '[{_id:1,a:1}]', call: '(mm.updateOne(data, { _id: 1 }, { $rename: { a: "b" } }), data[0])', result: { _id: 1, b: 1 } } },
    '$currentDate': { summary: '`true` or `{ $type: "date" }` ⇒ JS `Date`; `timestamp` throws.', notes: '`true` or `{ $type: \'date\' }` ⇒ JS `Date`. `{ $type: \'timestamp\' }` throws (no BSON Timestamp).', partial: true },
    '$setOnInsert': { summary: 'Applied only when an `upsert` inserts (no-op on matched update).' },
    '$bit': { summary: '`and`/`or`/`xor` on an integer field.', notes: '`{ $bit: { f: { and|or|xor: <int> } } }`; ops applied in spec order; missing field treated as `0`; non-numeric throws.',
      example: { seed: '[{_id:1,f:5}]', call: '(mm.updateOne(data, { _id: 1 }, { $bit: { f: { or: 2 } } }), data[0])', result: { _id: 1, f: 7 } } },
    '$push': { summary: 'Append to an array; `$each`/`$position`/`$slice`/`$sort` modifiers.', notes: 'Creates the array if missing; supports `$each`/`$position`/`$slice`/`$sort` modifiers.',
      example: { seed: '[{_id:1,t:[1]}]', call: '(mm.updateOne(data, { _id: 1 }, { $push: { t: 2 } }), data[0])', result: { _id: 1, t: [1, 2] } } },
    '$addToSet': { summary: 'Add if absent (deep-equal dedup); `$each`.',
      example: { seed: '[{_id:1,t:[1,2]}]', call: '(mm.updateOne(data, { _id: 1 }, { $addToSet: { t: 2 } }), data[0])', result: { _id: 1, t: [1, 2] } } },
    '$pop': { summary: '`1` removes last, `-1` first.', notes: '`1` removes last, `-1` removes first; no-op on missing/empty.',
      example: { seed: '[{_id:1,t:[1,2,3]}]', call: '(mm.updateOne(data, { _id: 1 }, { $pop: { t: 1 } }), data[0])', result: { _id: 1, t: [1, 2] } } },
    '$pull': { summary: 'Remove by value or by query condition (reuses the match engine).', notes: 'By exact value **or** by query condition (reuses the match engine, e.g. `{ $gt: 5 }`).',
      example: { seed: '[{_id:1,t:[1,2,3]}]', call: '(mm.updateOne(data, { _id: 1 }, { $pull: { t: { $gt: 1 } } }), data[0])', result: { _id: 1, t: [1] } } },
    '$pullAll': { summary: 'Remove every listed value (exact match).',
      example: { seed: '[{_id:1,t:[1,2,3,2]}]', call: '(mm.updateOne(data, { _id: 1 }, { $pullAll: { t: [2] } }), data[0])', result: { _id: 1, t: [1, 3] } } },
  },
};
