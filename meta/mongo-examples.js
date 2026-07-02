'use strict';

/**
 * mongo-examples.js — the ONE canonical set of MongoDB behavior examples (aggregating index).
 *
 * Each record is a single fact — "operator X, on fixture F, via operation OP, produces R (per the
 * MongoDB docs at SOURCE)" — expressed as DATA. From this one record we derive FIVE projections
 * (see planning/unified-examples.md):
 *   1. a micromongo conformance test           (test/meta/mongo-examples.js)
 *   2. a live-Mongo differential test          (test-mongo/differential.mjs)
 *   3. compat-matrix example bodies            (scripts/gen-compat-tables.js)
 *   4. HTML playground cards                   (docs/index.html — only `docs: true` records)
 *   5. the -mongodoc provenance                (the `source` URL + `expect`)
 *
 * Record shape (one file per source under meta/mongo-examples/, each exporting an array):
 *   {
 *     op:      '$gt',            // operator/stage/method exemplified (grouping key)
 *     kind:    'queryOp',        // method | stage | exprOp | queryOp | updateOp | projection
 *     title:   'Greater Than',   // human label (doc heading)
 *     source:  'https://…',      // MongoDB docs URL this is ported from (provenance)
 *     fixture: [ {…}, … ],       // seed docs — REAL data (deep-cloned per run)
 *     do:      { <opName>: {…} },// operation AS DATA — see meta/apply-example.js for supported ops
 *     expect:  <value>,          // the documented result (deep-equal target)
 *     real:    'exact',          // vs live Mongo: 'exact' | 'skip:<why>' | 'structural:<kind>'
 *     docs:    true,             // include in the HTML playground (curated ~1-per-op subset)
 *   }
 *
 * `do` is a ONE-KEY object naming the operation. For a MUTATING op (updateOne/deleteOne/…) `expect`
 * is the resulting DOCUMENTS (the mutation), not the driver report — so micromongo and real Mongo
 * compare on state. Keep `expect` and post-op docs ORDER-STABLE (records add an `_id`; the runner
 * sorts by `_id`). ALL records drive the tests; only `docs: true` records feed the HTML playground.
 */

var fs = require('fs');
var path = require('path');

// Which ops mutate (result = the array state after) vs. read (result = the return value).
var MUTATING = { updateOne: 1, updateMany: 1, replaceOne: 1, deleteOne: 1, deleteMany: 1, insertOne: 1, insertMany: 1 };

// Concatenate every array exported by the per-source files in meta/mongo-examples/ (sorted, so
// order is stable). Each *.js there is one MongoDB doc page's ported examples.
function loadExamples() {
  var dir = path.join(__dirname, 'mongo-examples');
  var out = [];
  fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); }).sort().forEach(function (f) {
    var recs = require(path.join(dir, f));
    if (!Array.isArray(recs)) { throw new Error('meta/mongo-examples/' + f + ' must export an array of records'); }
    recs.forEach(function (r) { r._file = f; out.push(r); }); // _file aids failure messages
  });
  return out;
}

module.exports = {
  MUTATING: MUTATING,
  examples: loadExamples(),
};
