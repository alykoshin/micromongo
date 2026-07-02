'use strict';

/* eslint-disable @typescript-eslint/no-explicit-any -- the mongodb-driver adapter is an
   open-shape boundary (arbitrary user docs/queries/options); `any` is honest here per the
   CLAUDE.md typing policy, not laziness. */

/**
 * micromongo/mock — a drop-in `mongodb`-driver-shaped adapter backed by micromongo's
 * in-memory engine, for use in OTHER projects' autotests instead of a live MongoDB.
 *
 * Usage — point the code under test at this instead of `mongodb`:
 *
 *   // jest.config.js:  moduleNameMapper: { '^mongodb$': 'micromongo/mock' }
 *   // or directly in a test:
 *   const { MongoClient, ObjectId } = require('micromongo/mock');
 *   const client = await MongoClient.connect('mongodb://localhost/test');
 *   const db = client.db();
 *   await db.collection('users').insertOne({ name: 'a', age: 30 });
 *   const docs = await db.collection('users').find({ age: { $gt: 18 } }).toArray();
 *
 * What's faithful: MongoClient/Db/Collection/FindCursor/AggregationCursor with async
 * (Promise) results, `for await` iteration, auto-`ObjectId` `_id` on insert, bulkWrite,
 * the fluent initialize*BulkOp builders, createIndex(es)/listIndexes/indexInformation,
 * and every query/update/aggregation operator micromongo supports (see the compatibility
 * matrix). Sessions/transactions run the body WITHOUT real isolation (documented no-op).
 * What throws (server-only): change streams (`watch`) and Atlas `*SearchIndex*`.
 *
 * `reset()` is a test helper: it does nothing global (each MongoClient owns isolated
 * databases), but is exported so suites can call it in an afterEach without caring whether
 * state is global — create a fresh client per test for isolation.
 */

var MongoClient = require('./client');
var Db = require('./db');
var Collection = require('./collection');
var ObjectId = require('./object-id');
var cursors = require('./cursor');

interface MockModule {
  MongoClient: any;
  Db: any;
  Collection: any;
  ObjectId: any;
  FindCursor: any;
  AggregationCursor: any;
  // Convenience: a ready connected client (no await needed for the common in-memory case).
  createClient(uri?: string, options?: any): any;
}

var mockModule: MockModule = {
  MongoClient: MongoClient,
  Db: Db,
  Collection: Collection,
  ObjectId: ObjectId,
  FindCursor: cursors.FindCursor,
  AggregationCursor: cursors.AggregationCursor,
  createClient: function (uri?: string, options?: any): any {
    return new MongoClient(uri, options);
  },
};

export = mockModule;
