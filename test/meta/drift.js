'use strict';

/**
 * Drift guard for the OPERATION-level surfaces (companion to filter-operators-drift.js,
 * which covers query/update operators). Compares micromongo's ACTUAL runtime support —
 * derived from the live registries, not a hand list — against MongoDB's authoritative
 * sets from `scripts/gen-mongo-operations.js` (mongo-operations.generated.json):
 *
 *   1. collectionMethods    — the public `mm.*` methods
 *   2. aggregationStages    — the `_aggregateStageOps` map
 *   3. expressionOperators  — the `expressionOps` map
 *
 * Two directions per surface:
 *   (a) ours ⊆ Mongo  — every method/stage/op we implement is a REAL MongoDB one
 *       (catches typos / non-standard names). This is exact and the high-value guard.
 *   (b) new-Mongo triage — a NEW Mongo method/stage/op (after bumping the driver or
 *       re-curating from the manual) is surfaced. Rather than hand-list the 150+ things
 *       micromongo deliberately doesn't implement (index/admin/search methods, the long
 *       tail of date/set/trig expression operators, etc.), we pin the CURRENT count of
 *       Mongo-minus-ours per surface; if Mongo grows, the count rises and the test fails,
 *       pointing you to re-triage. Bump the baseline (with a note) when that happens.
 *
 * When this fails:
 *   - (a) failing → you registered a method/stage/op MongoDB doesn't have (fix the typo,
 *         or if intentionally non-standard add it to the ALLOWED_EXTRA_* list).
 *   - (b) failing → MongoDB gained operations; implement them, or bump the baseline count
 *         after confirming they're intentionally unsupported.
 */

var chai = require('chai');
var expect = chai.expect;

var MONGO = require('../../meta/mongo-operations.generated.json');

var mm = require('../../dist/index');
var aggregate = require('../../dist/aggregate/');
var expression = require('../../dist/aggregate/expression');

function toSet(arr) { var s = {}; arr.forEach(function (k) { s[k] = true; }); return s; }

// ours ⊆ mongo (minus documented non-standard extras); return the offenders.
function nonStandard(ours, mongoSet, allowedExtra) {
  return ours.filter(function (x) { return !mongoSet[x] && !(allowedExtra && allowedExtra[x]); }).sort();
}
// mongo − ours = the deliberately-unsupported set (its SIZE is the drift baseline).
function unsupported(mongo, ourSet) {
  return mongo.filter(function (x) { return !ourSet[x]; }).sort();
}


describe('# Mongo-operations drift: methods / stages / expression ops (generated)', function () {

  // ---- 1. Collection methods -----------------------------------------------------------

  // Public methods micromongo exposes that are NOT MongoDB Collection methods — they are
  // micromongo-specific (the Collection/Cursor classes, the settings/registry surface, and
  // deprecated Mongo aliases kept for convenience). Allowed as "ours but not Mongo's".
  var ALLOWED_EXTRA_METHODS = {
    Collection: 1, Cursor: 1, collection: 1, // micromongo class/registry surface
    configure: 1, registerOperator: 1,       // micromongo config + extension point
    copyTo: 1,                               // legacy helper (Mongo's server-side copyTo removed in 4.2)
    insert: 1, remove: 1,                    // deprecated Mongo shell aliases we keep
  };
  // MongoDB Collection methods micromongo deliberately does NOT implement on the functional
  // `mm.*` surface — index/admin/search/change-stream/bulk-builder operations that need a
  // server, storage engine, or a data-owning Collection.
  // Was 22; dropped to 19 when `countDocuments`/`estimatedDocumentCount`/`drop` were added to
  // `mm.*` (for parity with the driver + the `micromongo/mock` adapter). Note: the index and
  // bulk-builder methods (createIndex(es)/listIndexes/indexes/indexExists/initialize*BulkOp/…)
  // ARE implemented on `Collection`, just not on the functional `mm.*` API this guard reads —
  // indexes require a data-owning Collection by design.
  var UNSUPPORTED_METHODS_BASELINE = 19;

  it('# collection methods: ours ⊆ Mongo (no non-standard method slipped in)', function () {
    var ours = Object.keys(mm).filter(function (k) { return typeof mm[k] === 'function' && k.charAt(0) !== '_'; });
    var offenders = nonStandard(ours, toSet(MONGO.collectionMethods), ALLOWED_EXTRA_METHODS);
    expect(offenders).eql([],
      'micromongo exposes method(s) MongoDB has no equivalent for: ' + JSON.stringify(offenders) +
      '. Fix a typo, or add to ALLOWED_EXTRA_METHODS if intentionally micromongo-specific.');
  });

  it('# collection methods: new Mongo methods are triaged (unsupported count baseline)', function () {
    var ourSet = toSet(Object.keys(mm));
    var missing = unsupported(MONGO.collectionMethods, ourSet);
    expect(missing.length).eql(UNSUPPORTED_METHODS_BASELINE,
      'The set of MongoDB Collection methods micromongo does not implement changed (now ' + missing.length +
      ', baseline ' + UNSUPPORTED_METHODS_BASELINE + '): ' + JSON.stringify(missing) +
      '. If MongoDB added a method, implement it or bump UNSUPPORTED_METHODS_BASELINE with a note.');
  });

  // ---- 2. Aggregation stages -----------------------------------------------------------

  // MongoDB stages micromongo deliberately does NOT implement — bucketing/faceting,
  // Atlas search/vector, change-streams, time-series windowing, and server-stats stages
  // (none feasible over a plain in-memory array; see planning/compatibility.md).
  var UNSUPPORTED_STAGES_BASELINE = 20;

  it('# aggregation stages: ours ⊆ Mongo (no non-standard stage slipped in)', function () {
    var ours = Object.keys(aggregate._aggregateStageOps);
    var offenders = nonStandard(ours, toSet(MONGO.aggregationStages), null);
    expect(offenders).eql([],
      'micromongo implements aggregation stage(s) MongoDB does not have: ' + JSON.stringify(offenders) +
      '. Fix a typo in _aggregateStageOps.');
  });

  it('# aggregation stages: new Mongo stages are triaged (unsupported count baseline)', function () {
    var ourSet = toSet(Object.keys(aggregate._aggregateStageOps));
    var missing = unsupported(MONGO.aggregationStages, ourSet);
    expect(missing.length).eql(UNSUPPORTED_STAGES_BASELINE,
      'The set of unimplemented MongoDB stages changed (now ' + missing.length + ', baseline ' +
      UNSUPPORTED_STAGES_BASELINE + '): ' + JSON.stringify(missing) +
      '. If MongoDB added a stage, implement it or bump UNSUPPORTED_STAGES_BASELINE with a note.');
  });

  // ---- 3. Aggregation expression operators ---------------------------------------------

  // The long tail micromongo deliberately does NOT implement — most date/type-conversion/
  // set/trig operators and the rarer array/string ones (the expression engine is a
  // "pragmatic core"; see planning/compatibility.md → Expression operators).
  var UNSUPPORTED_EXPRESSION_BASELINE = 120;

  it('# expression operators: ours ⊆ Mongo (no non-standard expression op slipped in)', function () {
    var ours = Object.keys(expression.expressionOps);
    var offenders = nonStandard(ours, toSet(MONGO.expressionOperators), null);
    expect(offenders).eql([],
      'micromongo implements expression operator(s) MongoDB does not have: ' + JSON.stringify(offenders) +
      '. Fix a typo in expressionOps.');
  });

  it('# expression operators: new Mongo expression ops are triaged (unsupported count baseline)', function () {
    var ourSet = toSet(Object.keys(expression.expressionOps));
    var missing = unsupported(MONGO.expressionOperators, ourSet);
    expect(missing.length).eql(UNSUPPORTED_EXPRESSION_BASELINE,
      'The set of unimplemented MongoDB expression operators changed (now ' + missing.length +
      ', baseline ' + UNSUPPORTED_EXPRESSION_BASELINE + '). If MongoDB added one, implement it or ' +
      'bump UNSUPPORTED_EXPRESSION_BASELINE with a note. (List omitted — it is long by design.)');
  });

});
