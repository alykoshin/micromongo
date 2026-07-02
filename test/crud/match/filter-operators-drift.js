'use strict';

/**
 * Drift guard: the hand-written `FilterOperators<V>` / `RootFilterOperators<T>`
 * types in `src/types.ts` must stay in sync with the operators the engine
 * actually registers. TypeScript can't read the runtime registry to *infer* the
 * type (types are erased; per the MongoDB driver, `FilterOperators` is hand-
 * written too — its per-operator value types, `$gt?:V` vs `$in?:V[]`, can't be
 * derived). So instead we pin the expected operator set here and fail loudly if
 * a `registerOperator(...)` is added/removed without updating `types.ts`.
 *
 * When this test fails: a built-in operator was added or removed. Update BOTH
 * the `FilterOperators`/`RootFilterOperators` types in src/types.ts AND the
 * corresponding list below (and the per-operator value type, if the new operator
 * constrains its operand).
 */

var chai = require('chai');
var expect = chai.expect;

var match = require('../../../dist/crud/match');

// --- the operators FilterOperators<V> declares (field-level, the `post` table) ---
// Mirror of the `$`-keys in `interface FilterOperators<V>` (src/types.ts).
var FIELD_OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
  '$exists', '$type',
  '$regex', '$options', '$mod',
  '$all', '$elemMatch', '$size',
  '$not',
  '$bitsAllSet', '$bitsAnySet', '$bitsAllClear', '$bitsAnyClear',
  '$geoWithin', '$geoIntersects', '$near', '$nearSphere',
];

// Geo *sub*-operators: registered flat, but they are ARGUMENTS inside a
// $near/$geoWithin/$geoIntersects operand object — not standalone field
// operators — so they are intentionally NOT top-level FilterOperators keys
// (this matches the MongoDB driver, where e.g. $geometry is nested inside the
// $geoIntersects operand, not a sibling). Excluded from the field-operator set.
var GEO_SUBOPERATORS = [
  '$geometry', '$minDistance', '$maxDistance',
  '$center', '$centerSphere', '$box', '$polygon', '$uniqueDocs',
];

// --- the root/logical operators RootFilterOperators<T> declares (`pre` table) ---
// $expr is registered here too (whole-document evaluation) though Mongo categorizes
// it under FilterOperators — see the Mongo-consistency block below.
var ROOT_OPERATORS = [ '$and', '$or', '$nor', '$where', '$text', '$expr' ];

// $comment is documented on RootFilterOperators but registered as a `preprocess`
// op (runs once in prepareQuery), so it lives in a separate table.
var PREPROCESS_OPERATORS = [ '$comment' ];


describe('# FilterOperators type ↔ registry drift guard', function () {

  function keys(table) { return Object.keys(table).sort(); }

  it('# the `post` registry == FilterOperators field ops + geo sub-ops (nothing un-typed slipped in)', function () {
    var registered = keys(match.postOperators);
    var expected = FIELD_OPERATORS.concat(GEO_SUBOPERATORS).sort();
    expect(registered).eql(expected,
      'A post-operator was added/removed. Update FilterOperators<V> in src/types.ts ' +
      'and FIELD_OPERATORS here (or GEO_SUBOPERATORS if it is a $near/$geoWithin inner arg).');
  });

  it('# the `pre` registry == RootFilterOperators logical ops', function () {
    expect(keys(match.preOperators)).eql(ROOT_OPERATORS.slice().sort(),
      'A pre-operator was added/removed. Update RootFilterOperators<T> in src/types.ts and ROOT_OPERATORS here.');
  });

  it('# the `preprocess` registry == the documented preprocess ops', function () {
    expect(keys(match.preprocessOps)).eql(PREPROCESS_OPERATORS.slice().sort(),
      'A preprocess-operator was added/removed. Update src/types.ts and PREPROCESS_OPERATORS here.');
  });

  it('# every declared FilterOperators field op is actually registered', function () {
    var registered = match.postOperators;
    FIELD_OPERATORS.forEach(function (op) {
      expect(
        Object.prototype.hasOwnProperty.call(registered, op),
        op + ' is declared in FilterOperators<V> but NOT registered — the type promises an operator the engine does not implement.'
      ).eql(true);
    });
  });

});


/**
 * Mongo-consistency guard (Phase T2.7): compare micromongo's ACTUAL registered
 * operators (the runtime registry — self-correcting, so e.g. $maxDistance counts
 * as supported because it IS registered, consumed as a $near sub-operand) against
 * MongoDB's authoritative operator set, extracted from the `mongodb` driver's
 * types by `scripts/gen-mongo-operators.js` into mongo-operators.generated.json.
 *
 * This catches: (a) an operator we register that MongoDB doesn't have (typo /
 * non-standard), and (b) a NEW MongoDB operator we neither implement nor have
 * explicitly recorded as skipped (e.g. after bumping the `mongodb` devDep).
 */
describe('# Mongo-consistency: registry vs MongoDB operator set (generated)', function () {

  var MONGO = require('../../../meta/mongo-operators.generated.json');

  // Operators MongoDB declares that micromongo deliberately does NOT implement,
  // each a documented scope decision (see planning/implementation-plan.md "Deferred by
  // choice" + planning/compatibility.md). When a NEW Mongo operator appears, the test
  // fails until it's either implemented OR added here with a reason.
  var INTENTIONALLY_UNSUPPORTED_FILTER = {
    '$jsonSchema': 'in-query JSON-Schema validation — large dialect, out of scope for a matcher',
    // ($expr / $rand are implemented as of T2.7+; if reverting, re-list them here.)
  };
  var INTENTIONALLY_UNSUPPORTED_UPDATE = {};
  var INTENTIONALLY_UNSUPPORTED_ROOT = {};

  function ours(table) { return Object.keys(table); }

  // Geo SUB-operands micromongo registers flat but MongoDB nests inside the
  // $near/$geoWithin/$geoIntersects operand object (so they are NOT top-level
  // FilterOperators keys in the driver). Allowed as "ours but not in Mongo's flat
  // set" — not typos. (See GEO_SUBOPERATORS above and the driver's nesting.)
  var GEO_NESTED_OK = {
    '$geometry': 1, '$minDistance': 1, '$center': 1, '$centerSphere': 1,
    '$box': 1, '$polygon': 1, '$uniqueDocs': 1,
    // note: $maxDistance IS a top-level Mongo FilterOperators key, so it's not here.
  };

  function checkSubsetAndTriage(registeredKeys, mongoKeys, unsupported, allowedExtra, label, kind) {
    var registered = registeredKeys.slice().sort();
    var mongoSet = {}; mongoKeys.forEach(function (k) { mongoSet[k] = true; });
    var ourSet = {}; registered.forEach(function (k) { ourSet[k] = true; });

    // (a) ours ⊆ Mongo — every operator we register is a real MongoDB operator
    // (allowing documented extras like geo sub-operands Mongo nests rather than lists).
    var nonStandard = registered.filter(function (op) {
      return !mongoSet[op] && !(allowedExtra && allowedExtra[op]);
    });
    expect(nonStandard).eql([],
      label + ': micromongo registers operator(s) MongoDB does not have: ' + JSON.stringify(nonStandard) +
      '. Fix a typo in the registration, or (if intentionally non-standard) document it and whitelist it here.');

    // (b) Mongo − ours − skip-list = ∅ — no un-triaged new Mongo operator.
    var untriaged = mongoKeys.filter(function (op) {
      return !ourSet[op] && !Object.prototype.hasOwnProperty.call(unsupported, op);
    });
    expect(untriaged).eql([],
      label + ': MongoDB has operator(s) micromongo neither implements nor lists as skipped: ' + JSON.stringify(untriaged) +
      '. Either implement them, or add them to INTENTIONALLY_UNSUPPORTED_' + kind + ' in this test with a reason.');
  }

  // micromongo's table layout doesn't line up 1:1 with Mongo's type categories
  // ($expr is a Mongo *FilterOperator* but we register it as a `pre`-op; $rand is
  // a Mongo FilterOperator we implement as an aggregation-expression op). So for
  // QUERY operators we compare the UNION across all query tables against the UNION
  // of Mongo's filter+root sets — robust to how each side buckets an operator.
  it('# query operators (filter + root): registry ⊆ Mongo, and new Mongo query ops are triaged', function () {
    var expressionOps = require('../../../dist/aggregate/expression').expressionOps;
    var supported = ours(match.postOperators)
      .concat(ours(match.preOperators))
      .concat(ours(match.preprocessOps))
      .concat([ '$rand' ].filter(function (op) { return op in expressionOps; })); // $rand lives in the expr engine
    var mongoQuery = MONGO.filterOperators.concat(MONGO.rootOperators);
    var unsupported = {};
    Object.keys(INTENTIONALLY_UNSUPPORTED_FILTER).forEach(function (k) { unsupported[k] = INTENTIONALLY_UNSUPPORTED_FILTER[k]; });
    Object.keys(INTENTIONALLY_UNSUPPORTED_ROOT).forEach(function (k) { unsupported[k] = INTENTIONALLY_UNSUPPORTED_ROOT[k]; });
    checkSubsetAndTriage(supported, mongoQuery, unsupported, GEO_NESTED_OK, 'Query operators', 'FILTER');
  });

  it('# update operators: registry ⊆ Mongo, and new Mongo update ops are triaged', function () {
    var updateOperators = require('../../../dist/crud/update').updateOperators;
    checkSubsetAndTriage(ours(updateOperators), MONGO.updateOperators, INTENTIONALLY_UNSUPPORTED_UPDATE, null, 'UpdateFilter', 'UPDATE');
  });

});
