/**
 * Collection equality indexes (Phase 8) + $indexStats.
 *
 * Indexes are an OPT-IN accelerator on a Collection. The linear scan stays the
 * universal correctness path — these tests assert the index returns IDENTICAL
 * results to a scan, stays consistent across writes (rebuild-after-write), and
 * that non-equality queries correctly fall back to scanning.
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../dist/');
var Collection = require('../dist/collection');

function ids(arr) { return arr.map(function (d) { return d._id; }).sort(); }


describe('# Collection indexes', function () {

  var data, c;
  beforeEach(function () {
    data = [
      { _id: 1, sku: 'a', qty: 10 },
      { _id: 2, sku: 'b', qty: 20 },
      { _id: 3, sku: 'a', qty: 30 },
      { _id: 4, sku: 'c', qty: 10 },
    ];
    c = new Collection(data);
    c.createIndex('sku');
  });

  describe('# create / list / drop', function () {
    it('# createIndex is chainable and idempotent', function () {
      expect(c.createIndex('sku')).equal(c);
      expect(c.getIndexes()).eql([ 'sku' ]);
    });
    it('# dropIndex', function () {
      expect(c.dropIndex('sku')).eql(true);
      expect(c.getIndexes()).eql([]);
      expect(c.dropIndex('sku')).eql(false);
    });
  });

  describe('# equality fast-path returns the same as a scan', function () {
    it('# { field: value }', function () {
      expect(ids(c.find({ sku: 'a' }).toArray())).eql([ 1, 3 ]);
    });
    it('# { field: { $eq: value } }', function () {
      expect(ids(c.find({ sku: { $eq: 'a' } }).toArray())).eql([ 1, 3 ]);
    });
    it('# findOne via index', function () {
      expect(c.findOne({ sku: 'b' })._id).eql(2);
    });
    it('# count via index', function () {
      expect(c.count({ sku: 'a' })).eql(2);
    });
    it('# no match returns empty', function () {
      expect(c.find({ sku: 'zzz' }).toArray()).eql([]);
      expect(c.findOne({ sku: 'zzz' })).eql(null);
    });
  });

  describe('# non-equality queries fall back to the linear scan', function () {
    it('# range query', function () {
      expect(c.find({ qty: { $gt: 15 } }).toArray()).length(2);
    });
    it('# multi-field query', function () {
      expect(ids(c.find({ sku: 'a', qty: 10 }).toArray())).eql([ 1 ]);
    });
  });

  describe('# index stays consistent across writes', function () {
    it('# insert', function () {
      c.insertOne({ _id: 5, sku: 'a', qty: 5 });
      expect(ids(c.find({ sku: 'a' }).toArray())).eql([ 1, 3, 5 ]);
    });
    it('# delete', function () {
      c.deleteOne({ _id: 1 });
      expect(ids(c.find({ sku: 'a' }).toArray())).eql([ 3 ]);
    });
    it('# update that CHANGES the indexed value moves the doc between buckets', function () {
      c.updateOne({ _id: 3 }, { $set: { sku: 'b' } });
      expect(ids(c.find({ sku: 'a' }).toArray())).eql([ 1 ]);
      expect(ids(c.find({ sku: 'b' }).toArray())).eql([ 2, 3 ]);
    });
    it('# replaceOne', function () {
      c.replaceOne({ _id: 1 }, { _id: 1, sku: 'z' });
      expect(ids(c.find({ sku: 'a' }).toArray())).eql([ 3 ]);
      expect(ids(c.find({ sku: 'z' }).toArray())).eql([ 1 ]);
    });
  });

  describe('# integration', function () {
    it('# indexed find still chains sort/skip/limit/project', function () {
      var cc = new Collection([ { k: 'x', n: 3 }, { k: 'x', n: 1 }, { k: 'x', n: 2 }, { k: 'y', n: 9 } ]);
      cc.createIndex('k');
      expect(cc.find({ k: 'x' }).sort({ n: -1 }).limit(2).toArray().map(function (d) { return d.n; }))
        .eql([ 3, 2 ]);
    });

    it('# index reads are deep-immutable', function () {
      var cc = new Collection([ { k: 'x', o: { v: 1 } } ]);
      cc.createIndex('k');
      var r = cc.find({ k: 'x' }).toArray();
      r[0].o.v = 999;
      expect(cc.toArray()[0].o.v).eql(1);
    });

    it('# non-indexed collections are unaffected (no index = pure scan)', function () {
      var plain = new Collection(data);
      expect(plain.getIndexes()).eql([]);
      expect(ids(plain.find({ sku: 'a' }).toArray())).eql([ 1, 3 ]);
    });
  });

  describe('# randomized scan-vs-index equivalence', function () {
    it('# index and scan agree for every key', function () {
      var arr = [];
      for (var i = 0; i < 200; ++i) { arr.push({ g: [ 'a', 'b', 'c', 'd' ][ i % 4 ], i: i }); }
      var indexed = new Collection(arr.map(function (d) { return { g: d.g, i: d.i }; }));
      indexed.createIndex('g');
      var scanned = new Collection(arr.map(function (d) { return { g: d.g, i: d.i }; }));
      [ 'a', 'b', 'c', 'd', 'missing' ].forEach(function (g) {
        var fromIndex = indexed.find({ g: g }).toArray().map(function (d) { return d.i; }).sort(function (a, b) { return a - b; });
        var fromScan = scanned.find({ g: g }).toArray().map(function (d) { return d.i; }).sort(function (a, b) { return a - b; });
        expect(fromIndex).eql(fromScan);
      });
    });
  });

  describe('# $indexStats', function () {
    it('# reports per-index usage via Collection.aggregate', function () {
      c.find({ sku: 'a' });
      c.find({ sku: 'b' });
      var r = c.aggregate([ { $indexStats: {} } ]);
      expect(r).length(1);
      expect(r[0].name).eql('sku_1');
      expect(r[0].key).eql({ sku: 1 });
      expect(r[0].accesses.ops).least(2);
    });

    it('# bare-array aggregate has no indexes → empty', function () {
      expect(mm.aggregate([ { a: 1 } ], [ { $indexStats: {} } ])).eql([]);
    });
  });

});
