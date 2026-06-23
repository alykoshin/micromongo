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
var applyUpdate = require('./update');


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
 * @param  array
 * @param query
 */
function* matches(array: any[], query: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  query = match.prepareQuery(query);
  for (var len=array.length, i=0; i<len; ++i) {
    var doc = array[i];
    if (match(doc, query)) {
      yield { doc: doc, i: i };
    }
  }
}


var count = function(array: any, query: any, options?: any): number {
  var res = 0;
  for (var _m of matches(array, query)) { res++; } // eslint-disable-line no-unused-vars
  return res;
};


var copyTo = function(array: any, target: any): number {
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


var findOne = function(array: any, query: any, projection?: any): any {
  for (var m of matches(array, query)) { // lazy: generator stops after the first match
    return project(m.doc, projection, query);
  }
  return null;
};


var find = function(array: any, query: any, projection?: any): any {
  var res: any[] = [];
  for (var m of matches(array, query)) {
    res.push( project(m.doc, projection, query) );
  }
  return res;
};


/**
 * Return an array of distinct values for `field` across documents matching
 * `query`. Array-valued fields are flattened (each element is a distinct value),
 * matching MongoDB. Values are deduped by deep equality. Dotted paths supported.
 */
var distinct = function(array: any, field: any, query: any): any {
  if (typeof field !== 'string') { throw new TypeError('distinct: field must be a string'); }
  var values: any[] = [];
  var add = function(v: any) {
    if (typeof v === 'undefined') { return; }
    for (var i = 0; i < values.length; ++i) { if (_.isEqual(values[i], v)) { return; } }
    values.push(v);
  };
  for (var m of matches(array, query)) {
    var v = _.get(m.doc, field);
    if (Array.isArray(v)) { v.forEach(add); } else { add(v); }
  }
  return values;
};


var deleteOne = function(array: any, query: any): any {
  for (var m of matches(array, query)) { // lazy: stop at first match
    array.splice(m.i, 1);
    return { deletedCount: 1 };
  }
  return { deletedCount: 0 };
};


var deleteMany = function(array: any, query: any): any {
  // Collect matching indices forward, then splice back-to-front so earlier
  // splices don't shift the indices of later ones.
  var indices: any[] = [];
  for (var m of matches(array, query)) {
    indices.push(m.i);
  }
  for (var j = indices.length - 1; j >= 0; --j) {
    array.splice(indices[j], 1);
  }
  return { deletedCount: indices.length };
};


var remove = function(array: any, query: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  if (typeof options === 'boolean') {
    options = { justOne: options };
  }
  options = options || {};

  options.justOne = (typeof options.justOne === 'undefined') ? false : options.justOne;

  var res = options.justOne ? deleteOne(array, query) : deleteMany(array, query);
  return { nRemoved: res.deletedCount };
};


var insertOne = function(array: any, source: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  var nInserted = 0;
  array.push(deepAssign({}, source));
  nInserted++;
  return { nInserted: nInserted };
};


var insertMany = function(array: any, source: any, options?: any): any {
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


var insert = function(array: any, source: any, options?: any): any {
  return Array.isArray(source) ? insertMany(array, source, options)
    : insertOne(array, source, options);
};


// --- updates ---------------------------------------------------------------
//
// Return the driver-shaped report { acknowledged, matchedCount, modifiedCount }.
// `modifiedCount` follows Mongo: a matched doc that doesn't actually change
// contributes 0. With `{ upsert: true }` and no match, a document is inserted
// (built from the query's equality fields + the update) and the report also
// carries { upsertedId, upsertedCount }.

// Monotonic fallback _id for an upsert insert that doesn't specify one. The
// ObjectId stub (lib/utils) is identity, so we just need a unique-ish token;
// the -mongodoc.js examples all supply an explicit _id, so they don't rely on it.
var _upsertSeq = 0;
function generateId(): any {
  _upsertSeq++;
  return 'mm_' + Date.now().toString(16) + '_' + _upsertSeq.toString(16);
}

// Build + insert the upsert document; return the upsert half of the report.
function doUpsert(array: any, query: any, update: any): any {
  var doc = applyUpdate.buildUpsertDoc(query, update);
  if (typeof doc._id === 'undefined') { doc._id = generateId(); }
  array.push(doc);
  return { upsertedId: doc._id, upsertedCount: 1 };
}


var updateOne = function(array: any, query: any, update: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  // `update` must be an operator document; a replacement doc belongs to replaceOne.
  if (!applyUpdate.hasOperators(update)) {
    throw new Error('updateOne requires an update document with operators ($set, …); use replaceOne for a replacement document');
  }
  var matchedCount = 0, modifiedCount = 0;
  for (var m of matches(array, query)) { // lazy: first match only
    matchedCount = 1;
    if (applyUpdate(m.doc, update, options)) { modifiedCount = 1; }
    break;
  }
  var report: any = { acknowledged: true, matchedCount: matchedCount, modifiedCount: modifiedCount };
  if (matchedCount === 0 && options.upsert) {
    var up = doUpsert(array, query, update);
    report.upsertedId = up.upsertedId; report.upsertedCount = up.upsertedCount;
  }
  return report;
};


var updateMany = function(array: any, query: any, update: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  if (!applyUpdate.hasOperators(update)) {
    throw new Error('updateMany requires an update document with operators ($set, …)');
  }
  // Snapshot matching docs first; the update never changes array membership.
  var docs: any[] = [];
  for (var m of matches(array, query)) { docs.push(m.doc); }
  var modifiedCount = 0;
  for (var i = 0; i < docs.length; ++i) {
    if (applyUpdate(docs[i], update, options)) { modifiedCount++; }
  }
  var report: any = { acknowledged: true, matchedCount: docs.length, modifiedCount: modifiedCount };
  if (docs.length === 0 && options.upsert) {
    var up = doUpsert(array, query, update);
    report.upsertedId = up.upsertedId; report.upsertedCount = up.upsertedCount;
  }
  return report;
};


var replaceOne = function(array: any, query: any, replacement: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  if (applyUpdate.hasOperators(replacement)) {
    throw new Error('replaceOne requires a replacement document without update operators; use updateOne for operator updates');
  }
  var matchedCount = 0, modifiedCount = 0;
  for (var m of matches(array, query)) { // lazy: first match only
    matchedCount = 1;
    var copy = deepAssign({}, replacement);
    if (!_.isEqual(array[m.i], copy)) { modifiedCount = 1; }
    array[m.i] = copy; // replace whole document in place, preserving position
    break;
  }
  var report: any = { acknowledged: true, matchedCount: matchedCount, modifiedCount: modifiedCount };
  if (matchedCount === 0 && options.upsert) {
    var up = doUpsert(array, query, replacement);
    report.upsertedId = up.upsertedId; report.upsertedCount = up.upsertedCount;
  }
  return report;
};


// --- find-and-modify family ------------------------------------------------
//
// Thin wrappers that return the affected document. By default Mongo returns the
// document as it was *before* the modification; we follow that default.

var findOneAndUpdate = function(array: any, query: any, update: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  for (var m of matches(array, query)) {
    var before = deepAssign({}, m.doc);
    applyUpdate(m.doc, update, options);
    return before; // Mongo default: return the document as it was before
  }
  if (options.upsert) { doUpsert(array, query, update); } // inserted; no before-doc
  return null;
};


var findOneAndReplace = function(array: any, query: any, replacement: any, options?: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  if (applyUpdate.hasOperators(replacement)) {
    throw new Error('findOneAndReplace requires a replacement document without update operators');
  }
  for (var m of matches(array, query)) {
    var before = array[m.i];
    array[m.i] = deepAssign({}, replacement);
    return before;
  }
  if (options.upsert) { doUpsert(array, query, replacement); } // inserted; no before-doc
  return null;
};


var findOneAndDelete = function(array: any, query: any): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  for (var m of matches(array, query)) {
    var doc = array[m.i];
    array.splice(m.i, 1);
    return doc;
  }
  return null;
};


export = {
  _match: match,
  _project: project,
  _matches: matches,
  _applyUpdate: applyUpdate,

  count: count,
  copyTo: copyTo,

  find: find,
  findOne: findOne,
  distinct: distinct,

  deleteOne: deleteOne,
  deleteMany: deleteMany,
  remove: remove,

  insertOne: insertOne,
  insertMany: insertMany,
  insert: insert,

  updateOne: updateOne,
  updateMany: updateMany,
  replaceOne: replaceOne,

  findOneAndUpdate: findOneAndUpdate,
  findOneAndReplace: findOneAndReplace,
  findOneAndDelete: findOneAndDelete,
};
