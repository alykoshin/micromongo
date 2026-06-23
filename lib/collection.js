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
var OrderedIndex = require('./index/ordered');
var planner = require('./index/planner');


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
  // Optional ORDERED indexes, keyed by a canonical name (joined field list).
  // OPT-IN, Collection-only. One structure (OrderedIndex) backs every index TYPE —
  // single-field, multikey (array fields), and compound — mirroring MongoDB, where
  // those are all one B-tree with different metadata. A linear scan stays the
  // universal correctness path; an index only ever supplies a candidate set that the
  // planner/match engine validates (see lib/index/planner.js).
  this._indexes = {}; // name -> OrderedIndex
}

// --- indexes -----------------------------------------------------------------
//
// Maintenance strategy (current): REBUILD the affected index after every Collection
// write. A rebuild is *guaranteed* consistent — far safer than incremental upkeep
// across update/replace (where the indexed value itself can change and the crud
// layer doesn't report what moved). It is O(n) per write, so for very large,
// write-heavy collections this is the bottleneck to revisit (incremental upkeep, or
// the ordered-index work in implementation-plan.md → Phase 12). For read-heavy use
// it's a non-issue. Invariant: the Collection must be the SOLE writer. Mutating
// `toArray()` directly bypasses index maintenance (documented; reindex() recovers).

/** Canonical name for an index spec: 'field' or 'a_b' for compound. */
function indexName(fields) { return fields.join('_'); }

/** Normalize a createIndex argument to a {field:1,…} spec + field list. */
function normalizeSpec(spec) {
  if (typeof spec === 'string') { var s = {}; s[spec] = 1; return s; }
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) { return spec; }
  throw new TypeError('createIndex(spec): spec must be a field name or a { field: 1, … } object');
}

/** Rebuild all indexes from current data (called after every write). */
Collection.prototype._reindex = function () {
  for (var name in this._indexes) { if (this._indexes.hasOwnProperty(name)) {
    this._indexes[name].build(this._data);
  }}
};

/**
 * Create an ORDERED index. Accepts a single field name (`createIndex('age')`) or a
 * compound spec (`createIndex({ a: 1, b: 1 })`). Idempotent. Chainable. The index
 * accelerates single-field equality/range, sorts on the field, `$in`, array-field
 * (multikey) lookups, and compound-prefix equality — everything else falls back to
 * the linear scan.
 */
Collection.prototype.createIndex = function (spec) {
  var s = normalizeSpec(spec);
  var name = indexName(Object.keys(s));
  if (!this._indexes[name]) {
    var idx = new OrderedIndex(s);
    idx.build(this._data);
    this._indexes[name] = idx;
  }
  return this;
};

/** List index names (single-field indexes list as the bare field name). */
Collection.prototype.getIndexes = function () {
  return Object.keys(this._indexes);
};

/** Drop an index by field name or spec. Returns whether it existed. */
Collection.prototype.dropIndex = function (spec) {
  var name = indexName(Object.keys(normalizeSpec(spec)));
  var existed = this._indexes.hasOwnProperty(name);
  delete this._indexes[name];
  return existed;
};

/**
 * Resolve an index usable for the given field(s).
 *  - getIndexFor('age')       → a single-field index on age, if any
 *  - getIndexFor(['a','b'])   → a compound index whose LEADING fields are a prefix
 *                               covering the requested set (order-insensitive on the
 *                               query side; the index's own field order defines the key)
 * @returns {OrderedIndex|undefined}
 */
Collection.prototype._getIndexFor = function (fieldOrFields) {
  if (typeof fieldOrFields === 'string') {
    return this._indexes[fieldOrFields];
  }
  // array: find a compound (or single) index whose leading field(s) are all in the set.
  var want = {};
  for (var i = 0; i < fieldOrFields.length; ++i) { want[fieldOrFields[i]] = true; }
  var best;
  for (var name in this._indexes) { if (this._indexes.hasOwnProperty(name)) {
    var idx = this._indexes[name];
    // leading-prefix of idx.fields that are all present in `want`
    var lead = 0;
    while (lead < idx.fields.length && want[idx.fields[lead]]) { lead++; }
    if (lead > 0) {
      if (!best || lead > best._lead) { best = idx; best._lead = lead; }
    }
  }}
  return best;
};

/**
 * Plan `query` against the indexes. Returns { docs, exact } or null (→ scan).
 * `docs` is a candidate set; when `exact` is false the caller must re-filter via the
 * full match() (the Cursor does this when seeded with the query).
 */
Collection.prototype._planQuery = function (query) {
  var self = this;
  return planner.plan(query, this._indexes, function (f) { return self._getIndexFor(f); });
};

// --- reads (pure; return deep copies) ---

Collection.prototype.count = function (query) {
  var plan = this._planQuery(query);
  if (plan) {
    if (plan.exact) { return plan.docs.length; }
    // candidate superset → count those that actually match.
    var prepared = crud._match.prepareQuery(query);
    var n = 0;
    for (var i = 0; i < plan.docs.length; ++i) { if (crud._match(plan.docs[i], prepared)) { n++; } }
    return n;
  }
  return crud.count(this._data, query);
};

/**
 * Returns a chainable {@link Cursor} (not an array — call `.toArray()` to
 * materialize). A `projection` second arg is honored, driver-style:
 *   collection.find(query, { name: 1 }).sort({ age: -1 }).toArray()
 *
 * If an index covers the query, the cursor is seeded with the planner's candidate
 * set (re-filtered against the query when the plan is inexact); otherwise it scans.
 * A single-field `.sort({f})` on an indexed field is served from the index's order
 * (no in-memory sort) via a sort-provider attached to the cursor.
 */
Collection.prototype.find = function (query, projection) {
  var plan = this._planQuery(query);
  var cursor = plan ? new Cursor(plan.docs, plan.exact ? {} : query)
                    : new Cursor(this._data, query);
  cursor._sortProvider = this._makeSortProvider(query, plan);
  // Attach an explain() plan: IXSCAN (index used) or COLLSCAN (linear scan).
  cursor._explainPlan = plan
    ? { stage: plan.exact ? plan.explain.stage : 'IXSCAN+FILTER', indexed: true, exact: plan.exact,
        candidates: plan.docs.length, totalDocs: this._data.length, plan: plan.explain }
    : { stage: 'COLLSCAN', indexed: false, exact: true, candidates: this._data.length, totalDocs: this._data.length };
  if (typeof projection !== 'undefined') { cursor.project(projection); }
  return cursor;
};

/**
 * Build a sort-provider for the cursor: given a sort spec, return docs already in
 * that order from an index, or null to fall back to the in-memory sort.
 * Only fires when the WHOLE collection is being returned (empty query) and the sort
 * is a single indexed field — the case where the index order IS the answer.
 */
Collection.prototype._makeSortProvider = function (query, plan) {
  var self = this;
  var wholeCollection = !query || (typeof query === 'object' && !Array.isArray(query) && Object.keys(query).length === 0);
  if (!wholeCollection || plan) { return null; } // only the unfiltered full-scan case
  return function (sortSpec) {
    if (!sortSpec) { return null; }
    var fields = Object.keys(sortSpec);
    if (fields.length !== 1) { return null; }
    var f = fields[0];
    var dir = sortSpec[f];
    if (dir !== 1 && dir !== -1) { return null; }
    var idx = self._indexes[f];
    if (!idx || idx.compound || idx.multiKey) { return null; } // single-field, non-multikey only
    return idx.sorted(dir);
  };
};

Collection.prototype.findOne = function (query, projection) {
  var plan = this._planQuery(query);
  if (plan) {
    if (plan.exact) {
      return plan.docs.length ? crud._project(plan.docs[0], projection, query) : null;
    }
    var prepared = crud._match.prepareQuery(query);
    for (var i = 0; i < plan.docs.length; ++i) {
      if (crud._match(plan.docs[i], prepared)) { return crud._project(plan.docs[i], projection, query); }
    }
    return null;
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

/** Per-index usage stats (for $indexStats). MongoDB-style name (e.g. 'a_1_b_1'). */
Collection.prototype.indexStats = function () {
  var out = [];
  for (var name in this._indexes) { if (this._indexes.hasOwnProperty(name)) {
    var idx = this._indexes[name];
    out.push({ name: statName(idx), key: _.assign({}, idx.spec), accesses: { ops: idx.hits } });
  }}
  return out;
};

/** MongoDB index name: fields with directions joined by '_' (e.g. 'a_1_b_-1'). */
function statName(idx) {
  return idx.fields.map(function (f) { return f + '_' + idx.spec[f]; }).join('_');
}

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
