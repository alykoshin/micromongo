/**
 * Collection — a thin, stateful wrapper that owns an array of documents and
 * exposes the functional API as methods, MongoDB-driver style:
 *
 *     var users = new Collection([ ... ]);
 *     users.insertOne({ ... });
 *     users.find({ age: { $gte: 18 } }, { name: 1 });
 *
 * It is pure data encapsulation: every method forwards to the corresponding
 * `lib/crud` / `lib/aggregate` function, passing the owned array. The mutation
 * contract is preserved — reads (find/findOne/count/aggregate) return deep
 * copies and never touch the data; writes (insert/delete/remove families)
 * mutate the owned array in place and return the usual report object.
 *
 * There are deliberately NO micromongo-specific options here. Real MongoDB
 * collection-level options (collation, readConcern, writeConcern, …) are either
 * N/A for an in-memory array or not yet implemented, so the constructor takes
 * only the data. Global behavior is configured via `mm.configure()`. The second
 * `options` argument is reserved for a future *real* Mongo option and is stored
 * but otherwise unused today.
 */

'use strict';

var _ = require('lodash');
var crud = require('./crud/');
var aggregate = require('./aggregate/');
var Cursor = require('./cursor');


/**
 * @param {Array}  [array]   - the documents this collection owns (default []).
 * @param {Object} [options] - reserved for future MongoDB collection options;
 *                             stored as `_options`, not interpreted yet.
 * @constructor
 */
function Collection(array, options) {
  if (typeof array === 'undefined') { array = []; }
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  this._data = array;
  this._options = options || {};
  // Optional equality (hash) indexes: field -> { map: Map<value, Array<doc>>, hits, misses }.
  // OPT-IN, Collection-only. Linear scan stays the universal correctness path; an
  // index is a pure accelerator for single plain-equality queries on the field.
  this._indexes = {};
}

// --- indexes -----------------------------------------------------------------
//
// Maintenance strategy: REBUILD the affected index after every Collection write.
// For the library's target (small arrays) a rebuild is cheap and *guaranteed*
// consistent — far safer than incremental upkeep across update/replace (where the
// indexed value itself can change and the crud layer doesn't report what moved).
// Invariant: the Collection must be the SOLE writer. Mutating `toArray()` directly
// bypasses index maintenance (documented; reindex() recovers if you must).

/** (re)build one field's index from the current data. */
Collection.prototype._buildIndex = function (field) {
  var map = new Map();
  for (var i = 0; i < this._data.length; ++i) {
    var doc = this._data[i];
    var v = _.get(doc, field);
    var bucket = map.get(v);
    if (bucket) { bucket.push(doc); } else { map.set(v, [ doc ]); }
  }
  this._indexes[field].map = map;
};

/** Rebuild all indexes (called after every write). */
Collection.prototype._reindex = function () {
  for (var field in this._indexes) { if (this._indexes.hasOwnProperty(field)) {
    this._buildIndex(field);
  }}
};

/**
 * Create an equality (hash) index on `field`. Idempotent. Chainable.
 * Speeds up `find`/`findOne` for a single plain-equality predicate on the field.
 */
Collection.prototype.createIndex = function (field) {
  if (typeof field !== 'string') { throw new TypeError('createIndex(field): field must be a string'); }
  if (!this._indexes[field]) {
    this._indexes[field] = { map: new Map(), hits: 0, misses: 0 };
    this._buildIndex(field);
  }
  return this;
};

/** List indexed fields. */
Collection.prototype.getIndexes = function () {
  return Object.keys(this._indexes);
};

/** Drop a field's index. Returns whether it existed. */
Collection.prototype.dropIndex = function (field) {
  var existed = this._indexes.hasOwnProperty(field);
  delete this._indexes[field];
  return existed;
};

/**
 * If `query` is a single plain-equality predicate on an indexed field, return the
 * matching docs straight from the index; otherwise null (caller falls back to scan).
 * @returns {Array|null}
 */
Collection.prototype._indexLookup = function (query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) { return null; }
  var keys = Object.keys(query);
  if (keys.length !== 1) { return null; }
  var field = keys[0];
  var idx = this._indexes[field];
  if (!idx) { return null; }
  var cond = query[field];
  var value;
  if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
    var condKeys = Object.keys(cond);
    if (condKeys.length === 1 && condKeys[0] === '$eq') { value = cond.$eq; }
    else { return null; } // operator query (e.g. $gt) — not indexable here
  } else {
    value = cond; // { field: value } plain equality
  }
  idx.hits++;
  var bucket = idx.map.get(value);
  return bucket ? bucket.slice() : [];
};

// --- reads (pure; return deep copies) ---

Collection.prototype.count = function (query) {
  var hit = this._indexLookup(query);
  if (hit) { return hit.length; }
  return crud.count(this._data, query);
};

/**
 * Returns a chainable {@link Cursor} (not an array — call `.toArray()` to
 * materialize). A `projection` second arg is honored, driver-style:
 *   collection.find(query, { name: 1 }).sort({ age: -1 }).toArray()
 *
 * If an equality index covers the query, the cursor is seeded with the index hit
 * (its sort/skip/limit/project still apply); otherwise it scans as before.
 */
Collection.prototype.find = function (query, projection) {
  var hit = this._indexLookup(query);
  var cursor = (hit !== null) ? new Cursor(hit, {}) : new Cursor(this._data, query);
  if (typeof projection !== 'undefined') { cursor.project(projection); }
  return cursor;
};

Collection.prototype.findOne = function (query, projection) {
  var hit = this._indexLookup(query);
  if (hit !== null) {
    return hit.length ? crud._project(hit[0], projection, query) : null;
  }
  return crud.findOne(this._data, query, projection);
};

Collection.prototype.distinct = function (field, query) {
  return crud.distinct(this._data, field, query);
};

Collection.prototype.aggregate = function (stages, options) {
  options = options || {};
  // Pass this collection's index stats so a $indexStats stage can report them.
  if (typeof options.indexStats === 'undefined') { options.indexStats = this.indexStats(); }
  return aggregate(this._data, stages, options);
};

/** Per-index usage stats (for $indexStats). */
Collection.prototype.indexStats = function () {
  var out = [];
  for (var field in this._indexes) { if (this._indexes.hasOwnProperty(field)) {
    var idx = this._indexes[field];
    out.push({ name: field + '_1', key: keyObj(field), accesses: { ops: idx.hits } });
  }}
  return out;
};

function keyObj(field) { var k = {}; k[field] = 1; return k; }

// --- writes (mutate the owned array in place; return a report object) ---

// Each write delegates to crud, then rebuilds indexes (no-op when none exist, so
// non-indexed collections pay nothing). `_w` wraps the "do write, then reindex".
Collection.prototype._w = function (result) {
  if (this._hasIndexes()) { this._reindex(); }
  return result;
};
Collection.prototype._hasIndexes = function () {
  for (var k in this._indexes) { if (this._indexes.hasOwnProperty(k)) { return true; } }
  return false;
};

Collection.prototype.insertOne = function (doc, options) {
  return this._w(crud.insertOne(this._data, doc, options));
};

Collection.prototype.insertMany = function (docs, options) {
  return this._w(crud.insertMany(this._data, docs, options));
};

Collection.prototype.insert = function (docOrDocs, options) {
  return this._w(crud.insert(this._data, docOrDocs, options));
};

Collection.prototype.deleteOne = function (query) {
  return this._w(crud.deleteOne(this._data, query));
};

Collection.prototype.deleteMany = function (query) {
  return this._w(crud.deleteMany(this._data, query));
};

Collection.prototype.remove = function (query, options) {
  return this._w(crud.remove(this._data, query, options));
};

Collection.prototype.updateOne = function (query, update, options) {
  return this._w(crud.updateOne(this._data, query, update, options));
};

Collection.prototype.updateMany = function (query, update, options) {
  return this._w(crud.updateMany(this._data, query, update, options));
};

Collection.prototype.replaceOne = function (query, replacement, options) {
  return this._w(crud.replaceOne(this._data, query, replacement, options));
};

Collection.prototype.findOneAndUpdate = function (query, update, options) {
  return this._w(crud.findOneAndUpdate(this._data, query, update, options));
};

Collection.prototype.findOneAndReplace = function (query, replacement, options) {
  return this._w(crud.findOneAndReplace(this._data, query, replacement, options));
};

Collection.prototype.findOneAndDelete = function (query) {
  return this._w(crud.findOneAndDelete(this._data, query));
};

/** Manually rebuild all indexes — recovery if `toArray()` was mutated directly. */
Collection.prototype.reindex = function () {
  this._reindex();
  return this;
};

// --- access to the underlying data ---

/**
 * Return the owned array (the live reference, not a copy) — mirrors holding the
 * raw array in the functional API. Mutating it bypasses the collection, so treat
 * it as read access.
 * @returns {Array}
 */
Collection.prototype.toArray = function () {
  return this._data;
};


module.exports = Collection;
