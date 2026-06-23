/**
 * Ordered / multikey / compound indexes + the query planner (Phases 12–15).
 *
 * One ordered structure backs every index TYPE (single-field, multikey, compound),
 * mirroring MongoDB. These are a micromongo-specific performance concept → plain
 * unit tests (exempt from the -mongodoc rule). The contract under test is the same
 * as Phase 8: an index must return the SAME docs as a linear scan — it only changes
 * speed, never results. Each block compares the indexed Collection against a plain
 * (unindexed) one.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var Collection = require('../lib/collection');

function ids(arr) { return arr.map(function (d) { return d._id; }).sort(function (a, b) { return a - b; }); }

// Assert the indexed and scanned Collections agree for `query` (+ optional sort).
function sameAsScan(data, indexSpec, query, sort) {
  var indexed = new Collection(data.map(function (d) { return JSON.parse(JSON.stringify(d)); }));
  indexed.createIndex(indexSpec);
  var scan = new Collection(data.map(function (d) { return JSON.parse(JSON.stringify(d)); }));
  var ci = indexed.find(query); if (sort) { ci = ci.sort(sort); }
  var cs = scan.find(query); if (sort) { cs = cs.sort(sort); }
  return { indexed: ci.toArray(), scan: cs.toArray() };
}


describe('# Ordered indexes (Phase 12) — range + sort', function () {

  var data = [
    { _id: 1, age: 30 }, { _id: 2, age: 10 }, { _id: 3, age: 20 },
    { _id: 4, age: 40 }, { _id: 5, age: 20 },
  ];

  it('# $gt range equals a scan', function () {
    var r = sameAsScan(data, 'age', { age: { $gt: 20 } });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 4 ]);
  });

  it('# bounded range $gte/$lt equals a scan', function () {
    var r = sameAsScan(data, 'age', { age: { $gte: 20, $lt: 40 } });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 3, 5 ]);
  });

  it('# $lte equals a scan', function () {
    var r = sameAsScan(data, 'age', { age: { $lte: 20 } });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 2, 3, 5 ]);
  });

  it('# equality still served (subsumes the hash index)', function () {
    var r = sameAsScan(data, 'age', { age: 20 });
    expect(ids(r.indexed)).eql([ 3, 5 ]);
  });

  it('# sort ascending is served by the index in index order', function () {
    var r = sameAsScan(data, 'age', {}, { age: 1 });
    expect(r.indexed.map(function (d) { return d.age; })).eql([ 10, 20, 20, 30, 40 ]);
    expect(r.indexed.map(function (d) { return d.age; })).eql(r.scan.map(function (d) { return d.age; }));
  });

  it('# sort descending equals a scan sort', function () {
    var r = sameAsScan(data, 'age', {}, { age: -1 });
    expect(r.indexed.map(function (d) { return d.age; })).eql([ 40, 30, 20, 20, 10 ]);
  });

  it('# range result still chains sort/limit', function () {
    var c = new Collection(data.map(function (d) { return { _id: d._id, age: d.age }; }));
    c.createIndex('age');
    expect(c.find({ age: { $gte: 20 } }).sort({ age: 1 }).limit(2).toArray().map(function (d) { return d.age; }))
      .eql([ 20, 20 ]);
  });

  it('# range stays consistent after a value-changing update', function () {
    var c = new Collection([ { _id: 1, age: 10 }, { _id: 2, age: 50 } ]);
    c.createIndex('age');
    c.updateOne({ _id: 1 }, { $set: { age: 99 } });
    // doc 1 moved 10 -> 99; doc 2 is 50. Only 99 is > 60.
    expect(ids(c.find({ age: { $gt: 60 } }).toArray())).eql([ 1 ]);
    // and the index reflects the new value for a tighter bound too
    expect(ids(c.find({ age: { $gte: 50 } }).toArray())).eql([ 1, 2 ]);
  });
});


describe('# Multikey indexes (Phase 13) — array fields', function () {

  var data = [
    { _id: 1, tags: [ 'a', 'b' ] },
    { _id: 2, tags: [ 'b', 'c' ] },
    { _id: 3, tags: [ 'a' ] },
    { _id: 4, tags: [] },
  ];

  it('# equality on an array field matches if any element equals (== scan)', function () {
    var r = sameAsScan(data, 'tags', { tags: 'a' });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 3 ]);
  });

  it('# $in on an array field equals a scan', function () {
    var r = sameAsScan(data, 'tags', { tags: { $in: [ 'c', 'a' ] } });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 2, 3 ]);
  });

  it('# a doc appearing under multiple keys is returned once (dedup)', function () {
    var c = new Collection([ { _id: 1, tags: [ 'x', 'x', 'y' ] } ]);
    c.createIndex('tags');
    expect(c.find({ tags: 'x' }).toArray()).length(1);
  });

  it('# the index is flagged multiKey', function () {
    var c = new Collection(data.map(function (d) { return { _id: d._id, tags: d.tags.slice() }; }));
    c.createIndex('tags');
    expect(c._indexes.tags.multiKey).eql(true);
  });

  it('# numeric array range equals a scan', function () {
    var nums = [ { _id: 1, v: [ 1, 5 ] }, { _id: 2, v: [ 9 ] }, { _id: 3, v: [ 2, 3 ] } ];
    var r = sameAsScan(nums, 'v', { v: { $gte: 5 } });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 2 ]);
  });
});


describe('# Compound indexes (Phase 14) — multi-field, prefix', function () {

  var data = [
    { _id: 1, a: 1, b: 'x' }, { _id: 2, a: 1, b: 'y' },
    { _id: 3, a: 2, b: 'x' }, { _id: 4, a: 1, b: 'x' },
  ];

  it('# full compound equality equals a scan', function () {
    var r = sameAsScan(data, { a: 1, b: 1 }, { a: 1, b: 'x' });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 4 ]);
  });

  it('# leading-prefix equality (a only) equals a scan', function () {
    var r = sameAsScan(data, { a: 1, b: 1 }, { a: 1 });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 2, 4 ]);
  });

  it('# non-prefix field alone is NOT served by the compound index but still scans correctly', function () {
    var r = sameAsScan(data, { a: 1, b: 1 }, { b: 'x' });
    expect(ids(r.indexed)).eql(ids(r.scan)).eql([ 1, 3, 4 ]);
  });

  it('# index name is MongoDB-style (a_1_b_1)', function () {
    var c = new Collection(data.map(function (d) { return { _id: d._id, a: d.a, b: d.b }; }));
    c.createIndex({ a: 1, b: 1 });
    expect(c.indexStats()[0].name).eql('a_1_b_1');
    expect(c.indexStats()[0].key).eql({ a: 1, b: 1 });
  });

  it('# dropIndex by spec', function () {
    var c = new Collection([]);
    c.createIndex({ a: 1, b: 1 });
    expect(c.dropIndex({ a: 1, b: 1 })).eql(true);
    expect(c.getIndexes()).eql([]);
  });
});


describe('# Query planner (Phase 15)', function () {

  it('# $or with every branch indexed = union, equals a scan', function () {
    var data = [ { _id: 1, x: 1, y: 9 }, { _id: 2, x: 2, y: 9 }, { _id: 3, x: 3, y: 5 }, { _id: 4, x: 9, y: 5 } ];
    var indexed = new Collection(data.map(function (d) { return { _id: d._id, x: d.x, y: d.y }; }));
    indexed.createIndex('x'); indexed.createIndex('y');
    var scan = new Collection(data.map(function (d) { return { _id: d._id, x: d.x, y: d.y }; }));
    var q = { $or: [ { x: 1 }, { y: 5 } ] };
    expect(ids(indexed.find(q).toArray())).eql(ids(scan.find(q).toArray())).eql([ 1, 3, 4 ]);
  });

  it('# multi-field equality uses a single-field index then re-filters (== scan)', function () {
    var data = [ { _id: 1, a: 1, b: 5 }, { _id: 2, a: 1, b: 6 }, { _id: 3, a: 2, b: 5 } ];
    var indexed = new Collection(data.map(function (d) { return { _id: d._id, a: d.a, b: d.b }; }));
    indexed.createIndex('a'); // only `a` indexed
    var q = { a: 1, b: 5 };
    expect(ids(indexed.find(q).toArray())).eql([ 1 ]);
  });

  it('# unindexable operators ($regex/$ne/$exists) fall back to a scan, correct results', function () {
    var data = [ { _id: 1, s: 'apple' }, { _id: 2, s: 'banana' }, { _id: 3, s: 'apricot' } ];
    var c = new Collection(data.map(function (d) { return { _id: d._id, s: d.s }; }));
    c.createIndex('s');
    expect(ids(c.find({ s: { $regex: /^ap/ } }).toArray())).eql([ 1, 3 ]);
    expect(c._planQuery({ s: { $regex: /^ap/ } })).eql(null); // planner declines → scan
  });

  it('# count() goes through the planner and matches a scan', function () {
    var c = new Collection([ { _id: 1, n: 1 }, { _id: 2, n: 5 }, { _id: 3, n: 9 } ]);
    c.createIndex('n');
    expect(c.count({ n: { $gte: 5 } })).eql(2);
    expect(c.count({ n: 1 })).eql(1);
  });

  it('# findOne() goes through the planner', function () {
    var c = new Collection([ { _id: 1, n: 1 }, { _id: 2, n: 5 } ]);
    c.createIndex('n');
    expect(c.findOne({ n: { $gte: 4 } })._id).eql(2);
    expect(c.findOne({ n: 99 })).eql(null);
  });
});


describe('# hash-for-equality fast-path', function () {

  it('# single-field index carries a value hash; equality results unchanged', function () {
    var c = new Collection([ { _id: 1, k: 'a' }, { _id: 2, k: 'b' }, { _id: 3, k: 'a' } ]);
    c.createIndex('k');
    expect(c._indexes.k.hash).to.be.an.instanceof(Map);
    expect(ids(c.find({ k: 'a' }).toArray())).eql([ 1, 3 ]);
    expect(c.findOne({ k: 'b' })._id).eql(2);
    expect(c.find({ k: 'missing' }).toArray()).eql([]);
  });

  it('# multikey hash dedups a doc whose array has repeated values', function () {
    var c = new Collection([ { _id: 1, tags: [ 'x', 'x', 'y' ] }, { _id: 2, tags: [ 'y' ] } ]);
    c.createIndex('tags');
    expect(ids(c.find({ tags: 'x' }).toArray())).eql([ 1 ]);
    expect(ids(c.find({ tags: 'y' }).toArray())).eql([ 1, 2 ]);
  });

  it('# compound index has NO hash (tuple keys); equality still correct via range', function () {
    var c = new Collection([ { _id: 1, a: 1, b: 2 }, { _id: 2, a: 1, b: 3 } ]);
    c.createIndex({ a: 1, b: 1 });
    expect(c._indexes.a_b.hash).eql(null);
    expect(ids(c.find({ a: 1, b: 2 }).toArray())).eql([ 1 ]);
  });

  it('# hash stays consistent across writes (rebuilt with the entries)', function () {
    var c = new Collection([ { _id: 1, k: 'a' } ]);
    c.createIndex('k');
    c.insertOne({ _id: 2, k: 'a' });
    c.updateOne({ _id: 1 }, { $set: { k: 'b' } });
    expect(ids(c.find({ k: 'a' }).toArray())).eql([ 2 ]);
    expect(ids(c.find({ k: 'b' }).toArray())).eql([ 1 ]);
  });
});


describe('# explain()', function () {

  function fresh() {
    var coll = new Collection([
      { _id: 1, a: 1, b: 'x', age: 30 },
      { _id: 2, a: 2, b: 'y', age: 10 },
      { _id: 3, a: 1, b: 'x', age: 20 },
    ]);
    coll.createIndex('a'); coll.createIndex('age'); coll.createIndex({ a: 1, b: 1 });
    return coll;
  }

  it('# equality → IXSCAN, exact, names the index, uses the hash', function () {
    var e = fresh().find({ a: 1 }).explain();
    expect(e.stage).eql('IXSCAN');
    expect(e.indexed).eql(true);
    expect(e.exact).eql(true);
    expect(e.plan.index).eql('a_1');
    expect(e.plan.usedHash).eql(true);
    expect(e.candidates).eql(2);
    expect(e.totalDocs).eql(3);
  });

  it('# range → IXSCAN with op range and bounds', function () {
    var e = fresh().find({ age: { $gt: 15 } }).explain();
    expect(e.stage).eql('IXSCAN');
    expect(e.plan.op).eql('range');
    expect(e.plan.bounds).eql([ 'gt' ]);
  });

  it('# compound prefix → IXSCAN+FILTER (inexact, re-filtered)', function () {
    var e = fresh().find({ a: 1, b: 'x' }).explain();
    expect(e.stage).eql('IXSCAN+FILTER');
    expect(e.exact).eql(false);
    expect(e.plan.index).eql('a_1_b_1');
    expect(e.plan.op).eql('compound-prefix');
  });

  it('# $or → OR stage listing each branch plan', function () {
    var coll = new Collection([ { _id: 1, a: 1 }, { _id: 2, a: 9 } ]);
    coll.createIndex('a');
    var e = coll.find({ $or: [ { a: 1 }, { a: 9 } ] }).explain();
    expect(e.indexed).eql(true);
    expect(e.plan.stage).eql('OR');
    expect(e.plan.branches).length(2);
  });

  it('# unindexable operator → COLLSCAN', function () {
    var e = fresh().find({ b: { $regex: /x/ } }).explain();
    expect(e.stage).eql('COLLSCAN');
    expect(e.indexed).eql(false);
  });

  it('# no index at all → COLLSCAN', function () {
    var e = new Collection([ { x: 1 } ]).find({ x: 1 }).explain();
    expect(e.stage).eql('COLLSCAN');
  });

  it('# sortFromIndex true when an index serves the sort order', function () {
    var e = fresh().find({}).sort({ age: 1 }).explain();
    expect(e.sortFromIndex).eql(true);
    expect(e.sort).eql({ age: 1 });
  });

  it('# explain() does not consume the cursor (still runnable)', function () {
    var cur = fresh().find({ a: 1 });
    cur.explain();
    expect(ids(cur.toArray())).eql([ 1, 3 ]);
  });
});


describe('# randomized scan-vs-index equivalence (ordered/range/multikey)', function () {

  it('# agree across equality, ranges, $in, and array fields', function () {
    var arr = [];
    for (var i = 0; i < 300; ++i) {
      arr.push({ _id: i, n: (i * 7) % 50, tags: [ 'a', 'b', 'c', 'd' ][ i % 4 ] === 'a' ? [ 'a', 'x' ] : [ [ 'a', 'b', 'c', 'd' ][ i % 4 ] ] });
    }
    var indexedN = new Collection(arr.map(function (d) { return JSON.parse(JSON.stringify(d)); }));
    indexedN.createIndex('n');
    var indexedT = new Collection(arr.map(function (d) { return JSON.parse(JSON.stringify(d)); }));
    indexedT.createIndex('tags');
    var scan = new Collection(arr.map(function (d) { return JSON.parse(JSON.stringify(d)); }));

    var queries = [
      { n: 0 }, { n: { $gt: 25 } }, { n: { $gte: 10, $lt: 40 } }, { n: { $lte: 5 } },
      { n: { $in: [ 0, 7, 14 ] } },
    ];
    queries.forEach(function (q) {
      expect(ids(indexedN.find(q).toArray())).eql(ids(scan.find(q).toArray()));
    });
    [ { tags: 'a' }, { tags: 'b' }, { tags: { $in: [ 'a', 'd' ] } } ].forEach(function (q) {
      expect(ids(indexedT.find(q).toArray())).eql(ids(scan.find(q).toArray()));
    });
  });
});
