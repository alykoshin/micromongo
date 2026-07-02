'use strict';

/* eslint-disable @typescript-eslint/no-explicit-any -- the mongodb-driver adapter is an
   open-shape boundary (arbitrary user docs/queries/options); `any` is honest here per the
   CLAUDE.md typing policy, not laziness. */

/**
 * MockCollection — the `mongodb`-driver-shaped facade over a micromongo Collection.
 *
 * Differences it bridges (see src/mock/index.ts for the whole story):
 *  - ASYNC: every driver method returns a Promise; micromongo is sync → wrap in
 *    Promise.resolve.
 *  - CURSORS: find()/aggregate() return async FindCursor/AggregationCursor.
 *  - _id GENERATION: the driver assigns an ObjectId to any inserted doc lacking `_id`;
 *    micromongo doesn't by default, so we inject one here BEFORE inserting (so the
 *    returned insertedId is a real ObjectId, matching the driver).
 *  - RESULT SHAPES: findOneAndUpdate returns the doc (modern default) or `{ value }`
 *    (legacy, via includeResultMetadata); index methods return driver-shaped specs.
 *  - SERVER-ONLY: watch()/*SearchIndex* THROW (loud, so a test relying on a real server
 *    feature fails instead of silently passing).
 */

var ObjectId = require('./object-id');
var cursors = require('./cursor');

var FindCursor = cursors.FindCursor;
var AggregationCursor = cursors.AggregationCursor;

function unsupported(name: string): never {
  throw new Error(
    "micromongo/mock: '" + name + "' requires a real MongoDB server and is not supported " +
    '(in-memory mock). Remove it from the code under test, or run against a real server.'
  );
}

// Deep-ish clone to give inserted docs their own identity (the driver copies on insert).
// A structuredClone-free clone that preserves ObjectId instances (never deep-copies them).
function cloneForInsert(doc: any): any {
  if (doc === null || typeof doc !== 'object') { return doc; }
  if (doc instanceof ObjectId || (doc as any)._bsontype === 'ObjectId') { return doc; }
  if (doc instanceof Date) { return new Date(doc.getTime()); }
  if (Array.isArray(doc)) { return doc.map(cloneForInsert); }
  var out: any = {};
  for (var k in doc) { if (Object.prototype.hasOwnProperty.call(doc, k)) { out[k] = cloneForInsert(doc[k]); } }
  return out;
}

// Ensure a doc has an `_id`, generating an ObjectId when absent (driver behavior).
function withId(doc: any): any {
  var d = cloneForInsert(doc);
  if (d._id === undefined || d._id === null) { d._id = new ObjectId(); }
  return d;
}

// Build a micromongo Cursor for (collection, query) — passed into FindCursor so it can
// re-query on filter()/clone() without importing Collection.
function mkCursor(mmCollection: any, query: any): any {
  return mmCollection.find(query || {});
}


class MockCollection {
  private _c: any;          // the underlying micromongo Collection
  public collectionName: string;

  constructor(mmCollection: any, name: string) {
    this._c = mmCollection;
    this.collectionName = name;
  }

  // --- reads ---
  find(query?: any, options?: any): any {
    var cur = new FindCursor(this._c, query || {}, mkCursor);
    // The driver accepts these as an options bag on find() (as well as via cursor chaining):
    if (options) {
      if (options.projection) { cur.project(options.projection); }
      if (options.sort) { cur.sort(options.sort); }
      if (typeof options.skip === 'number') { cur.skip(options.skip); }
      if (typeof options.limit === 'number') { cur.limit(options.limit); }
    }
    return cur;
  }

  findOne(query?: any, options?: any): Promise<any> {
    // findOne honors options.projection like the driver; reuse find()+limit(1).
    var cur = this.find(query || {}, options);
    return cur.limit(1).toArray().then(function (arr: any[]) { return arr.length ? arr[0] : null; });
  }

  aggregate(pipeline?: any[], _options?: any): any {
    var out = this._c.aggregate(pipeline || []);
    return new AggregationCursor(out);
  }

  distinct(field: string, query?: any, _options?: any): Promise<any[]> {
    return Promise.resolve(this._c.distinct(field, query || {}));
  }

  count(query?: any, _options?: any): Promise<number> {
    return Promise.resolve(this._c.count(query || {}));
  }
  countDocuments(query?: any, _options?: any): Promise<number> {
    return Promise.resolve(this._c.countDocuments(query || {}));
  }
  estimatedDocumentCount(_options?: any): Promise<number> {
    return Promise.resolve(this._c.estimatedDocumentCount());
  }

  // --- inserts (auto-ObjectId _id, driver-shaped result) ---
  insertOne(doc: any, _options?: any): Promise<any> {
    var d = withId(doc);
    this._c.insertOne(d);
    return Promise.resolve({ acknowledged: true, insertedId: d._id });
  }

  insertMany(docs: any[], _options?: any): Promise<any> {
    var prepared = docs.map(withId);
    this._c.insertMany(prepared);
    var insertedIds: Record<number, any> = {};
    for (var i = 0; i < prepared.length; i++) { insertedIds[i] = prepared[i]._id; }
    return Promise.resolve({ acknowledged: true, insertedCount: prepared.length, insertedIds: insertedIds });
  }

  // --- updates ---
  // The core Collection now returns the exact driver UpdateResult shape
  // ({ acknowledged, matchedCount, modifiedCount, upsertedCount, upsertedId }, the last two
  // always present), so the mock just awaits it — no normalization needed.
  updateOne(filter: any, update: any, options?: any): Promise<any> {
    return Promise.resolve(this._c.updateOne(filter, update, options));
  }
  updateMany(filter: any, update: any, options?: any): Promise<any> {
    return Promise.resolve(this._c.updateMany(filter, update, options));
  }
  replaceOne(filter: any, replacement: any, options?: any): Promise<any> {
    return Promise.resolve(this._c.replaceOne(filter, replacement, options));
  }

  // --- deletes ---
  deleteOne(filter: any, _options?: any): Promise<any> {
    return Promise.resolve(this._c.deleteOne(filter));
  }
  deleteMany(filter: any, _options?: any): Promise<any> {
    return Promise.resolve(this._c.deleteMany(filter));
  }

  // --- findOneAnd* (default: the doc; legacy: { value: doc } via includeResultMetadata) ---
  findOneAndUpdate(filter: any, update: any, options?: any): Promise<any> {
    return this._wrapFindAndModify(this._c.findOneAndUpdate(filter, update, options), options);
  }
  findOneAndReplace(filter: any, replacement: any, options?: any): Promise<any> {
    return this._wrapFindAndModify(this._c.findOneAndReplace(filter, replacement, options), options);
  }
  findOneAndDelete(filter: any, options?: any): Promise<any> {
    return this._wrapFindAndModify(this._c.findOneAndDelete(filter), options);
  }
  private _wrapFindAndModify(doc: any, options?: any): Promise<any> {
    // mongodb driver >= 5 returns the DOCUMENT by default; { includeResultMetadata: true }
    // (or the legacy pre-5 shape) returns { value, ok, lastErrorObject }.
    if (options && options.includeResultMetadata) {
      return Promise.resolve({ value: doc, ok: 1, lastErrorObject: { n: doc ? 1 : 0 } });
    }
    return Promise.resolve(doc);
  }

  // --- bulk ---
  bulkWrite(operations: any[], options?: any): Promise<any> {
    return Promise.resolve(this._c.bulkWrite(operations, options));
  }

  // Fluent bulk builders over the same engine.
  initializeOrderedBulkOp(_options?: any): any { return this._makeBulkOp(true); }
  initializeUnorderedBulkOp(_options?: any): any { return this._makeBulkOp(false); }
  private _makeBulkOp(ordered: boolean): any {
    var self = this;
    var ops: any[] = [];
    var api: any = {
      insert: function (doc: any) { ops.push({ insertOne: { document: doc } }); return api; },
      find: function (filter: any) {
        return {
          updateOne: function (u: any) { ops.push({ updateOne: { filter: filter, update: u } }); return api; },
          update: function (u: any) { ops.push({ updateMany: { filter: filter, update: u } }); return api; },
          replaceOne: function (r: any) { ops.push({ replaceOne: { filter: filter, replacement: r } }); return api; },
          deleteOne: function () { ops.push({ deleteOne: { filter: filter } }); return api; },
          delete: function () { ops.push({ deleteMany: { filter: filter } }); return api; },
          remove: function () { ops.push({ deleteMany: { filter: filter } }); return api; },
        };
      },
      execute: function () { return self.bulkWrite(ops, { ordered: ordered }); },
    };
    return api;
  }

  // --- indexes (driver-shaped, over micromongo's real index metadata) ---
  // The core Collection now returns the driver-shaped values directly (createIndex → name
  // string, createIndexes → string[], dropIndex → { ok: 1 }, dropIndexes → boolean), so the
  // mock just awaits them. `options.name` overrides the derived name, like the driver.
  createIndex(spec: any, options?: any): Promise<string> {
    var name = this._c.createIndex(spec);
    return Promise.resolve((options && options.name) || name);
  }
  createIndexes(specs: any[], _options?: any): Promise<string[]> {
    return Promise.resolve(this._c.createIndexes(specs));
  }
  dropIndex(name: any, _options?: any): Promise<any> {
    return Promise.resolve(this._c.dropIndex(name));
  }
  dropIndexes(_options?: any): Promise<boolean> {
    return Promise.resolve(this._c.dropIndexes());
  }
  indexes(_options?: any): Promise<any[]> {
    return Promise.resolve(this._c.indexes());
  }
  listIndexes(_options?: any): any {
    // driver returns a cursor; wrap the specs in an AggregationCursor-like async cursor.
    return new AggregationCursor(this._c.listIndexes());
  }
  indexInformation(_options?: any): Promise<any> {
    return Promise.resolve(this._c.indexInformation());
  }
  indexExists(name: any, _options?: any): Promise<boolean> {
    return Promise.resolve(this._c.indexExists(name));
  }

  // --- collection admin ---
  drop(_options?: any): Promise<boolean> {
    return Promise.resolve(this._c.drop());
  }
  options(_options?: any): Promise<any> { return Promise.resolve({}); }
  isCapped(_options?: any): Promise<boolean> { return Promise.resolve(false); }

  // --- server-only: throw loudly ---
  watch(..._args: any[]): never { return unsupported('Collection.watch (change streams)'); }
  createSearchIndex(..._a: any[]): never { return unsupported('createSearchIndex'); }
  createSearchIndexes(..._a: any[]): never { return unsupported('createSearchIndexes'); }
  dropSearchIndex(..._a: any[]): never { return unsupported('dropSearchIndex'); }
  listSearchIndexes(..._a: any[]): never { return unsupported('listSearchIndexes'); }
  updateSearchIndex(..._a: any[]): never { return unsupported('updateSearchIndex'); }
}

export = MockCollection;
