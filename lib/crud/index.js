/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

//var assert = require('assert');
var _ = require('lodash');
var deepAssign = require('mini-deep-assign');

//var debug = function(/*arguments*/) {
  //console.log.apply(this, arguments);
//};

var match = require('./match');
var project = require('./project');


/**
 * The single iteration seam: lazily yield each document matching `query`,
 * together with its index, in forward (array) order.
 *
 * All read/match-based methods (count/find/findOne/deleteOne/deleteMany) are
 * thin consumers of this generator, so the match loop lives in exactly one
 * place. `prepareQuery` runs once here (it carries the `$comment` side-effect).
 *
 * Laziness matters: `findOne` stops the generator after the first yield, and
 * a future Cursor can pull lazily without materializing the whole array.
 *
 * @param {Array}  array
 * @param {Object} query
 * @returns {Iterator<{doc: Object, i: number}>}
 */
function* matches(array, query) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  query = match.prepareQuery(query);
  for (var len=array.length, i=0; i<len; ++i) {
    var doc = array[i];
    if (match(doc, query)) {
      yield { doc: doc, i: i };
    }
  }
}


var count = function(array, query, options) {
  var res = 0;
  for (var _m of matches(array, query)) { res++; } // eslint-disable-line no-unused-vars
  return res;
};


var copyTo = function(array, target) {
  if (!Array.isArray(array) || !Array.isArray(target)) { throw new TypeError('Arrays expected as both parameters'); }

  var copiedCount = 0;
  //target.length = 0; // do not clear the target array
  for (var len=array.length, i=0; i<len; ++i) {
    var s = array[i];
    var t = deepAssign({}, s);
    target.push(t);
    copiedCount++;
  }
  return copiedCount;
};


var findOne = function(array, query, projection) {
  for (var m of matches(array, query)) { // lazy: generator stops after the first match
    return project(m.doc, projection);
  }
  return null;
};


var find = function(array, query, projection) {
  var res = [];
  for (var m of matches(array, query)) {
    res.push( project(m.doc, projection) );
  }
  return res;
};


var deleteOne = function(array, query) {
  for (var m of matches(array, query)) { // lazy: stop at first match
    array.splice(m.i, 1);
    return { deletedCount: 1 };
  }
  return { deletedCount: 0 };
};


var deleteMany = function(array, query) {
  // Collect matching indices forward, then splice back-to-front so earlier
  // splices don't shift the indices of later ones.
  var indices = [];
  for (var m of matches(array, query)) {
    indices.push(m.i);
  }
  for (var j = indices.length - 1; j >= 0; --j) {
    array.splice(indices[j], 1);
  }
  return { deletedCount: indices.length };
};


var remove = function(array, query, options) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  if (typeof options === 'boolean') {
    options = { justOne: options };
  }
  options = options || {};

  options.justOne = (typeof options.justOne === 'undefined') ? false : options.justOne;

  var res = options.justOne ? deleteOne(array, query) : deleteMany(array, query);
  return { nRemoved: res.deletedCount };
};


var insertOne = function(array, source, options) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  var nInserted = 0;
  array.push(deepAssign({}, source));
  nInserted++;
  return { nInserted: nInserted };
};


var insertMany = function(array, source, options) {
  if (!Array.isArray(array) || !Array.isArray(source)) { throw new TypeError('Arrays expected as both parameters'); }
  options = options || {};
  options.ordered = typeof options.ordered === 'undefined' ? true : options.ordered;
  var nInserted = 0;
  for (var len=source.length, i=0; i<len; ++i) {
    try {
      //var doc = source[ i ];
      //array.push(deepAssign({}, doc));
      var res = insertOne(array, source[i], options);
      nInserted += res.nInserted;
    } catch(e) {
      //if (options.ordered) {
      throw e;
      //}
    }
  }
  return { nInserted: nInserted };
};


var insert = function(array, source, options) {
  return Array.isArray(source) ? insertMany(array, source, options)
    : insertOne(array, source, options);
};


module.exports = {
  _match: match,
  _project: project,
  _matches: matches,

  count: count,
  copyTo: copyTo,

  find: find,
  findOne: findOne,

  deleteOne: deleteOne,
  deleteMany: deleteMany,
  remove: remove,

  insertOne: insertOne,
  insertMany: insertMany,
  insert: insert,
};
