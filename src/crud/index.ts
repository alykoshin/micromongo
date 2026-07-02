/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

//var assert = require('assert');
var get = require('lodash/get');
var isEqual = require('lodash/isEqual');

var cloneDeep = require('lodash/cloneDeep');

//var debug = function(/*arguments*/) {
  //console.log.apply(this, arguments);
//};

var match = require('./match');
var project = require('./project');
var applyUpdate = require('./update');
var settings = require('../settings');   // live read: settings.autoId at call time

import type {
  Doc, Document, Query, UpdateSpec, Projection,
  InsertOneReport, InsertManyReport, DeleteReport, RemoveReport,
  BulkWriteOperation, BulkWriteResult,
} from '../types';


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
function* matches(array: Doc[], query: Query): any {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  query = match.prepareQuery(query);
  for (var len=array.length, i=0; i<len; ++i) {
    var doc = array[i];
    if (match(doc, query)) {
      yield { doc: doc, i: i };
    }
  }
}


var count = function(array: Doc[], query: Query, options?: Record<string, any>): number {
  var res = 0;
  for (var _m of matches(array, query)) { res++; } // eslint-disable-line no-unused-vars
  return res;
};


// MongoDB-driver alias for count() (the driver's `countDocuments()`; bare `count()` is
// deprecated there). Same semantics — matches the query, empty/undefined ⇒ all.
var countDocuments = function(array: Doc[], query?: Query, options?: Record<string, any>): number {
  return count(array, query || {}, options);
};


// The driver's metadata-based fast count — for a plain array that's just its length.
var estimatedDocumentCount = function(array: Doc[], options?: Record<string, any>): number {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as the first parameter'); }
  return array.length;
};


// The driver's `drop()` — for a caller-owned array, empty it in place (returns true). The
// functional form has no indexes to drop (indexes are Collection-only by design); the
// Collection override also drops its indexes.
var drop = function(array: Doc[]): boolean {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as the first parameter'); }
  array.length = 0;
  return true;
};


var copyTo = function(array: Doc[], target: Doc[]): number {
  if (!Array.isArray(array) || !Array.isArray(target)) { throw new TypeError('Arrays expected as both parameters'); }

  var copiedCount = 0;
  //target.length = 0; // do not clear the target array
  for (var len=array.length, i=0; i<len; ++i) {
    var s = array[i];
    var t = cloneDeep(s);
    target.push(t);
    copiedCount++;
  }
  return copiedCount;
};


var findOne = function(array: Doc[], query: Query, projection?: Projection): Doc | null {
  for (var m of matches(array, query)) { // lazy: generator stops after the first match
    return project(m.doc, projection, query);
  }
  return null;
};


var find = function(array: Doc[], query: Query, projection?: Projection): Doc[] {
  var res: Doc[] = [];
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
var distinct = function(array: Doc[], field: string, query: Query): any[] {
  if (typeof field !== 'string') { throw new TypeError('distinct: field must be a string'); }
  var values: any[] = []; // genuine values
  var add = function(v: any) { // value
    if (typeof v === 'undefined') { return; }
    for (var i = 0; i < values.length; ++i) { if (isEqual(values[i], v)) { return; } }
    values.push(v);
  };
  for (var m of matches(array, query)) {
    var v = get(m.doc, field);
    if (Array.isArray(v)) { v.forEach(add); } else { add(v); }
  }
  return values;
};


var deleteOne = function(array: Doc[], query: Query): DeleteReport {
  for (var m of matches(array, query)) { // lazy: stop at first match
    array.splice(m.i, 1);
    return { acknowledged: true, deletedCount: 1 };
  }
  return { acknowledged: true, deletedCount: 0 };
};


var deleteMany = function(array: Doc[], query: Query): DeleteReport {
  // Collect matching indices forward, then splice back-to-front so earlier
  // splices don't shift the indices of later ones.
  var indices: number[] = [];
  for (var m of matches(array, query)) {
    indices.push(m.i);
  }
  for (var j = indices.length - 1; j >= 0; --j) {
    array.splice(indices[j], 1);
  }
  return { acknowledged: true, deletedCount: indices.length };
};


/**
 * @deprecated Legacy alias for delete (the MongoDB driver dropped `remove()` in
 * v4). Returns the legacy `{ nRemoved }` shape, NOT a driver `DeleteResult`. Use
 * `deleteOne`/`deleteMany` (which return `{ acknowledged, deletedCount }`)
 * instead. Scheduled for removal in v1.0.
 */
var remove = function(array: Doc[], query: Query, options?: any): RemoveReport {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  if (typeof options === 'boolean') {
    options = { justOne: options };
  }
  options = options || {};

  options.justOne = (typeof options.justOne === 'undefined') ? false : options.justOne;

  var res = options.justOne ? deleteOne(array, query) : deleteMany(array, query);
  return { nRemoved: res.deletedCount };
};


var insertOne = function(array: Doc[], source: Document, options?: Record<string, any>): InsertOneReport {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  var doc = cloneDeep(source);
  array.push(doc);
  // By default micromongo does NOT auto-generate _id (reads stay non-mutating), so
  // insertedId is the doc's own _id, or undefined if it had none. With the `autoId`
  // setting on (mm.configure({ autoId: true })), an absent _id is generated here —
  // matching MongoDB, which always assigns one.
  maybeGenerateId(doc);
  return { acknowledged: true, insertedId: doc._id, insertedCount: 1 };
};


var insertMany = function(array: Doc[], source: Document[], options?: Record<string, any>): InsertManyReport {
  if (!Array.isArray(array) || !Array.isArray(source)) { throw new TypeError('Arrays expected as both parameters'); }
  options = options || {};
  options.ordered = typeof options.ordered === 'undefined' ? true : options.ordered;
  var insertedCount = 0;
  var insertedIds: { [index: number]: any } = {}; // index → inserted doc's _id (driver shape)
  for (var len=source.length, i=0; i<len; ++i) {
    try {
      var res = insertOne(array, source[i], options);
      insertedIds[insertedCount] = res.insertedId;
      insertedCount += res.insertedCount;
    } catch(e) {
      //if (options.ordered) {
      throw e;
      //}
    }
  }
  return { acknowledged: true, insertedCount: insertedCount, insertedIds: insertedIds };
};


var insert = function(array: Doc[], source: Document | Document[], options?: Record<string, any>): InsertOneReport | InsertManyReport {
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

// Monotonic fallback _id token. The ObjectId stub (lib/utils) is identity, so we
// just need a unique-ish value; the -mongodoc.js examples all supply an explicit
// _id, so they don't rely on its format.
var _idSeq = 0;
function generateId(): any { // value (an _id token)
  _idSeq++;
  return 'mm_' + Date.now().toString(16) + '_' + _idSeq.toString(16);
}

// Mongo-style _id generation, gated on the `autoId` setting (default off): when
// on, stamp an `_id` onto `doc` if it has none. Returns `doc._id` either way.
// Shared by insert* and upsert so they follow one agreement.
function maybeGenerateId(doc: Document): any { // value (the doc's _id, possibly just generated)
  if (settings.autoId && typeof doc._id === 'undefined') { doc._id = generateId(); }
  return doc._id;
}

// Build + insert the upsert document; return the upsert half of the report.
function doUpsert(array: Doc[], query: Query, update: UpdateSpec): any { // report
  var doc = applyUpdate.buildUpsertDoc(query, update);
  maybeGenerateId(doc); // honors `autoId` (default off ⇒ _id left undefined if none)
  array.push(doc);
  return { upsertedId: doc._id, upsertedCount: 1 };
}


var updateOne = function(array: Doc[], query: Query, update: UpdateSpec, options?: Record<string, any>): any { // report
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  // `update` must be an operator document; a replacement doc belongs to replaceOne.
  if (!applyUpdate.hasOperators(update)) {
    throw new Error('updateOne requires an update document with operators ($set, …); use replaceOne for a replacement document');
  }
  var matchedCount = 0, modifiedCount = 0;
  for (var m of matches(array, query)) { // lazy: first match only
    matchedCount = 1;
    // Pass the query so a positional `$` in the update binds to the matched element.
    if (applyUpdate(m.doc, update, { arrayFilters: options.arrayFilters, query: query })) { modifiedCount = 1; }
    break;
  }
  // Driver-shaped UpdateResult: upsertedCount/upsertedId are ALWAYS present (0/null when no
  // upsert happened), matching MongoDB's driver. An upsert overwrites the defaults.
  var report: any = { acknowledged: true, matchedCount: matchedCount, modifiedCount: modifiedCount, upsertedCount: 0, upsertedId: null };
  if (matchedCount === 0 && options.upsert) {
    var up = doUpsert(array, query, update);
    report.upsertedId = up.upsertedId; report.upsertedCount = up.upsertedCount;
  }
  return report;
};


var updateMany = function(array: Doc[], query: Query, update: UpdateSpec, options?: Record<string, any>): any { // report
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  if (!applyUpdate.hasOperators(update)) {
    throw new Error('updateMany requires an update document with operators ($set, …)');
  }
  // Snapshot matching docs first; the update never changes array membership.
  var docs: Doc[] = [];
  for (var m of matches(array, query)) { docs.push(m.doc); }
  var modifiedCount = 0;
  for (var i = 0; i < docs.length; ++i) {
    // Per-doc positional `$`: resolvePositional binds to each doc's own matched element.
    if (applyUpdate(docs[i], update, { arrayFilters: options.arrayFilters, query: query })) { modifiedCount++; }
  }
  var report: any = { acknowledged: true, matchedCount: docs.length, modifiedCount: modifiedCount, upsertedCount: 0, upsertedId: null };
  if (docs.length === 0 && options.upsert) {
    var up = doUpsert(array, query, update);
    report.upsertedId = up.upsertedId; report.upsertedCount = up.upsertedCount;
  }
  return report;
};


var replaceOne = function(array: Doc[], query: Query, replacement: Document, options?: Record<string, any>): any { // report
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  if (applyUpdate.hasOperators(replacement)) {
    throw new Error('replaceOne requires a replacement document without update operators; use updateOne for operator updates');
  }
  var matchedCount = 0, modifiedCount = 0;
  for (var m of matches(array, query)) { // lazy: first match only
    matchedCount = 1;
    var copy = cloneDeep(replacement);
    if (!isEqual(array[m.i], copy)) { modifiedCount = 1; }
    array[m.i] = copy; // replace whole document in place, preserving position
    break;
  }
  var report: any = { acknowledged: true, matchedCount: matchedCount, modifiedCount: modifiedCount, upsertedCount: 0, upsertedId: null };
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

var findOneAndUpdate = function(array: Doc[], query: Query, update: UpdateSpec, options?: Record<string, any>): Doc | null {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  for (var m of matches(array, query)) {
    var before = cloneDeep(m.doc);
    applyUpdate(m.doc, update, { arrayFilters: options.arrayFilters, query: query });
    return before; // Mongo default: return the document as it was before
  }
  if (options.upsert) { doUpsert(array, query, update); } // inserted; no before-doc
  return null;
};


var findOneAndReplace = function(array: Doc[], query: Query, replacement: Document, options?: Record<string, any>): Doc | null {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  if (applyUpdate.hasOperators(replacement)) {
    throw new Error('findOneAndReplace requires a replacement document without update operators');
  }
  for (var m of matches(array, query)) {
    var before = array[m.i];
    array[m.i] = cloneDeep(replacement);
    return before;
  }
  if (options.upsert) { doUpsert(array, query, replacement); } // inserted; no before-doc
  return null;
};


var findOneAndDelete = function(array: Doc[], query: Query): Doc | null {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  for (var m of matches(array, query)) {
    var doc = array[m.i];
    array.splice(m.i, 1);
    return doc;
  }
  return null;
};


// --- bulkWrite -------------------------------------------------------------
//
// Execute a batch of heterogeneous writes against `array` in one call, returning
// an aggregated driver-shaped BulkWriteResult. Each operation delegates to the
// matching single-write method (insertOne/updateOne/updateMany/deleteOne/
// deleteMany/replaceOne) — bulkWrite is purely batching + result aggregation, it
// re-uses the existing write semantics (incl. positional `$`, upsert, arrayFilters).
//
// ordered (default true): operations run in order and STOP at the first error
// (preceding writes persist). ordered:false: every operation is attempted and
// per-operation errors are collected into `writeErrors` (index + errmsg) instead
// of throwing. The aggregated counts always reflect the operations that succeeded.
//
// See https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/ .

// The six bulkWrite operation kinds, each with a single key.
var BULK_OPS: Record<string, true> = {
  insertOne: true, updateOne: true, updateMany: true,
  deleteOne: true, deleteMany: true, replaceOne: true,
};

function applyBulkOp(array: Doc[], kind: string, spec: any /* one of the BulkWriteOperation value bags */, result: BulkWriteResult, opIndex: number): void {
  // `rep`'s concrete shape varies by the dispatched write (dynamic) — honestly `any`.
  var rep: any;
  switch (kind) {
    case 'insertOne': {
      rep = insertOne(array, spec.document);
      result.insertedIds[opIndex] = rep.insertedId;
      result.insertedCount += rep.insertedCount;
      break;
    }
    case 'updateOne':
    case 'updateMany': {
      var uopts = { upsert: !!spec.upsert, arrayFilters: spec.arrayFilters };
      rep = (kind === 'updateOne')
        ? updateOne(array, spec.filter, spec.update, uopts)
        : updateMany(array, spec.filter, spec.update, uopts);
      result.matchedCount += rep.matchedCount;
      result.modifiedCount += rep.modifiedCount;
      if (rep.upsertedCount) { result.upsertedCount += rep.upsertedCount; result.upsertedIds[opIndex] = rep.upsertedId; }
      break;
    }
    case 'replaceOne': {
      rep = replaceOne(array, spec.filter, spec.replacement, { upsert: !!spec.upsert });
      result.matchedCount += rep.matchedCount;
      result.modifiedCount += rep.modifiedCount;
      if (rep.upsertedCount) { result.upsertedCount += rep.upsertedCount; result.upsertedIds[opIndex] = rep.upsertedId; }
      break;
    }
    case 'deleteOne': {
      rep = deleteOne(array, spec.filter);
      result.deletedCount += rep.deletedCount;
      break;
    }
    case 'deleteMany': {
      rep = deleteMany(array, spec.filter);
      result.deletedCount += rep.deletedCount;
      break;
    }
  }
}

var bulkWrite = function(array: Doc[], operations: BulkWriteOperation[], options?: Record<string, any>): BulkWriteResult {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  if (!Array.isArray(operations)) { throw new TypeError('bulkWrite expects an array of operations'); }
  options = options || {};
  var ordered = typeof options.ordered === 'undefined' ? true : options.ordered;

  var result: BulkWriteResult = {
    acknowledged: true,
    insertedCount: 0, matchedCount: 0, modifiedCount: 0, deletedCount: 0, upsertedCount: 0,
    insertedIds: {}, upsertedIds: {},
  };
  var writeErrors: { index: number; errmsg: string }[] = [];

  for (var i = 0; i < operations.length; ++i) {
    var op = operations[i];
    if (op === null || typeof op !== 'object') {
      throw new TypeError('bulkWrite operation ' + i + ' must be an object like { insertOne: { … } }');
    }
    var keys = Object.keys(op);
    if (keys.length !== 1 || !BULK_OPS[keys[0]]) {
      throw new Error('bulkWrite operation ' + i + ' must have exactly one of ' +
        Object.keys(BULK_OPS).join('/') + ' (got: ' + keys.join(', ') + ')');
    }
    var kind = keys[0];
    try {
      applyBulkOp(array, kind, (op as Record<string, any>)[kind], result, i);
    } catch (e) {
      if (ordered) { throw e; }        // fail-fast: preceding writes persist, rest skipped
      writeErrors.push({ index: i, errmsg: (e && (e as any).message) || String(e) });
    }
  }

  if (writeErrors.length) { result.writeErrors = writeErrors; } // only present for unordered partial failures
  return result;
};


export = {
  _match: match,
  _project: project,
  _matches: matches,
  _applyUpdate: applyUpdate,

  count: count,
  countDocuments: countDocuments,
  estimatedDocumentCount: estimatedDocumentCount,
  drop: drop,
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

  bulkWrite: bulkWrite,
};
