'use strict';

/**
 * apply-example.js — run a canonical example's `do` operation on EITHER engine.
 *
 * `applyMicromongo(mm, fixture, do)` runs it via the functional `mm.*` API (sync).
 * `applyDriver(coll, do)` runs it via a mongodb-driver `Collection` (async) — used by the
 * live-Mongo differential harness. Both consume the SAME `do` object (see meta/mongo-examples.js),
 * so one record drives both engines identically.
 *
 * For a MUTATING op the result is the collection's DOCUMENTS after the write (sorted by `_id` when
 * present, for stable comparison), NOT the driver report — so the two engines compare on state.
 */

var examplesMod = require('./mongo-examples');
var MUTATING = examplesMod.MUTATING;

// Stable sort a doc array by `_id` when every doc has one (else leave as-is). Deep-cloned first.
function stable(docs) {
  var arr = JSON.parse(JSON.stringify(docs));
  if (Array.isArray(arr) && arr.length && arr.every(function (d) { return d && d._id !== undefined; })) {
    arr.sort(function (a, b) { return a._id < b._id ? -1 : (a._id > b._id ? 1 : 0); });
  }
  return arr;
}

// --- micromongo (functional, sync) -----------------------------------------------------------
// `collections` (optional) seeds auxiliary named collections a $lookup `from` resolves.
function applyMicromongo(mm, fixture, doo, collections) {
  var data = JSON.parse(JSON.stringify(fixture)); // fresh clone each run
  if (collections) {
    Object.keys(collections).forEach(function (name) {
      mm.collection(name, JSON.parse(JSON.stringify(collections[name])));
    });
  }
  var op = Object.keys(doo)[0];
  var spec = doo[op];

  switch (op) {
    case 'find':      return mm.find(data, spec.query || {}, spec.projection);
    case 'findOne':   return mm.findOne(data, spec.query || {}, spec.projection);
    case 'distinct':  return mm.distinct(data, spec.field, spec.query || {});
    case 'count':     return mm.count(data, spec.query || {});
    case 'aggregate': return mm.aggregate(data, spec.pipeline);
    case 'updateOne': mm.updateOne(data, spec.query, spec.update, spec.options); return stable(data);
    case 'updateMany':mm.updateMany(data, spec.query, spec.update, spec.options); return stable(data);
    case 'replaceOne':mm.replaceOne(data, spec.query, spec.replacement, spec.options); return stable(data);
    case 'deleteOne': mm.deleteOne(data, spec.query); return stable(data);
    case 'deleteMany':mm.deleteMany(data, spec.query); return stable(data);
    case 'insertOne': mm.insertOne(data, spec.document); return stable(data);
    case 'insertMany':mm.insertMany(data, spec.documents); return stable(data);
    case 'bulkWrite': mm.bulkWrite(data, spec.operations, spec.options); return stable(data);
    case 'drop':      mm.drop(data); return stable(data);
    default: throw new Error('applyMicromongo: unsupported op "' + op + '"');
  }
}

// --- mongodb driver (async) ------------------------------------------------------------------
// `coll` is a fresh collection already SEEDED with the fixture; for a read op we just query, for a
// mutating op we run the write then read back the docs. Caller handles seeding + cleanup.
async function applyDriver(coll, doo) {
  var op = Object.keys(doo)[0];
  var spec = doo[op];

  async function readBack() {
    var docs = await coll.find({}).toArray();
    return stable(docs);
  }

  switch (op) {
    case 'find':      return coll.find(spec.query || {}, spec.projection ? { projection: spec.projection } : undefined).toArray();
    case 'findOne':   return coll.findOne(spec.query || {}, spec.projection ? { projection: spec.projection } : undefined);
    case 'distinct':  return coll.distinct(spec.field, spec.query || {});
    case 'count':     return coll.countDocuments(spec.query || {});
    case 'aggregate': return coll.aggregate(spec.pipeline).toArray();
    case 'updateOne': await coll.updateOne(spec.query, spec.update, spec.options); return readBack();
    case 'updateMany':await coll.updateMany(spec.query, spec.update, spec.options); return readBack();
    case 'replaceOne':await coll.replaceOne(spec.query, spec.replacement, spec.options); return readBack();
    case 'deleteOne': await coll.deleteOne(spec.query); return readBack();
    case 'deleteMany':await coll.deleteMany(spec.query); return readBack();
    case 'insertOne': await coll.insertOne(spec.document); return readBack();
    case 'insertMany':await coll.insertMany(spec.documents); return readBack();
    case 'bulkWrite': await coll.bulkWrite(spec.operations, spec.options); return readBack();
    case 'drop':      await coll.deleteMany({}); return readBack(); // empty it (driver drop() removes the coll)
    default: throw new Error('applyDriver: unsupported op "' + op + '"');
  }
}

// Normalize a result for cross-engine / cross-record comparison: flatten BSON/ObjectId wrappers and
// (for read results that are doc arrays with _id) stable-sort so ordering isn't incidental noise.
function normalize(v) {
  var j = JSON.parse(JSON.stringify(v));
  if (Array.isArray(j) && j.length && j.every(function (d) { return d && typeof d === 'object' && d._id !== undefined; })) {
    j.sort(function (a, b) { return a._id < b._id ? -1 : (a._id > b._id ? 1 : 0); });
  }
  return j;
}

// A short human display string for docs/logging (not executed).
function displayCall(doo) {
  var op = Object.keys(doo)[0];
  var spec = doo[op];
  var j = function (x) { return x === undefined ? '' : JSON.stringify(x); };
  switch (op) {
    case 'find': return 'find(' + j(spec.query) + (spec.projection ? ', ' + j(spec.projection) : '') + ')';
    case 'aggregate': return 'aggregate(' + j(spec.pipeline) + ')';
    case 'distinct': return 'distinct(' + j(spec.field) + ')';
    case 'count': return 'countDocuments(' + j(spec.query || {}) + ')';
    case 'updateOne': case 'updateMany': case 'replaceOne':
      return op + '(' + j(spec.query) + ', ' + j(spec.update || spec.replacement) + ')';
    case 'deleteOne': case 'deleteMany': return op + '(' + j(spec.query) + ')';
    default: return op + '(…)';
  }
}

module.exports = {
  applyMicromongo: applyMicromongo,
  applyDriver: applyDriver,
  normalize: normalize,
  displayCall: displayCall,
  isMutating: function (doo) { return !!MUTATING[Object.keys(doo)[0]]; },
};
