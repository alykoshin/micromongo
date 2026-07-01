#!/usr/bin/env node
'use strict';

/**
 * gen-mongo-operations.js — build-time codegen of MongoDB's *operation* vocabulary.
 *
 * Companion to `gen-mongo-operators.js` (which covers query/update *operators*). This
 * script emits the three "operation"-level surfaces the compatibility matrix / ops-table
 * doc track, to `meta/mongo-operations.generated.json`:
 *
 *   1. collectionMethods    — CRUD/collection methods (find, insertOne, aggregate, …)
 *   2. aggregationStages    — pipeline stage names ($match, $group, $lookup, …)
 *   3. expressionOperators  — aggregation expression operators ($sum, $dateToString, …)
 *
 * PROVENANCE differs per surface (verified: the driver's TS types only expose #1):
 *   - collectionMethods are EXTRACTED from the `mongodb` driver's `Collection<Document>`
 *     type via the TypeScript Compiler API (same technique as gen-mongo-operators.js) —
 *     auto-refreshes when the driver bumps.
 *   - The driver does NOT type aggregation stages or expression operators as name unions
 *     (there is no `PipelineStage` type; expressions are `Document`/`any`), so #2 and #3
 *     are CURATED from the MongoDB manual's reference pages (URLs below) and hand-verified.
 *     Refresh them by re-reading those pages when targeting a new server version.
 *
 * `mongodb` is a **devDependency only** — used here at build time, never shipped. We take
 * only method/operator NAMES (no value types → no BSON dragged in).
 *
 * Run:  npm run gen-mongo-operations   (Node >= 20; the JSON is committed, so normal
 *       build/test on older Node is unaffected).
 */

var ts = require('typescript');
var fs = require('fs');
var path = require('path');

var OUT = path.resolve(__dirname, '..', 'meta', 'mongo-operations.generated.json');

// --- 1. collectionMethods: introspected from the driver's Collection<Document> type ----

function extractCollectionMethods() {
  var probePath = path.resolve(__dirname, '_mongo-methods-probe.ts');
  fs.writeFileSync(probePath, [
    "import type { Collection, Document } from 'mongodb';",
    'declare const _c: Collection<Document>;',
  ].join('\n'));

  try {
    // NOTE: `lib`/`target` are REQUIRED here — without them the checker resolves
    // Collection<Document> to zero properties (Promise/AsyncIterator base types don't
    // load, so member resolution bails). gen-mongo-operators.js didn't need them because
    // FilterOperators is a plain mapped type with no such base dependencies.
    var program = ts.createProgram([probePath], {
      strict: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
      noEmit: true,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
      lib: ['lib.es2020.d.ts'],
      types: [],
    });
    var checker = program.getTypeChecker();
    var sf = program.getSourceFile(probePath);
    if (!sf) { throw new Error('could not load the methods probe source file'); }

    var methods = null;
    ts.forEachChild(sf, function visit(node) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(function (d) {
          if (d.name.getText() === '_c') {
            var t = checker.getTypeAtLocation(d);
            methods = checker.getPropertiesOfType(t)
              .filter(function (p) {
                // methods = properties whose type has a call signature; skip non-callable
                // accessors (db, collectionName, readConcern, …) and internal `_`-names.
                if (p.name.charAt(0) === '_') { return false; }
                var pt = checker.getTypeOfSymbolAtLocation(p, d);
                return pt.getCallSignatures().length > 0;
              })
              .map(function (p) { return p.name; })
              .sort();
          }
        });
      }
      ts.forEachChild(node, visit);
    });
    if (!methods || !methods.length) {
      throw new Error('resolved zero Collection methods — did the mongodb Collection type change, or the lib/target config?');
    }
    return methods;
  } finally {
    fs.unlinkSync(probePath);
  }
}

// --- 2 & 3. Curated from the MongoDB manual (the driver can't type these) --------------

// Aggregation pipeline stages.
// Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/
var AGGREGATION_STAGES = [
  '$addFields', '$bucket', '$bucketAuto', '$changeStream', '$changeStreamSplitLargeEvent',
  '$collStats', '$count', '$densify', '$documents', '$facet', '$fill', '$geoNear',
  '$graphLookup', '$group', '$indexStats', '$limit', '$listSampledQueries', '$listSearchIndexes',
  '$listSessions', '$lookup', '$match', '$merge', '$out', '$planCacheStats', '$project',
  '$redact', '$replaceRoot', '$replaceWith', '$sample', '$search', '$searchMeta', '$set',
  '$setWindowFields', '$skip', '$sort', '$sortByCount', '$unionWith', '$unset', '$unwind',
  '$vectorSearch',
];

// Aggregation expression operators (used inside stages).
// Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/
var EXPRESSION_OPERATORS = [
  // arithmetic
  '$abs', '$add', '$ceil', '$divide', '$exp', '$floor', '$ln', '$log', '$log10', '$mod',
  '$multiply', '$pow', '$round', '$sqrt', '$subtract', '$trunc',
  // array
  '$arrayElemAt', '$arrayToObject', '$concatArrays', '$filter', '$first', '$firstN', '$in',
  '$indexOfArray', '$isArray', '$last', '$lastN', '$map', '$maxN', '$minN', '$objectToArray',
  '$range', '$reduce', '$reverseArray', '$size', '$slice', '$sortArray', '$zip',
  // boolean
  '$and', '$not', '$or',
  // comparison
  '$cmp', '$eq', '$gt', '$gte', '$lt', '$lte', '$ne',
  // conditional
  '$cond', '$ifNull', '$switch',
  // custom / misc
  '$function', '$accumulator', '$getField', '$setField', '$literal', '$let', '$rand', '$toHashedIndexKey',
  // data size
  '$binarySize', '$bsonSize',
  // date
  '$dateAdd', '$dateDiff', '$dateFromParts', '$dateFromString', '$dateSubtract', '$dateToParts',
  '$dateToString', '$dateTrunc', '$dayOfMonth', '$dayOfWeek', '$dayOfYear', '$hour',
  '$isoDayOfWeek', '$isoWeek', '$isoWeekYear', '$millisecond', '$minute', '$month', '$second',
  '$toDate', '$week', '$year',
  // object
  '$mergeObjects',
  // set
  '$allElementsTrue', '$anyElementTrue', '$setDifference', '$setEquals', '$setIntersection',
  '$setIsSubset', '$setUnion',
  // string
  '$concat', '$dateToString', '$indexOfBytes', '$indexOfCP', '$ltrim', '$regexFind',
  '$regexFindAll', '$regexMatch', '$replaceOne', '$replaceAll', '$rtrim', '$split',
  '$strLenBytes', '$strLenCP', '$strcasecmp', '$substr', '$substrBytes', '$substrCP',
  '$toLower', '$toString', '$trim', '$toUpper',
  // text / trig
  '$meta', '$sin', '$cos', '$tan', '$asin', '$acos', '$atan', '$atan2', '$asinh', '$acosh',
  '$atanh', '$sinh', '$cosh', '$tanh', '$degreesToRadians', '$radiansToDegrees',
  // type conversion
  '$convert', '$isNumber', '$toBool', '$toDecimal', '$toDouble', '$toInt', '$toLong', '$toObjectId', '$type',
  // accumulators (also usable as expressions in some stages)
  '$accumulator', '$addToSet', '$avg', '$bottom', '$bottomN', '$count', '$covariancePop',
  '$covarianceSamp', '$denseRank', '$derivative', '$documentNumber', '$expMovingAvg',
  '$integral', '$max', '$maxN', '$median', '$mergeObjects', '$min', '$minN', '$percentile',
  '$push', '$rank', '$shift', '$stdDevPop', '$stdDevSamp', '$sum', '$top', '$topN',
];

function uniqSort(arr) {
  var seen = {};
  return arr.filter(function (x) { if (seen[x]) { return false; } seen[x] = 1; return true; }).sort();
}

// --- emit -----------------------------------------------------------------------------

var mongoVersion = require('mongodb/package.json').version;
var data = {
  _comment: 'GENERATED by scripts/gen-mongo-operations.js — do not edit. Run `npm run gen-mongo-operations` to refresh. collectionMethods are introspected from mongodb@' + mongoVersion + '; aggregationStages and expressionOperators are curated from the MongoDB manual (see the script for source URLs) and hand-verified.',
  mongodbVersion: mongoVersion,
  sources: {
    collectionMethods: 'mongodb driver Collection<Document> type (introspected)',
    aggregationStages: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation-pipeline/ (curated)',
    expressionOperators: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/ (curated)',
  },
  collectionMethods: extractCollectionMethods(),
  aggregationStages: uniqSort(AGGREGATION_STAGES),
  expressionOperators: uniqSort(EXPRESSION_OPERATORS),
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
console.log('Wrote ' + path.relative(process.cwd(), OUT));
console.log('  collectionMethods:   ' + data.collectionMethods.length + ' (introspected)');
console.log('  aggregationStages:   ' + data.aggregationStages.length + ' (curated)');
console.log('  expressionOperators: ' + data.expressionOperators.length + ' (curated)');
