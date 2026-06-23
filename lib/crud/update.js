/**
 * Update-operator engine.
 *
 * Applies a MongoDB-style update spec to a single document, in place, and
 * reports whether the document actually changed (so callers can compute
 * `modifiedCount` the way the driver does — matched-but-unchanged => 0).
 *
 * Mirrors the table-driven style of match.js: an `updateOperators` map keyed by
 * `$operator`, plus a dispatcher that throws on unknown operators.
 *
 * Supported field operators:
 *   $set $unset $inc $mul $min $max $rename $currentDate $setOnInsert $bit
 * ($setOnInsert is a no-op on a normal update; the caller applies it only when an
 *  upsert results in an insert — see setOnInsertFields().)
 *
 * Semantics follow https://www.mongodb.com/docs/manual/reference/operator/update-field/ :
 *   $inc on a missing field  => sets it to the increment
 *   $mul on a missing field  => sets it to 0
 *   $min/$max                => write only if new value is strictly less/greater;
 *                               if the field is missing, the value is written
 *   $rename                  => no-op if the source field is absent; overwrites target
 *   $currentDate: true | {$type:'date'} => current Date  (timestamp type not supported)
 *   $bit: { field: { and|or|xor: <int> } } => bitwise update of a numeric field
 *
 * Positional array updates in field PATHS are supported:
 *   "a.$[]"        — every element of array `a`
 *   "a.$[id].f"    — elements of `a` matching arrayFilters entry `id` (then field f)
 * arrayFilters are passed via the options argument to applyUpdate.
 * See https://www.mongodb.com/docs/manual/reference/operator/update/positional-all/
 * and .../positional-filtered/ .
 */

'use strict';

var _ = require('lodash');
var match = require('./match');


/**
 * @returns {boolean} true if it changed `doc`
 */
function eq(a, b) {
  return _.isEqual(a, b);
}


var updateOperators = {

  $set: function (doc, field, value) {
    if (eq(_.get(doc, field), value)) { return false; }
    _.set(doc, field, value);
    return true;
  },

  $unset: function (doc, field /*, value */) {
    if (!_.has(doc, field)) { return false; }
    _.unset(doc, field);
    return true;
  },

  $inc: function (doc, field, amount) {
    if (typeof amount !== 'number') { throw new TypeError('$inc requires a numeric value'); }
    var cur = _.get(doc, field);
    var next = (typeof cur === 'undefined') ? amount : cur + amount;
    if (eq(cur, next)) { return false; }
    _.set(doc, field, next);
    return true;
  },

  $mul: function (doc, field, factor) {
    if (typeof factor !== 'number') { throw new TypeError('$mul requires a numeric value'); }
    var cur = _.get(doc, field);
    var next = (typeof cur === 'undefined') ? 0 : cur * factor;
    if (eq(cur, next)) { return false; }
    _.set(doc, field, next);
    return true;
  },

  $min: function (doc, field, value) {
    var cur = _.get(doc, field);
    if (typeof cur !== 'undefined' && !(value < cur)) { return false; }
    if (eq(cur, value)) { return false; }
    _.set(doc, field, value);
    return true;
  },

  $max: function (doc, field, value) {
    var cur = _.get(doc, field);
    if (typeof cur !== 'undefined' && !(value > cur)) { return false; }
    if (eq(cur, value)) { return false; }
    _.set(doc, field, value);
    return true;
  },

  $rename: function (doc, field, newName) {
    if (!_.has(doc, field)) { return false; }      // no-op if source absent
    var value = _.get(doc, field);
    _.unset(doc, field);
    _.set(doc, newName, value);
    return true;
  },

  $currentDate: function (doc, field, spec) {
    if (spec === true || (spec && spec.$type === 'date')) {
      _.set(doc, field, new Date());
      return true;
    }
    if (spec && spec.$type === 'timestamp') {
      throw new Error('$currentDate: timestamp type is not supported');
    }
    throw new Error('$currentDate requires true or { $type: "date" }');
  },

  $setOnInsert: function (/* doc, field, value */) {
    // No-op on update; only applies when an upsert inserts a new document
    // (the caller pulls these via setOnInsertFields() and merges them in).
    return false;
  },

  $bit: function (doc, field, spec) {
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new TypeError('$bit requires { and|or|xor: <integer> }');
    }
    var cur = _.get(doc, field);
    if (typeof cur === 'undefined') { cur = 0; } // operate on 0 if missing
    if (typeof cur !== 'number') { throw new TypeError('$bit requires an integer field'); }
    var next = cur;
    // MongoDB applies the bitwise ops in the given order (and/or/xor).
    for (var k in spec) { if (spec.hasOwnProperty(k)) {
      var operand = spec[k];
      if (typeof operand !== 'number') { throw new TypeError('$bit operand must be an integer'); }
      if (k === 'and')      { next = next & operand; }
      else if (k === 'or')  { next = next | operand; }
      else if (k === 'xor') { next = next ^ operand; }
      else { throw new Error('$bit only supports and, or, xor (got ' + JSON.stringify(k) + ')'); }
    }}
    if (eq(cur, next)) { return false; }
    _.set(doc, field, next);
    return true;
  },

  // --- array operators ---

  $push: function (doc, field, spec) {
    var arr = getOrInitArray(doc, field);
    var values, position, slice, sort;
    if (spec !== null && typeof spec === 'object' && '$each' in spec) {
      if (!Array.isArray(spec.$each)) { throw new TypeError('$each requires an array'); }
      values = spec.$each;
      position = spec.$position;
      slice = spec.$slice;
      sort = spec.$sort;
    } else {
      values = [ spec ]; // bare value: push a single element
    }

    if (typeof position === 'number') {
      var args = [ position, 0 ].concat(values);
      Array.prototype.splice.apply(arr, args);
    } else {
      Array.prototype.push.apply(arr, values);
    }

    if (typeof sort !== 'undefined') { sortArray(arr, sort); }

    if (typeof slice === 'number') {
      var sliced = slice >= 0 ? arr.slice(0, slice) : arr.slice(slice);
      arr.length = 0;
      Array.prototype.push.apply(arr, sliced);
    }
    return true; // $push always modifies (even $each:[] sets/creates the array)
  },

  $addToSet: function (doc, field, spec) {
    var arr = getOrInitArray(doc, field);
    var values;
    if (spec !== null && typeof spec === 'object' && '$each' in spec) {
      if (!Array.isArray(spec.$each)) { throw new TypeError('$each requires an array'); }
      values = spec.$each;
    } else {
      values = [ spec ];
    }
    var changed = false;
    for (var i = 0; i < values.length; ++i) {
      var v = values[i];
      var present = arr.some(function (el) { return eq(el, v); });
      if (!present) { arr.push(v); changed = true; }
    }
    return changed;
  },

  $pop: function (doc, field, dir) {
    if (dir !== 1 && dir !== -1) { throw new Error('$pop requires 1 (last) or -1 (first)'); }
    var arr = _.get(doc, field);
    if (typeof arr === 'undefined') { return false; }
    requireArray(arr, '$pop');
    if (arr.length === 0) { return false; }
    if (dir === 1) { arr.pop(); } else { arr.shift(); }
    return true;
  },

  $pull: function (doc, field, condition) {
    var arr = _.get(doc, field);
    if (typeof arr === 'undefined') { return false; }
    requireArray(arr, '$pull');
    var keep = arr.filter(function (el) { return !pullMatches(el, condition); });
    if (keep.length === arr.length) { return false; }
    arr.length = 0;
    Array.prototype.push.apply(arr, keep);
    return true;
  },

  $pullAll: function (doc, field, values) {
    if (!Array.isArray(values)) { throw new TypeError('$pullAll requires an array'); }
    var arr = _.get(doc, field);
    if (typeof arr === 'undefined') { return false; }
    requireArray(arr, '$pullAll');
    var keep = arr.filter(function (el) {
      return !values.some(function (v) { return eq(el, v); });
    });
    if (keep.length === arr.length) { return false; }
    arr.length = 0;
    Array.prototype.push.apply(arr, keep);
    return true;
  },

};


// --- array helpers ---

function requireArray(value, op) {
  if (!Array.isArray(value)) {
    throw new TypeError(op + ' requires an array field');
  }
}

/**
 * Get the array at `field`, creating an empty one if the field is absent.
 * Throws if the field exists but is not an array.
 */
function getOrInitArray(doc, field) {
  var cur = _.get(doc, field);
  if (typeof cur === 'undefined') { cur = []; _.set(doc, field, cur); return cur; }
  requireArray(cur, '$push/$addToSet');
  return cur;
}

/**
 * Sort an array in place by a $sort spec: a number (1/-1) for scalars, or a
 * field-spec object ({ field: 1|-1 }) for arrays of documents.
 */
function sortArray(arr, sortSpec) {
  if (sortSpec === 1 || sortSpec === -1) {
    arr.sort(function (a, b) {
      var r = (a < b) ? -1 : (a > b ? 1 : 0);
      return r * sortSpec;
    });
  } else if (sortSpec !== null && typeof sortSpec === 'object') {
    arr.sort(function (a, b) {
      for (var f in sortSpec) { if (sortSpec.hasOwnProperty(f)) {
        var dir = sortSpec[f];
        var va = _.get(a, f), vb = _.get(b, f);
        var r = (va < vb) ? -1 : (va > vb ? 1 : 0);
        if (r !== 0) { return r * dir; }
      }}
      return 0;
    });
  } else {
    throw new TypeError('$sort requires 1, -1, or a field spec object');
  }
}

/**
 * Does array element `el` match a $pull condition? The condition is either an
 * exact value (deep-equal) or a query expression evaluated by the match engine
 * (wrapping the element so operators like { $gt: 5 } apply to it).
 */
function pullMatches(el, condition) {
  if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
    // Could be a query expression ({ $gt: 5 } / { field: ... }) or a plain
    // object to deep-equal. Try the match engine; it deep-equals plain objects
    // and evaluates operators.
    return match({ _v: el }, match.prepareQuery({ _v: condition }));
  }
  return eq(el, condition);
}


// --- positional array paths ($[] and $[<identifier>]) ----------------------
//
// A field path may contain positional segments that fan out to multiple concrete
// array indices:
//   "a.$[]"      -> a.0, a.1, …            (every element)
//   "a.$[id].f"  -> a.<i>.f for each i where arrayFilters entry `id` matches a[i]
// expandPositionalPaths resolves such a path against `doc` into the list of
// concrete lodash paths to apply the operator to. A path with no positional
// segment returns itself unchanged (the common case).

var POSITIONAL_RE = /^\$\[(.*)\]$/; // matches "$[]" (id="") or "$[name]" (id="name")

/**
 * Does array element `el` match the arrayFilters entry for `identifier`?
 * The entry's keys are dotted from the identifier (e.g. { "elem.grade": {...} });
 * we strip the identifier prefix and run the remaining condition through the
 * match engine against the element.
 */
function arrayFilterMatches(el, identifier, arrayFilters) {
  var filter = arrayFilters[identifier];
  if (!filter) {
    throw new Error("No array filter found for identifier '" + identifier + "' in path");
  }
  // Rewrite { "elem.grade": cond } -> { "grade": cond }, and { "elem": cond } -> { _v: cond }.
  var rewritten = {};
  var bareKey = false;
  for (var k in filter) { if (filter.hasOwnProperty(k)) {
    if (k === identifier) { rewritten._v = filter[k]; bareKey = true; }
    else if (k.indexOf(identifier + '.') === 0) { rewritten[k.slice(identifier.length + 1)] = filter[k]; }
    else { throw new Error("Array filter key '" + k + "' does not start with identifier '" + identifier + "'"); }
  }}
  var target = bareKey ? { _v: el } : el;
  return match(target, match.prepareQuery(rewritten));
}

/**
 * Resolve a (possibly positional) field path against `doc` into concrete paths.
 * @returns {Array<string>} concrete lodash paths (dotted)
 */
function expandPositionalPaths(doc, path, arrayFilters) {
  var segments = String(path).split('.');
  // Fast path: no positional segment.
  var hasPositional = false;
  for (var s = 0; s < segments.length; ++s) { if (POSITIONAL_RE.test(segments[s])) { hasPositional = true; break; } }
  if (!hasPositional) { return [ path ]; }

  // BFS expansion: maintain a frontier of concrete prefixes.
  var frontier = [ '' ];
  for (var i = 0; i < segments.length; ++i) {
    var seg = segments[i];
    var m = POSITIONAL_RE.exec(seg);
    var next = [];
    for (var f = 0; f < frontier.length; ++f) {
      var prefix = frontier[f];
      if (!m) {
        next.push(prefix === '' ? seg : prefix + '.' + seg);
        continue;
      }
      // Positional segment: the prefix must resolve to an array in `doc`.
      var arr = (prefix === '') ? doc : _.get(doc, prefix);
      if (!Array.isArray(arr)) { continue; } // nothing to expand here
      var identifier = m[1];
      for (var idx = 0; idx < arr.length; ++idx) {
        if (identifier !== '') {
          if (!arrayFilterMatches(arr[idx], identifier, arrayFilters)) { continue; }
        }
        next.push(prefix === '' ? String(idx) : prefix + '.' + idx);
      }
    }
    frontier = next;
  }
  return frontier;
}


/**
 * Apply a single update operator's field-map to `doc`.
 * @param {Object} options - { arrayFilters: { <id>: <filterDoc> } }
 * @returns {boolean} whether any field changed
 */
function applyOperator(doc, op, fieldMap, options) {
  var fn = updateOperators[op];
  if (typeof fn !== 'function') {
    throw new Error('Unknown update operator \'' + op + '\'');
  }
  if (fieldMap === null || typeof fieldMap !== 'object') {
    throw new TypeError(op + ' requires a document of field: value pairs');
  }
  var arrayFilters = (options && options.arrayFilters) || {};
  var changed = false;
  for (var field in fieldMap) { if (fieldMap.hasOwnProperty(field)) {
    var paths = expandPositionalPaths(doc, field, arrayFilters);
    for (var p = 0; p < paths.length; ++p) {
      if (fn(doc, paths[p], fieldMap[field])) { changed = true; }
    }
  }}
  return changed;
}


/**
 * Is this update spec made of update operators (vs. a replacement document)?
 * A spec is an "operator update" iff it has at least one `$`-prefixed key.
 * Mongo forbids mixing operator and non-operator keys.
 *
 * @returns {boolean}
 */
function hasOperators(update) {
  if (update === null || typeof update !== 'object' || Array.isArray(update)) { return false; }
  var ops = 0, nonOps = 0;
  for (var k in update) { if (update.hasOwnProperty(k)) {
    if (k.charAt(0) === '$') { ops++; } else { nonOps++; }
  }}
  if (ops > 0 && nonOps > 0) {
    throw new Error('Update document cannot mix update operators with plain fields');
  }
  return ops > 0;
}


/**
 * Build the identifier->filter map the positional-path expander needs from the
 * public `arrayFilters` array ([ { "id.field": cond }, … ]). Each entry must
 * reference exactly one identifier (the prefix of its keys).
 */
function indexArrayFilters(arrayFilters) {
  var map = {};
  if (typeof arrayFilters === 'undefined') { return map; }
  if (!Array.isArray(arrayFilters)) { throw new TypeError('arrayFilters must be an array'); }
  for (var i = 0; i < arrayFilters.length; ++i) {
    var filter = arrayFilters[i];
    if (filter === null || typeof filter !== 'object' || Array.isArray(filter)) {
      throw new TypeError('each arrayFilters entry must be a document');
    }
    var id = null;
    for (var k in filter) { if (filter.hasOwnProperty(k)) {
      var dot = k.indexOf('.');
      var thisId = (dot >= 0) ? k.slice(0, dot) : k;
      if (id === null) { id = thisId; }
      else if (id !== thisId) { throw new Error('arrayFilters entry must reference a single identifier'); }
    }}
    if (id === null) { throw new Error('arrayFilters entry is empty'); }
    map[id] = filter;
  }
  return map;
}


/**
 * Apply an operator update spec to `doc` in place.
 *
 * @param {Object} doc     - the document to modify
 * @param {Object} update  - an operator update, e.g. { $set: {...}, $inc: {...} }
 * @param {Object} [options] - { arrayFilters: [ { "id.field": cond }, … ] }
 * @returns {boolean} whether `doc` actually changed
 */
function applyUpdate(doc, update, options) {
  if (!hasOperators(update)) {
    throw new Error('applyUpdate expects an operator update; use a replacement document with replaceOne');
  }
  var opts = { arrayFilters: indexArrayFilters(options && options.arrayFilters) };
  var changed = false;
  for (var op in update) { if (update.hasOwnProperty(op)) {
    if (applyOperator(doc, op, update[op], opts)) { changed = true; }
  }}
  return changed;
}


/**
 * Seed a document from the equality conditions in a query, the way an upsert
 * does: a plain `{ field: value }` pair (or `{ field: { $eq: value } }`)
 * contributes that field; query operators ($gt, $in, …) and logical operators
 * ($and/$or/…) contribute nothing. Dotted keys set nested fields.
 * @returns {Object}
 */
function seedFromQuery(query) {
  var seed = {};
  if (query === null || typeof query !== 'object' || Array.isArray(query)) { return seed; }
  for (var k in query) { if (query.hasOwnProperty(k)) {
    if (k.charAt(0) === '$') { continue; } // logical operator — contributes nothing
    var cond = query[k];
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
      var keys = Object.keys(cond);
      if (keys.length === 1 && keys[0] === '$eq') { _.set(seed, k, cond.$eq); }
      // any other operator form ($gt, $in, nested operator object) — skip
    } else {
      _.set(seed, k, cond); // plain equality
    }
  }}
  return seed;
}

/**
 * Build the document an upsert inserts when nothing matched: the query's equality
 * fields, then the update operators applied, then `$setOnInsert` fields. Mirrors
 * https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/#std-label-updateOne-upsert
 * For a replacement (non-operator) update, the inserted doc is the replacement
 * itself seeded with the query's equality fields it doesn't already set.
 * @returns {Object} the new document (NOT yet inserted)
 */
function buildUpsertDoc(query, update) {
  var doc = seedFromQuery(query);
  if (hasOperators(update)) {
    applyUpdate(doc, update);
    var soi = setOnInsertFields(update);
    for (var f in soi) { if (soi.hasOwnProperty(f)) { _.set(doc, f, soi[f]); } }
  } else {
    // replacement document: query equality fields only fill in what it omits
    var repl = _.cloneDeep(update);
    for (var q in doc) { if (doc.hasOwnProperty(q) && !(q in repl)) { repl[q] = doc[q]; } }
    doc = repl;
  }
  return doc;
}


/**
 * Collect the { field: value } pairs a `$setOnInsert` operator would write.
 * Used by the upsert caller to seed a freshly-inserted document; empty if the
 * update has no `$setOnInsert`.
 * @returns {Object}
 */
function setOnInsertFields(update) {
  var out = {};
  if (update && typeof update === 'object' && update.$setOnInsert &&
      typeof update.$setOnInsert === 'object') {
    for (var f in update.$setOnInsert) { if (update.$setOnInsert.hasOwnProperty(f)) {
      out[f] = update.$setOnInsert[f];
    }}
  }
  return out;
}


module.exports = applyUpdate;
module.exports.hasOperators = hasOperators;
module.exports.updateOperators = updateOperators;
module.exports.setOnInsertFields = setOnInsertFields;
module.exports.buildUpsertDoc = buildUpsertDoc;
module.exports.seedFromQuery = seedFromQuery;
module.exports.expandPositionalPaths = expandPositionalPaths;
