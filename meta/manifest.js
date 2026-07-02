'use strict';

/**
 * buildManifest() — the JOIN that is the spine of the docs/tests skeleton.
 *
 * It joins three sources into one per-operation record, so "what operations exist and
 * their status" is computed ONCE and every enumerable artifact (compat matrix, HTML
 * ops-table, coverage report, example tests) becomes a projection of it:
 *
 *   1. MongoDB's authoritative set   ← meta/mongo-operations.generated.json
 *                                       (+ mongo-operators.generated.json for query/update ops)
 *   2. micromongo's live runtime     ← the actual registries (dist/*), so `supported` can
 *                                       NEVER lie — it's read from what the engine registers
 *   3. hand-authored prose/examples  ← summaries.js (the ONLY human-maintained input)
 *
 * Each record: { name, kind, mongo, supported, status, summary, mongoDocUrl }
 *   - `mongo`/`supported`/`status` are COMPUTED (join of #1 and #2)
 *   - `summary` is AUTHORED (#3); '' when not yet written (surfaced by a test)
 *
 * status ∈ 'full' | 'partial' | 'unsupported' | 'micromongo-only'
 *   full            — in Mongo AND supported (default; downgraded to 'partial' if summaries.js
 *                     marks it partial)
 *   partial         — supported but with documented limitations (summaries.js `partial: true`)
 *   unsupported     — in Mongo, NOT supported (a real gap)
 *   micromongo-only — supported but NOT a standard Mongo op (our extension / alias)
 *
 * Kinds: 'method' | 'stage' | 'exprOp' | 'queryOp' | 'updateOp'.
 */

var path = require('path');

// Resolve a path from the repo root (this module lives in <root>/meta/).
function req(p) { return require(path.resolve(__dirname, '..', p)); }

// --- source #1: MongoDB's generated sets (siblings in meta/) -----------------------------
var MONGO_OPS = require('./mongo-operations.generated.json');       // methods/stages/exprOps
var MONGO_OPERATORS = require('./mongo-operators.generated.json');  // filter/update/root ops

// --- source #2: micromongo's live runtime registries ------------------------------------
function liveRuntime() {
  var mm = req('dist/index');
  var aggregate = req('dist/aggregate/');
  var expression = req('dist/aggregate/expression');
  var match = req('dist/crud/match');
  var update = req('dist/crud/update');
  var Collection = req('dist/collection');

  // Methods are exposed on TWO surfaces: the functional `mm.*` API and the `Collection`
  // class. A method counts as supported if it exists on EITHER. Some (the index family)
  // exist only on Collection by design — the functional API can't own the array to keep an
  // index valid — so we record `collectionOnly` for the compat note.
  var mmMethods = Object.keys(mm).filter(function (k) { return typeof mm[k] === 'function' && k.charAt(0) !== '_'; });
  var mmSet = {}; mmMethods.forEach(function (k) { mmSet[k] = true; });
  var collProto = Collection.prototype;
  var collMethods = Object.getOwnPropertyNames(collProto).filter(function (k) {
    return k !== 'constructor' && k.charAt(0) !== '_' && typeof collProto[k] === 'function';
  });
  var collectionOnly = {};
  collMethods.forEach(function (k) { if (!mmSet[k]) { collectionOnly[k] = true; } });

  var allMethods = mmMethods.slice();
  collMethods.forEach(function (k) { if (!mmSet[k]) { allMethods.push(k); } });

  return {
    methods: allMethods,
    collectionOnlyMethods: collectionOnly,   // name → true, for the compat note
    stages: Object.keys(aggregate._aggregateStageOps),
    exprOps: Object.keys(expression.expressionOps),
    queryOps: Object.keys(match.postOperators).concat(Object.keys(match.preOperators)).concat(Object.keys(match.preprocessOps)),
    updateOps: Object.keys(update.updateOperators),
  };
}

// --- source #3: hand-authored prose/examples --------------------------------------------
var SUMMARIES = require('./summaries');

function docUrl(kind, name) {
  var n = name.charAt(0) === '$' ? name.slice(1) : name;
  switch (kind) {
    case 'stage':    return 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/' + n + '/';
    case 'exprOp':   return 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/' + n + '/';
    case 'queryOp':  return 'https://www.mongodb.com/docs/manual/reference/operator/query/' + n + '/';
    case 'updateOp': return 'https://www.mongodb.com/docs/manual/reference/operator/update/' + n + '/';
    case 'method':   return 'https://www.mongodb.com/docs/manual/reference/method/db.collection.' + name + '/';
    default:         return '';
  }
}

// Join one surface: union of Mongo's set and ours → records with computed status.
// `collectionOnly` (optional) is a name→true map of methods that exist ONLY on the
// `Collection` class (not the functional `mm.*` API) — surfaced as record.collectionOnly.
function joinSurface(kind, mongoList, ourList, allowedExtra, collectionOnly) {
  var mongoSet = {}; mongoList.forEach(function (k) { mongoSet[k] = true; });
  var ourSet = {}; ourList.forEach(function (k) { ourSet[k] = true; });
  var names = {};
  mongoList.concat(ourList).forEach(function (k) { names[k] = true; });

  return Object.keys(names).sort().map(function (name) {
    var inMongo = !!mongoSet[name];
    var supported = !!ourSet[name];
    var authored = (SUMMARIES[kind] && SUMMARIES[kind][name]) || null;

    var status;
    if (supported && !inMongo) { status = (allowedExtra && allowedExtra[name]) ? 'micromongo-only' : 'micromongo-only'; }
    else if (supported && inMongo) { status = (authored && authored.partial) ? 'partial' : 'full'; }
    else { status = 'unsupported'; }

    return {
      name: name,
      kind: kind,
      mongo: inMongo,
      supported: supported,
      status: status,
      collectionOnly: !!(collectionOnly && collectionOnly[name]),  // Collection-only method?
      summary: (authored && authored.summary) || '',
      // `notes` is the OPTIONAL rich (may be multi-sentence/markdown) note; `summary` is the
      // one-liner. Generated tables render `notes || summary`; space-tight surfaces use `summary`.
      notes: (authored && authored.notes) || '',
      returns: (authored && authored.returns) || '',   // for the methods table's Returns column
      mongoDocUrl: inMongo ? docUrl(kind, name) : '',
    };
  });
}

function buildManifest() {
  var rt = liveRuntime();
  return {
    stage: joinSurface('stage', MONGO_OPS.aggregationStages, rt.stages, null),
    exprOp: joinSurface('exprOp', MONGO_OPS.expressionOperators, rt.exprOps, null),
    method: joinSurface('method', MONGO_OPS.collectionMethods, rt.methods, null, rt.collectionOnlyMethods),
    queryOp: joinSurface('queryOp', MONGO_OPERATORS.filterOperators.concat(MONGO_OPERATORS.rootOperators), rt.queryOps, null),
    updateOp: joinSurface('updateOp', MONGO_OPERATORS.updateOperators, rt.updateOps, null),
  };
}

module.exports = { buildManifest: buildManifest };
