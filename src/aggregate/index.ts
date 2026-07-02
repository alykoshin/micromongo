/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

var get = require('lodash/get');
var isEqual = require('lodash/isEqual');
var keys = require('lodash/keys');
var set = require('lodash/set');
var unset = require('lodash/unset');

var cloneDeep = require('lodash/cloneDeep');

var isBuffer = require('../utils').isBuffer;


var copyTo = require('../crud/').copyTo;
var project = require('../crud/project');
var match   = require('../crud/match');
var geo     = require('../crud/geo');
var evaluate = require('./expression');
var registry = require('../registry');

import type { Doc, Document, Query, AccumulatorFn, StageFn, AggStage } from '../types';

// Injected by the full `micromongo` entry (src/index.ts) with the real Collection
// constructor; stays null in the functional-core build so aggregate never imports the
// Collection+index layer (see _resolveCollection). `(arr) => new Collection(arr)`.
var _collectionFactory: ((arr: Doc[]) => any) | null = null;


/**
 * Resolve a collection reference (used by $out/$lookup) into a target object.
 * Accepts: a string name (looked up in the registry; lazy-created for $out),
 * a Collection (has `_data`), or a plain array.
 * @returns a handle { data, set } to read/replace the data, or null if unresolved
 */
function _resolveCollection(ref: any, createIfMissing: boolean): any {   // ref: name | Collection | array; returns handle | null
  if (typeof ref === 'string') {
    var coll = registry.get(ref);
    if (!coll) {
      if (!createIfMissing) { return null; }
      // Dependency-injection seam: the main entry (src/index.ts) sets
      // `aggregate._collectionFactory` to the real Collection constructor. Aggregate
      // does NOT `require('../collection')` itself, so the functional core / `micromongo/core`
      // build can exclude the Collection+index layer entirely. In a core-only build the
      // factory is unset, so `$out`/`$lookup` targeting an *unregistered name* throws a
      // clear error instead of silently pulling Collection in (name-registered targets,
      // direct-Collection, and array targets all still work — they don't need the factory).
      if (!_collectionFactory) {
        throw new Error(
          "aggregate: $out/$lookup by name '" + ref + "' needs a Collection, unavailable in the " +
          "functional-core build. Use the full 'micromongo' entry, or pass an array/Collection directly, " +
          "or pre-register the collection via mm.collection('" + ref + "', [...])."
        );
      }
      coll = registry.set(ref, _collectionFactory([]));
    }
    return { data: coll._data, set: function (arr: Doc[]) { coll._data.length = 0; Array.prototype.push.apply(coll._data, arr); } };
  }
  if (ref && Array.isArray(ref._data)) { // a Collection
    var c = ref;
    return { data: c._data, set: function (arr: Doc[]) { c._data.length = 0; Array.prototype.push.apply(c._data, arr); } };
  }
  if (Array.isArray(ref)) {
    var a = ref;
    return { data: a, set: function (arr: Doc[]) { a.length = 0; Array.prototype.push.apply(a, arr); } };
  }
  return null;
}

/**
 * validate path
 *
 * @param fieldPath
 * @returns the path with the leading `$` stripped
 * @private
 */
var _parseFieldPath = function(fieldPath: string): string {
  if (typeof fieldPath !== 'string') { throw new TypeError('Field path must be a string'); }
  if (fieldPath.charAt(0) !== '$') { throw new Error('Field path must starts with $ sign'); }

  return fieldPath.slice(1);
};


/**
 * $geoNear needs a location field. Without indexes we can't look it up, so when
 * `key` isn't given, sniff the first document for a common location field name.
 * @returns the location field path
 */
var _geoNearDefaultKey = function(array: Doc[]): string {
  var candidates = [ 'location', 'loc', 'geometry', 'coordinates', 'pos', 'position' ];
  var first = array[0] || {};
  for (var i = 0; i < candidates.length; ++i) {
    if (typeof first[candidates[i]] !== 'undefined') { return candidates[i]; }
  }
  throw new Error('$geoNear could not determine the location field; specify \'key\'');
};


/**
 * $group accumulators. Each takes the group's documents and the accumulator's
 * argument expression, and folds across the group. Non-numeric values are
 * ignored by $sum/$avg (Mongo semantics).
 */
var _groupAccumulators: Record<string, AccumulatorFn> = {   // accumulators fold a group → a genuine value
  $sum: function(docs: Doc[], expr: any): number {   // expr: accumulator argument expression
    var total = 0;
    for (var i = 0; i < docs.length; ++i) {
      var v = evaluate(expr, docs[i]);
      if (typeof v === 'number') { total += v; }
    }
    return total;
  },
  $avg: function(docs: Doc[], expr: any) {   // expr: argument expression; returns number | null
    var total = 0, n = 0;
    for (var i = 0; i < docs.length; ++i) {
      var v = evaluate(expr, docs[i]);
      if (typeof v === 'number') { total += v; n++; }
    }
    return n === 0 ? null : total / n;
  },
  $min: function(docs: Doc[], expr: any) {   // expr: argument expression; returns min value | null
    var min;
    for (var i = 0; i < docs.length; ++i) {
      var v = evaluate(expr, docs[i]);
      if (v === null || typeof v === 'undefined') { continue; }
      if (typeof min === 'undefined' || v < min) { min = v; }
    }
    return typeof min === 'undefined' ? null : min;
  },
  $max: function(docs: Doc[], expr: any) {   // expr: argument expression; returns max value | null
    var max;
    for (var i = 0; i < docs.length; ++i) {
      var v = evaluate(expr, docs[i]);
      if (v === null || typeof v === 'undefined') { continue; }
      if (typeof max === 'undefined' || v > max) { max = v; }
    }
    return typeof max === 'undefined' ? null : max;
  },
  $push: function(docs: Doc[], expr: any): any[] {   // expr: argument expression
    return docs.map(function(d: Doc) { return evaluate(expr, d); });
  },
  $addToSet: function(docs: Doc[], expr: any): any[] {   // expr: argument expression
    var out: any[] = [];
    for (var i = 0; i < docs.length; ++i) {
      var v = evaluate(expr, docs[i]);
      if (!out.some(function(x: any) { return isEqual(x, v); })) { out.push(v); }   // x, v: genuine values
    }
    return out;
  },
  $first: function(docs: Doc[], expr: any) {   // expr: argument expression; returns first value | null
    return docs.length ? evaluate(expr, docs[0]) : null;
  },
  $last: function(docs: Doc[], expr: any) {   // expr: argument expression; returns last value | null
    return docs.length ? evaluate(expr, docs[docs.length - 1]) : null;
  },
  $count: function(docs: Doc[] /*, expr */): number {
    return docs.length;
  },
};


// $redact system-variable sentinels. The expression's $$DESCEND/$$PRUNE/$$KEEP
// references resolve to these via the evaluator's `vars`.
var REDACT_DESCEND = '__$$DESCEND__';
var REDACT_PRUNE   = '__$$PRUNE__';
var REDACT_KEEP    = '__$$KEEP__';
var REDACT_VARS = { DESCEND: REDACT_DESCEND, PRUNE: REDACT_PRUNE, KEEP: REDACT_KEEP };

function _isPlainObject(v: any): boolean {   // v: genuine value
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !isBuffer(v);
}

/**
 * Recursively apply a $redact expression to one document level.
 * @returns the redacted document, or REDACT_PRUNE if this level is pruned.
 */
function _redactDoc(doc: Document, expr: any): any {   // expr: redact expression; returns doc | PRUNE sentinel
  var decision = evaluate(expr, doc, REDACT_VARS);
  if (decision === REDACT_PRUNE) { return REDACT_PRUNE; }
  if (decision === REDACT_KEEP)  { return cloneDeep(doc); } // keep whole level, no descent
  if (decision !== REDACT_DESCEND) {
    throw new Error('$redact expression must resolve to $$DESCEND, $$PRUNE, or $$KEEP');
  }

  // $$DESCEND: keep scalar fields; recurse into embedded docs / arrays-of-docs.
  var out: Document = {};
  for (var k in doc) { if (doc.hasOwnProperty(k)) {
    var v = doc[k];
    if (_isPlainObject(v)) {
      var sub = _redactDoc(v, expr);
      if (sub !== REDACT_PRUNE) { out[k] = sub; } // pruned embedded doc => field dropped
    } else if (Array.isArray(v)) {
      var arr = [];
      for (var j = 0; j < v.length; ++j) {
        if (_isPlainObject(v[j])) {
          var el = _redactDoc(v[j], expr);
          if (el !== REDACT_PRUNE) { arr.push(el); } // pruned element dropped
        } else {
          arr.push(v[j]); // non-document elements kept as-is
        }
      }
      out[k] = arr;
    } else {
      out[k] = v; // scalar — kept
    }
  }}
  return out;
}


var _aggregateStageOps: Record<string, StageFn> = {

  $project: function(array: Doc[], projection: Document, options?: Record<string, any>) {

    // Split plain inclusion/exclusion (0/1/true/false) from COMPUTED fields
    // (any other value is an aggregation expression to evaluate per document).
    var plain: Document = {}, computed: Document = {}, hasComputed = false;
    for (var p in projection) { if (projection.hasOwnProperty(p)) {
      var v = projection[p];
      if (v === 0 || v === 1 || v === true || v === false) { plain[p] = v; }
      else { computed[p] = v; hasComputed = true; } // expression
    }}

    // A computed field implies inclusion mode. If the only plain entries are
    // exclusions of _id, force the inclusion path so we don't copy all fields.
    var forceInclusion = hasComputed && project._projectionMode(plain) !== 'inclusion';

    var target = [];
    for (var len=array.length, i=0; i<len; ++i) {
      var src = array[i];

      var mode = forceInclusion ? 'inclusion' : project._projectionMode(plain);
      var tgt = {};
      project._initDoc(src, tgt, mode);

      for (var path in plain) { if (plain.hasOwnProperty(path)) {
        // forceInclusion: computed fields drive inclusion; apply plain entries
        // directly (an _id:0 unsets, a field:1 includes) without mode validation
        // (which would reject "mixing" against the synthetic inclusion mode).
        if (!forceInclusion) {
          mode = project._validateProjection(mode, path, plain[ path ]);
        }
        project._projectIncludeExclude(src, tgt, path, plain[ path ]);
      }}

      // evaluate computed fields against the source document
      for (var cpath in computed) { if (computed.hasOwnProperty(cpath)) {
        set(tgt, cpath, evaluate(computed[cpath], src));
      }}

      target.push(tgt);
    }

    return target;
  },


  // $addFields / $set — add or overwrite fields with computed expression values,
  // keeping all existing fields.
  $addFields: function(array: Doc[], spec: Document, options?: Record<string, any>) {
    var target = [];
    for (var i = 0; i < array.length; ++i) {
      var tgt = cloneDeep(array[i]);
      for (var path in spec) { if (spec.hasOwnProperty(path)) {
        set(tgt, path, evaluate(spec[path], array[i]));
      }}
      target.push(tgt);
    }
    return target;
  },


  // $unset — remove one field or a list of fields from each document.
  $unset: function(array: Doc[], spec: any, options?: Record<string, any>) {   // spec: string | string[] (field name(s))
    var fields = Array.isArray(spec) ? spec : [ spec ];
    var target = [];
    for (var i = 0; i < array.length; ++i) {
      var tgt = cloneDeep(array[i]);
      for (var f = 0; f < fields.length; ++f) { unset(tgt, fields[f]); }
      target.push(tgt);
    }
    return target;
  },


  // $count — output a single document { <fieldName>: <number of input docs> }.
  $count: function(array: Doc[], fieldName: any, options?: Record<string, any>) {   // fieldName: string (validated)
    if (typeof fieldName !== 'string' || !fieldName) {
      throw new Error('$count requires a non-empty string field name');
    }
    var out: Document = {};
    out[fieldName] = array.length;
    return [ out ];
  },


  // $replaceRoot / $replaceWith — promote the document resolved from `newRoot`
  // (an expression) to the top level, replacing all existing fields.
  $replaceRoot: function(array: Doc[], params: any, options?: Record<string, any>) {   // params: { newRoot: expr } | expr
    var expr = (params && 'newRoot' in params) ? params.newRoot : params;
    var target = [];
    for (var i = 0; i < array.length; ++i) {
      var v = evaluate(expr, array[i]);
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        throw new Error('$replaceRoot newRoot must resolve to a document');
      }
      target.push(cloneDeep(v));
    }
    return target;
  },


  // $sortByCount — { _id: <expr value>, count: n } sorted by count desc.
  // Equivalent to $group by the expression then $sort by count descending.
  $sortByCount: function(array: Doc[], expr: any, options?: Record<string, any>) {   // expr: group-key expression
    var grouped = _aggregateStageOps.$group(array, { _id: expr, count: { $sum: 1 } }, options);
    return grouped.sort(function(a: Doc, b: Doc) { return b.count - a.count; });
  },


  $match: function(array: Doc[], query: Query, options?: Record<string, any>) {
    const target = [];
    for (let len=array.length, i=0; i<len; ++i) {
      const doc = array[i];
      if (match(doc, query) ) {
        target.push(doc);
      }
    }

    return target;
  },


  $redact: function(array: Doc[], params: any, options?: Record<string, any>) {   // params: redact expression
    var result = [];
    for (var i = 0; i < array.length; ++i) {
      var redacted = _redactDoc(array[i], params);
      if (redacted !== REDACT_PRUNE) { result.push(redacted); }
    }
    return result;
  },


  $limit: function(array: Doc[], params: any, options?: Record<string, any>) {   // params: number (validated)
    if (typeof params !== 'number') { throw new TypeError('Number expected'); }
    return array.slice(0, params);
  },


  $skip: function(array: Doc[], params: any, options?: Record<string, any>) {   // params: number (validated)
    if (typeof params !== 'number') { throw new TypeError('Number expected'); }
    return array.slice(params);
  },


  $unwind: function(array: Doc[], params: any) {   // params: '$path' string | { path, … } spec

    var _unwindDoc = function(doc: Doc, path: string, includeArrayIndex: any) {   // includeArrayIndex: string | false
      var res = [];
      var value = get(doc, path);

      for (var len=value.length, i=0; i<len; ++i) {

        var newDoc = cloneDeep(doc);

        if (includeArrayIndex) {
          // MongoDB places includeArrayIndex at the top level of the document,
          // regardless of whether `path` is nested (e.g. '$a.c').
          set(newDoc, includeArrayIndex, i);
        }

        set(newDoc, path, value[i]);

        res.push(newDoc);
      }

      return res;
    };

    params = (typeof params === 'string') ? { path: params } : params;
    params.preserveNullAndEmptyArrays = typeof params.preserveNullAndEmptyArrays === 'undefined' ? false : params.preserveNullAndEmptyArrays;

    params.includeArrayIndex = typeof params.includeArrayIndex === 'undefined' ? false : params.includeArrayIndex;

    if (params.includeArrayIndex && typeof params.includeArrayIndex !== 'string') { throw new TypeError('includeArrayIndex must be a string'); }

    var p = _parseFieldPath(params.path);
    var res: Doc[] = [];

    for (var len=array.length, i=0; i<len; ++i) {
      var doc = array[i];
      var value = get(doc, p);

      if (typeof value === 'undefined' || value === null) { // skip doc
        if (params.preserveNullAndEmptyArrays) { res.push(doc); }

      } else if (!Array.isArray(value)) { // error
        throw new TypeError('$unwind cannot be executed over non-array field');

      } else if (value.length === 0) { // skip doc
        if (params.preserveNullAndEmptyArrays) { res.push(doc); }

      } else {
        var unwinded = _unwindDoc(doc, p, params.includeArrayIndex);
        res = res.concat( unwinded );
      }

    }
    return res;
  },


  $group: function(array: Doc[], params: Document, options?: Record<string, any>) {   // params: $group spec
    if (!params || typeof params !== 'object' || !('_id' in params)) {
      throw new Error('$group requires an _id field');
    }

    // Bucket documents by group key (deep-equal on the evaluated _id expression).
    var groups: any[] = []; // [{ key, keyJson, docs }] — internal bucket records
    for (var i = 0; i < array.length; ++i) {
      var doc = array[i];
      var key = evaluate(params._id, doc);   // key: genuine value (the group key)
      var keyJson = JSON.stringify(key === undefined ? null : key);
      var bucket = null;
      for (var g = 0; g < groups.length; ++g) {
        if (groups[g].keyJson === keyJson) { bucket = groups[g]; break; }
      }
      if (!bucket) { bucket = { key: (key === undefined ? null : key), keyJson: keyJson, docs: [] }; groups.push(bucket); }
      bucket.docs.push(doc);
    }

    // Apply accumulators per group.
    var result = [];
    for (var b = 0; b < groups.length; ++b) {
      var out: Document = { _id: groups[b].key };
      for (var field in params) { if (params.hasOwnProperty(field) && field !== '_id') {
        var accSpec = params[field];
        var accName = keys(accSpec)[0];
        var accFn = _groupAccumulators[accName];
        if (!accFn) { throw new Error('Unsupported $group accumulator: ' + accName); }
        out[field] = accFn(groups[b].docs, accSpec[accName]);
      }}
      result.push(out);
    }
    return result;
  },


  $sample: function(array: Doc[], params: Document, options?: Record<string, any>) {   // params: { size }
    if (!params || typeof params.size !== 'number' || params.size < 0) {
      throw new Error('$sample requires { size: <non-negative number> }');
    }
    var size = Math.floor(params.size);
    if (size >= array.length) { return array.slice(); } // return all (any order)

    // Partial Fisher–Yates: pick `size` distinct elements uniformly at random.
    var pool = array.slice();
    var result = [];
    for (var i = 0; i < size; ++i) {
      var j = i + Math.floor(Math.random() * (pool.length - i));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      result.push(pool[i]);
    }
    return result;
  },


  $sort: function(array: Doc[], params: Document, options?: Record<string, any>) {   // params: { field: 1|-1 }
    return array.sort(function(doc1: Doc,doc2: Doc) {
      for (var p in params) { if (params.hasOwnProperty(p)) {
        var dir = params[p];
        if ([-1,1 ].indexOf(dir) < 0 ) { throw new Error('Sort direction may be -1 or 1'); }
        var v1 = get(doc1, p);
        var v2 = get(doc2, p);

        var res = (v1 < v2) ? -1 : ((v1 > v2) ? 1 : 0);
        res = res * dir;

        // if current fields are different, return direction
        // otherwise, we'll go to next parameter
        if (res !== 0) { return res; }
      }}
      // if we went out from cycle, that means, both docs are the same
      return 0;
    });
  },


  $geoNear: function(array: Doc[], params: Document, options?: Record<string, any>) {   // params: $geoNear spec
    if (!params || typeof params !== 'object') { throw new Error('$geoNear requires a parameters document'); }
    if (typeof params.near === 'undefined') { throw new Error('$geoNear requires a \'near\' point'); }
    if (typeof params.distanceField !== 'string') { throw new Error('$geoNear requires a string \'distanceField\''); }

    var near = geo.asPoint(params.near);
    if (!near) { throw new Error('$geoNear \'near\' must be a point (GeoJSON Point or coordinate pair)'); }

    var key = params.key || _geoNearDefaultKey(array);
    var spherical = !!params.spherical;
    var mult = (typeof params.distanceMultiplier === 'number') ? params.distanceMultiplier : 1;

    var preparedQuery = (params.query && typeof params.query === 'object')
      ? match.prepareQuery(params.query) : null;

    var withDist = [];
    for (var i = 0; i < array.length; ++i) {
      var doc = array[i];
      if (preparedQuery && !match(doc, preparedQuery)) { continue; }

      var loc = key ? get(doc, key) : doc;
      var pt = geo.asPoint(loc);
      if (!pt) { continue; } // no location => not near anything

      var distance = spherical ? geo.haversineRadians(pt, near) : geo.planarDistance(pt, near);
      distance *= mult;

      if (typeof params.maxDistance === 'number' && distance > params.maxDistance) { continue; }
      if (typeof params.minDistance === 'number' && distance < params.minDistance) { continue; }

      withDist.push({ doc: doc, distance: distance });
    }

    // sort by distance ascending, then write the distanceField (supports dotted path)
    withDist.sort(function(a: any, b: any) { return a.distance - b.distance; });   // a, b: { doc, distance } records
    var result = [];
    for (var j = 0; j < withDist.length; ++j) {
      var out = cloneDeep(withDist[j].doc);
      set(out, params.distanceField, withDist[j].distance);
      result.push(out);
    }
    return result;
  },


  // $lookup — left outer equality join. `from` is a registered name, a Collection,
  // or an array. For each input doc, collects foreign docs where foreignField equals
  // the input's localField, into the `as` array. Array-valued localField matches each
  // element (no $unwind needed), per MongoDB.
  $lookup: function(array: Doc[], params: Document, options?: Record<string, any>) {   // params: { from, localField, foreignField, as }
    if (!params || typeof params.from === 'undefined' ||
        typeof params.localField !== 'string' || typeof params.foreignField !== 'string' ||
        typeof params.as !== 'string') {
      throw new Error('$lookup requires { from, localField, foreignField, as }');
    }
    var handle = _resolveCollection(params.from, false);
    if (!handle) { throw new Error('$lookup: unknown collection \'' + JSON.stringify(params.from) + '\''); }
    var foreign = handle.data;

    var result = [];
    for (var i = 0; i < array.length; ++i) {
      var doc = cloneDeep(array[i]);
      var localVal = get(array[i], params.localField);
      var wanted = Array.isArray(localVal) ? localVal : [ localVal ];

      var matched = [];
      for (var f = 0; f < foreign.length; ++f) {
        var fv = get(foreign[f], params.foreignField);
        var hit = wanted.some(function (w: any) { return isEqual(w, fv); });   // w: genuine localField value
        if (hit) { matched.push(cloneDeep(foreign[f])); }
      }
      set(doc, params.as, matched);
      result.push(doc);
    }
    return result;
  },


  // $out — in-memory sink (no database). The target is:
  //   { $out: "name" }          → a registered named collection (lazy-created)
  //   { $out: <Collection> }    → that Collection
  //   { $out: <array> }         → that array
  // or, as a fallback, aggregate options { out: <name|Collection|array> }.
  // The target's contents are REPLACED with the pipeline result (Mongo semantics);
  // the result is also returned. Must be the LAST stage (enforced by the driver).
  $out: function(array: Doc[], params: any, options?: Record<string, any>) {   // params: name | Collection | array target
    var ref = (typeof params !== 'undefined' && params !== null) ? params
            : (options && options.out);
    if (typeof ref === 'undefined' || ref === null) {
      throw new Error('$out requires a target: { $out: "<name>" | <Collection> | <array> }');
    }
    var handle = _resolveCollection(ref, true); // lazy-create named target
    if (!handle) { throw new Error('$out target must be a collection name, a Collection, or an array'); }

    var result = [];
    for (var i = 0; i < array.length; ++i) { result.push(cloneDeep(array[i])); }
    handle.set(result);
    return result;
  },


  // $indexStats — one document per index with usage stats. Index info is supplied
  // by Collection.aggregate via options.indexStats (a bare-array aggregate has no
  // indexes, so this yields an empty result). Mongo's $indexStats must be the first
  // stage; we don't enforce that for an in-memory pipeline.
  $indexStats: function(array: Doc[], params: any, options?: Record<string, any>) {   // params: unused
    var stats = (options && options.indexStats) || [];
    return stats.map(function (s: Document) { return cloneDeep(s); });
  },


};

// $set is an alias for $addFields; $replaceWith for $replaceRoot.
_aggregateStageOps.$set = _aggregateStageOps.$addFields;
_aggregateStageOps.$replaceWith = function(array: Doc[], expr: any, options?: Record<string, any>) {   // expr: newRoot expression
  // $replaceWith takes the expression directly (no { newRoot } wrapper).
  return _aggregateStageOps.$replaceRoot(array, { newRoot: expr }, options);
};


/**
 * The module value: the callable aggregate driver plus the statics that the
 * test suite and internal callers reach for (`_parseFieldPath`,
 * `_aggregateStageOps`). Typed as a single interface (callable signature + the
 * static members) so `export = aggregate` reproduces the historical
 * `module.exports = aggregate` surface with the statics attached below.
 */
interface AggregateFn {
  (array: Doc[], stages: AggStage[], options?: Record<string, any>): Doc[];   // stages: pipeline stage specs
  _parseFieldPath: (fieldPath: string) => string;
  _aggregateStageOps: Record<string, StageFn>;
  /** Set by the full entry to the Collection factory; enables $out/$lookup lazy-create by name. */
  _setCollectionFactory: (factory: ((arr: Doc[]) => any) | null) => void;
}

var aggregate = (function(array: Doc[], stages: AggStage[], options?: Record<string, any>): Doc[] {   // stages: pipeline stage specs
  options = options || {};

  if (!Array.isArray(array) || !Array.isArray(stages)) { throw new TypeError('Array expected as both parameters'); }

  var res: Doc[] = [];
  copyTo(array, res);

  for (var len=stages.length, i=0; i<len; ++i) {
    var stage = stages[i];

    var stageNames = keys(stage);
    if (stageNames.length !== 1) { throw new Error('Each stage must have exactly one stage operator'); }

    var stageName = stageNames[0];

    var stageFn = _aggregateStageOps[stageName];
    if (!stageFn) { throw new Error('Invalid stage operator'); }

    // $out / $merge must be the last stage (Mongo's rule).
    if (stageName === '$out' && i !== len - 1) {
      throw new Error('$out can only be the final stage in the pipeline');
    }

    var stageParams = stage[stageName];

    res = stageFn(res, stageParams, options);
  }

  return res;
}) as AggregateFn;


aggregate._parseFieldPath = _parseFieldPath;
aggregate._aggregateStageOps = _aggregateStageOps;
aggregate._setCollectionFactory = function (factory: ((arr: Doc[]) => any) | null): void {
  _collectionFactory = factory;
};

export = aggregate;
