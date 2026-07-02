/**
 * Tests for `micromongo/mock` — the mongodb-driver-shaped adapter (src/mock).
 *
 * These are micromongo-specific (no MongoDB doc-example to port), so plain unit tests:
 * they assert the DRIVER SHAPE (async Promises, cursors, ObjectId, result shapes,
 * sessions, and loud throws on server-only features) over the real micromongo engine.
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var mock = require('../dist/mock');
var MongoClient = mock.MongoClient;
var ObjectId = mock.ObjectId;

function isObjectId(v) {
  return v instanceof ObjectId || (v && v._bsontype === 'ObjectId');
}

describe('# micromongo/mock (mongodb driver adapter)', function () {

  var client, db, coll;
  beforeEach(async function () {
    client = await MongoClient.connect('mongodb://localhost:27017/testdb');
    db = client.db();
    coll = db.collection('items');
  });

  describe('# MongoClient / Db', function () {
    it('# connect() resolves the client; db() name from the URI', function () {
      expect(db.databaseName).eql('testdb');
    });
    it('# db().collection() returns the same instance for a name (isolated per Db)', function () {
      expect(db.collection('items')).equal(coll);
    });
    it('# separate clients have isolated data', async function () {
      await coll.insertOne({ a: 1 });
      var client2 = await MongoClient.connect('mongodb://localhost/testdb');
      expect(await client2.db().collection('items').countDocuments({})).eql(0);
      await client2.close();
    });
    it('# listCollections().toArray() lists created collections', async function () {
      db.collection('a'); db.collection('b');
      var names = (await db.listCollections().toArray()).map(function (d) { return d.name; }).sort();
      expect(names).to.include('a').and.include('b');
    });
  });

  describe('# ObjectId', function () {
    it('# new ObjectId() is a 24-char hex, equals itself', function () {
      var id = new ObjectId();
      expect(String(id)).to.match(/^[0-9a-f]{24}$/);
      expect(id.equals(new ObjectId(String(id)))).eql(true);
    });
    it('# ObjectId.isValid', function () {
      expect(ObjectId.isValid(String(new ObjectId()))).eql(true);
      expect(ObjectId.isValid('nope')).eql(false);
    });
  });

  describe('# inserts (async, auto ObjectId)', function () {
    it('# insertOne returns { acknowledged, insertedId } with a generated ObjectId', async function () {
      var r = await coll.insertOne({ name: 'a' });
      expect(r.acknowledged).eql(true);
      expect(isObjectId(r.insertedId)).eql(true);
    });
    it('# insertOne preserves an explicit _id', async function () {
      var r = await coll.insertOne({ _id: 42, name: 'a' });
      expect(r.insertedId).eql(42);
    });
    it('# insertMany returns insertedIds keyed by index', async function () {
      var r = await coll.insertMany([{ x: 1 }, { _id: 7, x: 2 }]);
      expect(r.insertedCount).eql(2);
      expect(isObjectId(r.insertedIds[0])).eql(true);
      expect(r.insertedIds[1]).eql(7);
    });
  });

  describe('# find cursor', function () {
    beforeEach(async function () {
      await coll.insertMany([{ n: 3 }, { n: 1 }, { n: 2 }]);
    });
    it('# toArray() returns a Promise of matches', async function () {
      var all = await coll.find({}).toArray();
      expect(all).to.have.length(3);
    });
    it('# sort/limit/project chain', async function () {
      var top = await coll.find({}).sort({ n: -1 }).limit(1).project({ _id: 0, n: 1 }).toArray();
      expect(top).eql([{ n: 3 }]);
    });
    it('# find(q, options) honors the driver options bag (projection/sort/limit/skip)', async function () {
      var top = await coll.find({}, { sort: { n: -1 }, limit: 1, projection: { _id: 0, n: 1 } }).toArray();
      expect(top).eql([{ n: 3 }]);
    });
    it('# findOne(q, { projection }) applies the projection', async function () {
      var doc = await coll.findOne({}, { sort: { n: 1 }, projection: { _id: 0, n: 1 } });
      expect(doc).eql({ n: 1 });
    });
    it('# for-await async iteration', async function () {
      var ns = [];
      for await (var d of coll.find({}).sort({ n: 1 })) { ns.push(d.n); }
      expect(ns).eql([1, 2, 3]);
    });
    it('# next()/hasNext()', async function () {
      var cur = coll.find({}).sort({ n: 1 });
      expect(await cur.hasNext()).eql(true);
      expect((await cur.next()).n).eql(1);
      expect((await cur.next()).n).eql(2);
    });
    it('# map() transforms results', async function () {
      var ns = await coll.find({}).sort({ n: 1 }).map(function (d) { return d.n * 10; }).toArray();
      expect(ns).eql([10, 20, 30]);
    });
    it('# wire hints (hint/collation/maxTimeMS) are chainable no-ops', async function () {
      var all = await coll.find({}).hint({ n: 1 }).collation({ locale: 'en' }).maxTimeMS(100).toArray();
      expect(all).to.have.length(3);
    });
    it('# clone() gives a fresh unconsumed cursor', async function () {
      var c1 = coll.find({});
      await c1.toArray();
      var c2 = c1.clone();
      expect(await c2.toArray()).to.have.length(3);
    });
    it('# explain() returns a plan without running', async function () {
      var plan = await coll.find({ n: 1 }).explain();
      expect(plan).to.have.property('stage');
    });
  });

  describe('# aggregate cursor', function () {
    it('# aggregate().toArray()', async function () {
      await coll.insertMany([{ s: 'A' }, { s: 'B' }, { s: 'A' }]);
      var out = await coll.aggregate([{ $group: { _id: '$s', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray();
      expect(out).eql([{ _id: 'A', n: 2 }, { _id: 'B', n: 1 }]);
    });
  });

  describe('# updates / deletes (driver result shapes)', function () {
    beforeEach(async function () {
      await coll.insertMany([{ _id: 1, s: 'A' }, { _id: 2, s: 'A' }, { _id: 3, s: 'B' }]);
    });
    it('# updateMany returns matched/modified + null upsertedId', async function () {
      var r = await coll.updateMany({ s: 'A' }, { $set: { s: 'C' } });
      expect(r).eql({ acknowledged: true, matchedCount: 2, modifiedCount: 2, upsertedCount: 0, upsertedId: null });
    });
    it('# upsert reports upsertedId', async function () {
      var r = await coll.updateOne({ _id: 9 }, { $set: { s: 'Z' } }, { upsert: true });
      expect(r.upsertedId).eql(9);
      expect(r.upsertedCount).eql(1);
    });
    it('# deleteMany returns { acknowledged, deletedCount }', async function () {
      var r = await coll.deleteMany({ s: 'A' });
      expect(r).eql({ acknowledged: true, deletedCount: 2 });
    });
    it('# findOneAndUpdate returns the doc (modern default)', async function () {
      var doc = await coll.findOneAndUpdate({ _id: 1 }, { $set: { s: 'X' } });
      expect(doc).eql({ _id: 1, s: 'A' }); // BEFORE modification
    });
    it('# findOneAndUpdate with includeResultMetadata returns { value }', async function () {
      var res = await coll.findOneAndUpdate({ _id: 2 }, { $set: { s: 'Y' } }, { includeResultMetadata: true });
      expect(res.value).eql({ _id: 2, s: 'A' });
      expect(res.ok).eql(1);
    });
  });

  describe('# bulkWrite + fluent bulk builders', function () {
    it('# bulkWrite(ops)', async function () {
      var r = await coll.bulkWrite([
        { insertOne: { document: { _id: 1 } } },
        { insertOne: { document: { _id: 2 } } },
        { deleteOne: { filter: { _id: 1 } } },
      ]);
      expect(r.insertedCount).eql(2);
      expect(r.deletedCount).eql(1);
      expect(await coll.countDocuments({})).eql(1);
    });
    it('# initializeUnorderedBulkOp fluent builder', async function () {
      await coll.insertOne({ _id: 1, v: 0 });
      var bulk = coll.initializeUnorderedBulkOp();
      bulk.insert({ _id: 2, v: 5 });
      bulk.find({ _id: 1 }).updateOne({ $set: { v: 9 } });
      var r = await bulk.execute();
      expect(r.insertedCount).eql(1);
      expect(r.modifiedCount).eql(1);
      expect((await coll.find({ _id: 1 }).toArray())[0].v).eql(9);
    });
  });

  describe('# indexes (driver shape)', function () {
    it('# createIndex returns the name; listIndexes/indexExists work', async function () {
      var name = await coll.createIndex({ age: 1 });
      expect(name).eql('age_1');
      expect(await coll.indexExists('age_1')).eql(true);
      var specs = await coll.listIndexes().toArray();
      expect(specs.map(function (s) { return s.name; })).to.include('age_1');
    });
  });

  describe('# sessions / transactions (no isolation)', function () {
    it('# withTransaction runs the body and returns its value', async function () {
      var session = client.startSession();
      var out = await session.withTransaction(async function () {
        await coll.insertOne({ _id: 1 });
        return 'done';
      });
      expect(out).eql('done');
      expect(await coll.countDocuments({})).eql(1);
      await session.endSession();
    });
    it('# abortTransaction does NOT roll back (documented no-op)', async function () {
      var session = client.startSession();
      session.startTransaction();
      await coll.insertOne({ _id: 1 });
      await session.abortTransaction();
      expect(await coll.countDocuments({})).eql(1); // still there — no real rollback
    });
    it('# withSession runs and ends the session', async function () {
      var ended = false;
      await client.withSession(async function (s) {
        var orig = s.endSession;
        s.endSession = function () { ended = true; return orig.call(s); };
        await coll.insertOne({ _id: 1 });
      });
      expect(ended).eql(true);
    });
  });

  describe('# server-only features throw loudly', function () {
    it('# watch() throws', function () {
      expect(function () { coll.watch(); }).to.throw(/requires a real MongoDB server/);
    });
    it('# createSearchIndex() throws', function () {
      expect(function () { coll.createSearchIndex({}); }).to.throw(/not supported|requires a real/);
    });
    it('# db.watch() throws', function () {
      expect(function () { db.watch(); }).to.throw(/requires a real MongoDB server/);
    });
  });
});
