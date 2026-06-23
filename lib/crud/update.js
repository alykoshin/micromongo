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
 *   $set $unset $inc $mul $min $max $rename $currentDate $setOnInsert
 * ($setOnInsert is a no-op here — it only matters for upsert inserts, handled by
 *  the caller.)
 *
 * Semantics follow https://www.mongodb.com/docs/manual/reference/operator/update-field/ :
 *   $inc on a missing field  => sets it to the increment
 *   $mul on a missing field  => sets it to 0
 *   $min/$max                => write only if new value is strictly less/greater;
 *                               if the field is missing, the value is written
 *   $rename                  => no-op if the source field is absent; overwrites target
 *   $currentDate: true | {$type:'date'} => current Date  (timestamp type not supported)
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
    // No-op on update; only applies when an upsert inserts a new document.
    return false;
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


/**
 * Apply a single update operator's field-map to `doc`.
 * @returns {boolean} whether any field changed
 */
function applyOperator(doc, op, fieldMap) {
  var fn = updateOperators[op];
  if (typeof fn !== 'function') {
    throw new Error('Unknown update operator \'' + op + '\'');
  }
  if (fieldMap === null || typeof fieldMap !== 'object') {
    throw new TypeError(op + ' requires a document of field: value pairs');
  }
  var changed = false;
  for (var field in fieldMap) { if (fieldMap.hasOwnProperty(field)) {
    if (fn(doc, field, fieldMap[field])) { changed = true; }
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
 * Apply an operator update spec to `doc` in place.
 *
 * @param {Object} doc    - the document to modify
 * @param {Object} update - an operator update, e.g. { $set: {...}, $inc: {...} }
 * @returns {boolean} whether `doc` actually changed
 */
function applyUpdate(doc, update) {
  if (!hasOperators(update)) {
    throw new Error('applyUpdate expects an operator update; use a replacement document with replaceOne');
  }
  var changed = false;
  for (var op in update) { if (update.hasOwnProperty(op)) {
    if (applyOperator(doc, op, update[op])) { changed = true; }
  }}
  return changed;
}


module.exports = applyUpdate;
module.exports.hasOperators = hasOperators;
module.exports.updateOperators = updateOperators;
