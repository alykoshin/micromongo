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

var assign = require('lodash/assign');
var get = require('lodash/get');

var crud = require('./crud/');

import type { Doc, Query, Projection, SortDir } from './types';

var matches = crud._matches;
var project = crud._project;


class Cursor<T extends Doc = Doc> {
  _data: T[];
  _query: Query<T>;
  _sort: Record<string, SortDir> | null;
  _skip: number;
  _limit: number | null;
  _projection: Projection | null;
  _sortProvider: ((sortSpec: any) => T[] | null) | null;
  _explainPlan: any; // value: Collection-supplied plan metadata (heterogeneous)
  _materialized: T[] | null;
  _pos: number;

  /**
   * @param data  the array to query (owned by a Collection)
   * @param query the match query
   * @constructor
   */
  constructor(data: T[], query?: Query<T>) {
    this._data = data;
    this._query = query || {};
    this._sort = null;
    this._skip = 0;
    this._limit = null;
    this._projection = null;
    this._sortProvider = null; // optional: Collection-supplied index-ordered sort source
    this._explainPlan = null;  // optional: Collection-supplied query plan (for explain())
    this._materialized = null; // cached terminal result for hasNext/next
    this._pos = 0;
  }

  // --- chainable (deferred) ---

  sort(spec: Record<string, SortDir>): this {
    this._sort = spec;
    return this;
  }

  skip(n: number): this {
    if (typeof n !== 'number' || n < 0) { throw new TypeError('skip() expects a non-negative number'); }
    this._skip = Math.floor(n);
    return this;
  }

  limit(n: number): this {
    if (typeof n !== 'number' || n < 0) { throw new TypeError('limit() expects a non-negative number'); }
    this._limit = Math.floor(n);
    return this;
  }

  project(projection: Projection): this {
    this._projection = projection;
    return this;
  }

  // --- execution (single pass) ---

  _run(): T[] {
    // 1. filter (lazy seam) — collect matching docs in order
    var docs: T[] = [];
    for (var m of matches(this._data, this._query)) { docs.push(m.doc); }

    // 2. sort (stable multi-key, like aggregate $sort).
    if (this._sort) {
      // Sort fast-path: a Collection may attach a `_sortProvider` that returns the docs
      // already ordered from an index, letting us skip the in-memory sort entirely.
      var fromIndex = this._sortProvider ? this._sortProvider(this._sort) : null;
      if (fromIndex) {
        docs = fromIndex.slice();
      } else {
        var spec = this._sort;
        docs = docs.slice().sort(function (a: T, b: T) {
          for (var f in spec) { if (spec.hasOwnProperty(f)) {
            var dir = spec[f];
            if (dir !== 1 && dir !== -1) { throw new Error('Sort direction must be 1 or -1'); }
            var va = get(a, f), vb = get(b, f); // value: sort keys (any orderable)
            var r = (va < vb) ? -1 : (va > vb ? 1 : 0);
            if (r !== 0) { return r * dir; }
          }}
          return 0;
        });
      }
    }

    // 3. skip / limit
    if (this._skip) { docs = docs.slice(this._skip); }
    if (this._limit !== null) { docs = docs.slice(0, this._limit); }

    // 4. project (deep-copies each doc, so the result is independent of source)
    return docs.map(function (this: any, d: T) { return project(d, this._projection, this._query); }, this) as T[];
  }

  // --- terminals ---

  toArray(): T[] {
    return this._run();
  }

  forEach(fn: (doc: T, index: number, array: T[]) => void): void {
    this._run().forEach(fn);
  }

  map(fn: (doc: T, index: number, array: T[]) => any): any[] {
    return this._run().map(fn);
  }

  count(): number {
    // count ignores skip/limit by default in the legacy driver, but countDocuments
    // honors them; we honor skip/limit to match the cursor's visible result.
    return this._run().length;
  }

  /**
   * Return the query plan (MongoDB-style `explain`): whether an index was used
   * (`COLLSCAN` vs `IXSCAN`/`IXSCAN+FILTER`), which index, exact-vs-refiltered, the
   * candidate count vs total docs, and the sort source. Does NOT run the query.
   * Only meaningful for a cursor from `Collection.find()` (the functional API has no
   * indexes); a bare cursor reports a COLLSCAN.
   */
  explain(): any { // report: heterogeneous explain() plan metadata
    var base = this._explainPlan || { stage: 'COLLSCAN', indexed: false, exact: true };
    return assign({}, base, {
      sort: this._sort || null,
      sortFromIndex: !!(this._sort && this._sortProvider && this._sortProvider(this._sort)),
      skip: this._skip,
      limit: this._limit,
      projection: this._projection || null,
    });
  }

  // Iterator-style terminals (materialize once, then walk).
  hasNext(): boolean {
    if (this._materialized === null) { this._materialized = this._run(); }
    return this._pos < this._materialized.length;
  }

  next(): T | null {
    if (this._materialized === null) { this._materialized = this._run(); }
    return this._pos < this._materialized.length ? this._materialized[this._pos++] : null;
  }
}


export = Cursor;
