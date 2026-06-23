/**
 * Cursor — a lazy, chainable result handle, MongoDB-driver style:
 *
 *     collection.find({ age: { $gte: 18 } })
 *       .sort({ age: -1 })
 *       .skip(10)
 *       .limit(5)
 *       .project({ name: 1 })
 *       .toArray();
 *
 * `sort`/`skip`/`limit`/`project` are DEFERRED and chainable (return `this`).
 * No work happens until a TERMINAL method (`toArray`/`forEach`/`count`/`map`/
 * `hasNext`/`next`/`forEach`) is called. Execution is a single pass over the
 * `matches()` seam: filter → sort → skip → limit → project.
 *
 * Built on the Layer-2 functional engine; it does not mutate the source array
 * (reads are deep-immutable, like `find`).
 */

'use strict';

var _ = require('lodash');
var crud = require('./crud/');

var matches = crud._matches;
var project = crud._project;


/**
 * @param {Array}  data  the array to query (owned by a Collection)
 * @param {Object} query the match query
 * @constructor
 */
function Cursor(data, query) {
  this._data = data;
  this._query = query || {};
  this._sort = null;
  this._skip = 0;
  this._limit = null;
  this._projection = null;
  this._materialized = null; // cached terminal result for hasNext/next
  this._pos = 0;
}

// --- chainable (deferred) ---

Cursor.prototype.sort = function (spec) {
  this._sort = spec;
  return this;
};

Cursor.prototype.skip = function (n) {
  if (typeof n !== 'number' || n < 0) { throw new TypeError('skip() expects a non-negative number'); }
  this._skip = Math.floor(n);
  return this;
};

Cursor.prototype.limit = function (n) {
  if (typeof n !== 'number' || n < 0) { throw new TypeError('limit() expects a non-negative number'); }
  this._limit = Math.floor(n);
  return this;
};

Cursor.prototype.project = function (projection) {
  this._projection = projection;
  return this;
};

// --- execution (single pass) ---

Cursor.prototype._run = function () {
  // 1. filter (lazy seam) — collect matching docs in order
  var docs = [];
  for (var m of matches(this._data, this._query)) { docs.push(m.doc); }

  // 2. sort (stable multi-key, like aggregate $sort)
  if (this._sort) {
    var spec = this._sort;
    docs = docs.slice().sort(function (a, b) {
      for (var f in spec) { if (spec.hasOwnProperty(f)) {
        var dir = spec[f];
        if (dir !== 1 && dir !== -1) { throw new Error('Sort direction must be 1 or -1'); }
        var va = _.get(a, f), vb = _.get(b, f);
        var r = (va < vb) ? -1 : (va > vb ? 1 : 0);
        if (r !== 0) { return r * dir; }
      }}
      return 0;
    });
  }

  // 3. skip / limit
  if (this._skip) { docs = docs.slice(this._skip); }
  if (this._limit !== null) { docs = docs.slice(0, this._limit); }

  // 4. project (deep-copies each doc, so the result is independent of source)
  return docs.map(function (d) { return project(d, this._projection, this._query); }, this);
};

// --- terminals ---

Cursor.prototype.toArray = function () {
  return this._run();
};

Cursor.prototype.forEach = function (fn) {
  this._run().forEach(fn);
};

Cursor.prototype.map = function (fn) {
  return this._run().map(fn);
};

Cursor.prototype.count = function () {
  // count ignores skip/limit by default in the legacy driver, but countDocuments
  // honors them; we honor skip/limit to match the cursor's visible result.
  return this._run().length;
};

// Iterator-style terminals (materialize once, then walk).
Cursor.prototype.hasNext = function () {
  if (this._materialized === null) { this._materialized = this._run(); }
  return this._pos < this._materialized.length;
};

Cursor.prototype.next = function () {
  if (this._materialized === null) { this._materialized = this._run(); }
  return this._pos < this._materialized.length ? this._materialized[this._pos++] : null;
};


module.exports = Cursor;
