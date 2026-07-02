/**
 * Tests for the driver-shaped Collection conveniences added for `micromongo/mock`:
 * bulkWrite (Collection form), countDocuments/estimatedDocumentCount, and index
 * introspection (indexes/listIndexes/indexInformation/indexExists/createIndexes/
 * dropIndexes) + drop. These map onto the same engine/metadata micromongo already
 * has — the point is the MongoDB-driver SHAPE, so they get plain unit tests (no
 * -mongodoc; bulkWrite's Mongo-doc example is covered by test/crud/bulkwrite-mongodoc.js).
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var Collection = require('../dist/collection');

describe('# Collection — driver-shaped methods', function () {

  var c;
  beforeEach(function () {
    c = new Collection([
      { _id: 1, a: 1, b: 2 },
      { _id: 2, a: 2, b: 3 },
      { _id: 3, a: 1, b: 9 },
    ]);
  });

  describe('# count aliases', function () {
    it('# countDocuments(query) equals count(query)', function () {
      expect(c.countDocuments({ a: 1 })).eql(2);
      expect(c.countDocuments({})).eql(3);
    });
    it('# countDocuments() with no query counts all', function () {
      expect(c.countDocuments()).eql(3);
    });
    it('# estimatedDocumentCount() is the array length', function () {
      expect(c.estimatedDocumentCount()).eql(3);
    });
  });

  describe('# bulkWrite (Collection form)', function () {
    it('# batches heterogeneous writes and rebuilds indexes', function () {
      c.createIndex({ a: 1 });
      var res = c.bulkWrite([
        { insertOne: { document: { _id: 4, a: 5, b: 0 } } },
        { deleteOne: { filter: { _id: 2 } } },
        { updateOne: { filter: { _id: 1 }, update: { $set: { a: 7 } } } },
      ]);
      expect(res.acknowledged).eql(true);
      expect(res.insertedCount).eql(1);
      expect(res.deletedCount).eql(1);
      expect(res.modifiedCount).eql(1);
      expect(c.countDocuments({})).eql(3);
      // index still serves queries after the batch (rebuilt)
      expect(c.find({ a: 7 }).explain().stage).eql('IXSCAN');
    });
  });

  describe('# index introspection (driver shape)', function () {
    beforeEach(function () {
      c.createIndex({ a: 1 });
      c.createIndex({ a: 1, b: -1 });
    });

    it('# indexes() returns { v, key, name } specs with Mongo-style names', function () {
      expect(c.indexes()).eql([
        { v: 2, key: { a: 1 }, name: 'a_1' },
        { v: 2, key: { a: 1, b: -1 }, name: 'a_1_b_-1' },
      ]);
    });

    it('# listIndexes() aliases indexes()', function () {
      expect(c.listIndexes()).eql(c.indexes());
    });

    it('# indexInformation() maps name -> [[field, dir], …]', function () {
      expect(c.indexInformation()).eql({
        'a_1': [['a', 1]],
        'a_1_b_-1': [['a', 1], ['b', -1]],
      });
    });

    it('# indexExists() by name (string or array)', function () {
      expect(c.indexExists('a_1')).eql(true);
      expect(c.indexExists('nope')).eql(false);
      expect(c.indexExists(['a_1', 'a_1_b_-1'])).eql(true);
      expect(c.indexExists(['a_1', 'nope'])).eql(false);
    });

    it('# createIndexes() accepts driver {key} specs and bare specs', function () {
      c.createIndexes([{ key: { b: 1 } }, { c: 1 }]);
      var names = c.indexStats().map(function (s) { return s.name; });
      expect(names).to.include('b_1');
      expect(names).to.include('c_1');
    });

    it('# dropIndexes() removes every index', function () {
      c.dropIndexes();
      expect(c.getIndexes()).eql([]);
    });
  });

  describe('# drop()', function () {
    it('# empties the array in place and drops indexes', function () {
      var data = c.toArray();
      c.createIndex({ a: 1 });
      var ret = c.drop();
      expect(ret).eql(true);
      expect(c.countDocuments({})).eql(0);
      expect(data.length).eql(0);          // mutated in place (same array reference)
      expect(c.getIndexes()).eql([]);
    });
  });
});
