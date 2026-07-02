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
 * `hasNext`/`next`, or iteration) is called.
 *
 * Two execution paths, same results:
 *   - `_run()` — the canonical ARRAY path (filter → sort → skip → limit → project),
 *     used by `toArray`/`forEach`/`map`/`count`/`next`/`hasNext`.
 *   - `_stream()` — a lazy GENERATOR yielding one projected doc at a time, used by
 *     `[Symbol.iterator]` (`for…of`/spread), `[Symbol.asyncIterator]` (`for await`), and
 *     `.stream()`. It early-terminates on `limit` (constant memory, doesn't scan the rest)
 *     when there's NO sort. With a sort + limit it uses a bounded top-K heap (O(N log K)
 *     time, O(K) memory — never materializes the full sorted array). A plain sort with no
 *     limit still buffers all matches (a global sort genuinely needs every input).
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


// A stable multi-key comparator for a sort spec ({ a: 1, 'b.c': -1 }). Returns <0/0/>0.
// Shared by the full-array sort path and the bounded top-K heap so both order identically.
function makeComparator<T>(spec: Record<string, SortDir>): (a: T, b: T) => number {
  for (var f in spec) { if (spec.hasOwnProperty(f)) {
    if (spec[f] !== 1 && spec[f] !== -1) { throw new Error('Sort direction must be 1 or -1'); }
  }}
  return function (a: T, b: T): number {
    for (var f in spec) { if (spec.hasOwnProperty(f)) {
      var dir = spec[f];
      var va = get(a, f), vb = get(b, f);
      var r = (va < vb) ? -1 : (va > vb ? 1 : 0);
      if (r !== 0) { return r * dir; }
    }}
    return 0;
  };
}

/**
 * Bounded top-K selection: scan an iterable, keeping only the `k` smallest by `cmp` in a
 * binary MAX-heap (root = the current worst of the kept set). Memory is O(k); time O(N log k).
 * Returns the kept docs SORTED ascending by `cmp`. This is the "partial sort without full
 * buffering" path: it never holds more than k docs, yet must still SCAN all N (you can't know
 * the top-k without looking at every candidate).
 */
function topK<T>(iter: Iterable<T>, k: number, cmp: (a: T, b: T) => number): T[] {
  if (k <= 0) { return []; }
  var heap: T[] = [];  // max-heap: heap[0] is the largest kept (first to evict)

  function siftUp(i: number): void {
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (cmp(heap[i], heap[p]) > 0) { var t = heap[i]; heap[i] = heap[p]; heap[p] = t; i = p; }
      else { break; }
    }
  }
  function siftDown(i: number): void {
    var n = heap.length;
    for (;;) {
      var l = 2 * i + 1, r = l + 1, big = i;
      if (l < n && cmp(heap[l], heap[big]) > 0) { big = l; }
      if (r < n && cmp(heap[r], heap[big]) > 0) { big = r; }
      if (big === i) { break; }
      var t = heap[i]; heap[i] = heap[big]; heap[big] = t; i = big;
    }
  }

  for (var doc of iter) {
    if (heap.length < k) {
      heap.push(doc);
      siftUp(heap.length - 1);
    } else if (cmp(doc, heap[0]) < 0) {
      // `doc` is better (smaller) than the current worst kept → replace the root.
      heap[0] = doc;
      siftDown(0);
    }
  }
  // Heap holds the k best in heap order; return them fully sorted ascending.
  return heap.sort(cmp);
}


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

  // --- execution ---

  // Deep-copy + project one doc (the last stage of both paths). Kept as a method so
  // `_run` and `_stream` project identically.
  _project(d: T): T {
    return project(d, this._projection, this._query) as T;
  }

  // The ordered, sliced, but NOT-yet-projected candidate docs. Shared spine of `_run`
  // (which then projects into an array) — the array path.
  _ordered(): T[] {
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
        docs = docs.slice().sort(makeComparator<T>(this._sort));
      }
    }

    // 3. skip / limit
    if (this._skip) { docs = docs.slice(this._skip); }
    if (this._limit !== null) { docs = docs.slice(0, this._limit); }
    return docs;
  }

  _run(): T[] {
    var self = this;
    return this._ordered().map(function (d: T) { return self._project(d); });
  }

  /**
   * The STREAMING path: a generator yielding one PROJECTED doc at a time. Same results as
   * `_run()`, but:
   *   - No sort → pull from `matches()` lazily and early-terminate once `limit` docs are
   *     emitted (skip is honored while streaming). Constant memory; the tail is never scanned.
   *   - Sort + limit (no index provider) → bounded top-K heap: hold at most `skip+limit`
   *     docs while scanning, then emit the sliced window. O(N log K) time, O(K) memory.
   *   - Sort, no limit (or an index-ordered provider) → defer to `_ordered()` (a global sort
   *     needs all input; an index provider already yields sorted order) and stream that array.
   */
  *_stream(): IterableIterator<T> {
    var self = this;
    var hasSort = !!this._sort;
    var indexSorted = hasSort && this._sortProvider && this._sortProvider(this._sort as any);

    // Path A — no sort: lazy pull-through with early termination on limit.
    if (!hasSort) {
      var skipLeft = this._skip;
      var remaining = this._limit; // null = unbounded
      if (remaining === 0) { return; }
      for (var m of matches(this._data, this._query)) {
        if (skipLeft > 0) { skipLeft--; continue; }
        yield self._project(m.doc);
        if (remaining !== null && --remaining <= 0) { return; } // early-terminate: stop scanning
      }
      return;
    }

    // Path B — sort + limit, no index provider: bounded top-K (never buffers all N).
    // STABILITY: `Array.prototype.sort` (the array path) is stable, so ties keep input order.
    // A heap isn't stable, so we tag each doc with its scan index and break ties on it — the
    // top-K result then matches the full-sort result exactly, ties included.
    if (this._limit !== null && !indexSorted) {
      var k = this._skip + this._limit;
      var baseCmp = makeComparator<T>(this._sort as any);
      var stableCmp = function (a: { i: number; doc: T }, b: { i: number; doc: T }): number {
        var r = baseCmp(a.doc, b.doc);
        return r !== 0 ? r : (a.i - b.i);  // tiebreak on original scan order
      };
      var tagged = (function* (): IterableIterator<{ i: number; doc: T }> {
        var i = 0;
        for (var mm of matches(self._data, self._query)) { yield { i: i++, doc: mm.doc }; }
      })();
      var best = topK<{ i: number; doc: T }>(tagged, k, stableCmp);  // ≤ k tagged docs held
      var window = best.slice(this._skip);                          // apply skip within the k kept
      for (var w = 0; w < window.length; w++) { yield self._project(window[w].doc); }
      return;
    }

    // Path C — sort with no limit, or an index-ordered provider: reuse the array spine
    // (a global sort needs all input; an index provider already yields sorted order).
    var ordered = this._ordered();
    for (var j = 0; j < ordered.length; j++) { yield self._project(ordered[j]); }
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

  // --- streaming terminals ---

  // Sync iteration: `for (const d of cursor)` and `[...cursor]`. Streams lazily (early
  // terminates on limit when there's no sort). Deep-immutable — each doc is projected/copied.
  [Symbol.iterator](): IterableIterator<T> {
    return this._stream();
  }

  // Async iteration: `for await (const d of cursor)`. Same lazy stream, one microtask per doc
  // (there's no real I/O in-memory; this is for driver-shape/`for await` compatibility).
  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    for (var d of this._stream()) { yield d; }
  }

  // A Node Readable object-stream over the results (for `.pipe()` and event consumers).
  // Lazily requires `stream` so a browser bundle never pulls it in.
  stream(): any {
    // eslint-disable-next-line global-require
    var Readable = require('stream').Readable;
    var it = this._stream();
    return new Readable({
      objectMode: true,
      read: function (this: any): void {
        var n = it.next();
        this.push(n.done ? null : n.value);
      },
    });
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
