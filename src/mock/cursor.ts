'use strict';

/* eslint-disable @typescript-eslint/no-explicit-any -- the mongodb-driver adapter is an
   open-shape boundary (arbitrary user docs/queries/options); `any` is honest here per the
   CLAUDE.md typing policy, not laziness. */

/**
 * Driver-shaped cursors for `micromongo/mock`.
 *
 * The `mongodb` driver's cursors are async: `.toArray()` returns a Promise, they support
 * `for await`, `.next()`/`.hasNext()` are async, and `.forEach()` resolves a Promise. Under
 * the hood micromongo's Cursor is fully SYNCHRONOUS, so these classes are thin async
 * adapters — they compute eagerly-but-lazily against the sync engine and wrap every result
 * in a resolved Promise, plus expose `Symbol.asyncIterator`.
 *
 * FindCursor wraps a micromongo Cursor (so chainable `.sort/.skip/.limit/.project` defer to
 * the real engine). AggregationCursor wraps an already-materialized array (aggregate runs
 * eagerly in micromongo).
 */

// A minimal shared base: async iteration + terminal helpers over a `_materialize()` hook
// that each subclass implements to produce the final array synchronously.
abstract class BaseCursor<T> {
  protected _consumed: boolean;

  constructor() { this._consumed = false; }

  // Subclasses return the fully-resolved array (sync).
  protected abstract _materialize(): T[];

  toArray(): Promise<T[]> {
    return Promise.resolve(this._materialize());
  }

  async forEach(fn: (doc: T) => void): Promise<void> {
    var arr = this._materialize();
    for (var i = 0; i < arr.length; i++) { fn(arr[i]); }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    var arr = this._materialize();
    for (var i = 0; i < arr.length; i++) { yield arr[i]; }
  }

  // next()/hasNext() consume the (memoized) materialized array position-by-position.
  private _buf: T[] | null = null;
  private _pos = 0;
  private _buffer(): T[] {
    if (this._buf === null) { this._buf = this._materialize(); }
    return this._buf;
  }
  next(): Promise<T | null> {
    var b = this._buffer();
    return Promise.resolve(this._pos < b.length ? b[this._pos++] : null);
  }
  hasNext(): Promise<boolean> {
    return Promise.resolve(this._pos < this._buffer().length);
  }

  async close(): Promise<void> { this._consumed = true; }
}


/**
 * FindCursor — chainable (sort/skip/limit/project/map) over the micromongo Cursor, async
 * terminals. Mirrors the driver's `FindCursor`.
 */
class FindCursor<T = any> extends BaseCursor<T> {
  private _mmCollection: any;     // the micromongo Collection (for filter/clone re-query)
  private _query: any;
  private _mmCursor: any;         // micromongo Cursor (built lazily from collection+query)
  private _mapFn: ((d: any) => any) | null;

  // `mkCursor(collection, query)` builds a fresh micromongo Cursor — injected so this file
  // needn't import Collection (avoids a cycle) and clone/filter can re-query cheaply.
  private _mk: (collection: any, query: any) => any;

  constructor(mmCollection: any, query: any, mkCursor: (c: any, q: any) => any) {
    super();
    this._mmCollection = mmCollection;
    this._query = query || {};
    this._mk = mkCursor;
    this._mmCursor = mkCursor(mmCollection, this._query);
    this._mapFn = null;
  }

  // --- deferred, chainable (return this) ---
  sort(spec: any, direction?: 1 | -1): this {
    // driver also accepts sort(field, dir); normalize to a spec object
    if (typeof spec === 'string') {
      var o: any = {}; o[spec] = direction == null ? 1 : direction; this._mmCursor.sort(o);
    } else {
      this._mmCursor.sort(spec);
    }
    return this;
  }
  skip(n: number): this { this._mmCursor.skip(n); return this; }
  limit(n: number): this { this._mmCursor.limit(n); return this; }
  project(p: any): this { this._mmCursor.project(p); return this; }
  map<U>(fn: (d: T) => U): FindCursor<U> {
    var prev = this._mapFn;
    this._mapFn = prev ? function (d: any) { return fn((prev as (x: any) => any)(d)); } : (fn as any);
    return this as unknown as FindCursor<U>;
  }

  /** Set/extend the query and rebuild the underlying cursor (driver `filter()`). */
  filter(query: any): this {
    this._query = query || {};
    this._mmCursor = this._mk(this._mmCollection, this._query);
    return this;
  }

  /** A fresh, unconsumed cursor with the same query (driver `clone()`). */
  clone(): FindCursor<T> {
    return new FindCursor<T>(this._mmCollection, this._query, this._mk);
  }

  /** Reset iteration to the start (driver `rewind()`). */
  rewind(): this { (this as any)._buf = null; (this as any)._pos = 0; return this; }

  /** Non-blocking next — in-memory there's nothing to await, so identical to next(). */
  tryNext(): Promise<T | null> { return this.next(); }

  /** A Node Readable stream of the results (some suites pipe cursors). */
  stream(): any {
    // Lazily require stream so a browser build never pulls it in.
    // eslint-disable-next-line global-require
    var Readable = require('stream').Readable;
    var arr = this._materialize();
    var i = 0;
    return new Readable({
      objectMode: true,
      read: function (this: any) { this.push(i < arr.length ? arr[i++] : null); },
    });
  }

  // --- terminals ---
  protected _materialize(): T[] {
    var arr = this._mmCursor.toArray();
    return this._mapFn ? arr.map(this._mapFn) : arr;
  }

  // Lazy async iteration: stream one doc at a time from the CORE cursor's generator (so a
  // `limit` early-terminates and a `sort`+`limit` uses the bounded top-K), instead of the
  // base class's materialize-then-walk. Overrides BaseCursor's array-based asyncIterator.
  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    var mapFn = this._mapFn;
    for (var d of this._mmCursor) {   // core Cursor[Symbol.iterator] → lazy _stream()
      yield mapFn ? mapFn(d) : d;
    }
  }

  count(): Promise<number> {
    // count ignores skip/limit like the driver's deprecated cursor.count() default
    return Promise.resolve(this._mmCursor.count());
  }

  explain(): Promise<any> {
    return Promise.resolve(this._mmCursor.explain());
  }

  // --- wire/planner hints: meaningless in-memory, chainable no-ops (return this) ---
  hint(_h?: any): this { return this; }
  collation(_c?: any): this { return this; }
  comment(_c?: any): this { return this; }
  maxTimeMS(_ms?: number): this { return this; }
  maxAwaitTimeMS(_ms?: number): this { return this; }
  allowDiskUse(_v?: boolean): this { return this; }
  batchSize(_n?: number): this { return this; }
  returnKey(_v?: boolean): this { return this; }
  showRecordId(_v?: boolean): this { return this; }
  min(_v?: any): this { return this; }
  max(_v?: any): this { return this; }
  addCursorFlag(_f?: string, _v?: boolean): this { return this; }
  addQueryModifier(_n?: string, _v?: any): this { return this; }
  bufferedCount(): number { return 0; }
}


/**
 * AggregationCursor — wraps an already-materialized result array. Supports the same async
 * terminals; `.sort`/`.skip`/`.limit` on an aggregation cursor are uncommon and omitted
 * (put those stages in the pipeline instead).
 */
class AggregationCursor<T = any> extends BaseCursor<T> {
  private _arr: T[];
  private _mapFn: ((d: any) => any) | null;

  constructor(arr: T[]) {
    super();
    this._arr = arr;
    this._mapFn = null;
  }

  map<U>(fn: (d: T) => U): AggregationCursor<U> {
    var prev = this._mapFn;
    this._mapFn = prev ? function (d: any) { return fn((prev as (x: any) => any)(d)); } : (fn as any);
    return this as unknown as AggregationCursor<U>;
  }

  protected _materialize(): T[] {
    return this._mapFn ? this._arr.map(this._mapFn) : this._arr.slice();
  }
}


export = { FindCursor: FindCursor, AggregationCursor: AggregationCursor, BaseCursor: BaseCursor };
