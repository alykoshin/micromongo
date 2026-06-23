/**
 * Cursor (Phase 7) — chainable, lazy result handle returned by Collection.find().
 *
 * Cursor is an API-shape feature (not a MongoDB query operator), so these are
 * semantic tests rather than ported doc examples.
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../lib/');
var Collection = require('../lib/collection');
var Cursor = require('../lib/cursor');


describe('# Cursor', function () {

  var data, c;
  beforeEach(function () {
    data = [
      { _id: 1, age: 30, name: 'Ann' },
      { _id: 2, age: 25, name: 'Bob' },
      { _id: 3, age: 40, name: 'Cy' },
      { _id: 4, age: 25, name: 'Di' },
    ];
    c = new Collection(data);
  });

  it('# Collection.find returns a Cursor (not an array)', function () {
    expect(c.find({})).instanceof(Cursor);
    expect(mm.Cursor).equal(Cursor);
  });

  it('# .toArray() materializes and matches the functional mm.find', function () {
    expect(c.find({ age: { $gte: 25 } }).toArray())
      .eql(mm.find(data, { age: { $gte: 25 } }));
  });

  describe('# chaining', function () {
    it('# sort (desc) + skip + limit', function () {
      // ages 40, 30, 25, 25 ; skip 1 -> [30, 25, 25] ; limit 2 -> [30, 25]
      var r = c.find({}).sort({ age: -1 }).skip(1).limit(2).toArray();
      expect(r.map(function (d) { return d._id; })).eql([ 1, 2 ]);
    });

    it('# multi-key sort', function () {
      var r = c.find({}).sort({ age: 1, _id: -1 }).toArray();
      expect(r.map(function (d) { return d._id; })).eql([ 4, 2, 1, 3 ]);
    });

    it('# project via chain', function () {
      expect(c.find({ age: 25 }).project({ name: 1 }).toArray())
        .eql([ { _id: 2, name: 'Bob' }, { _id: 4, name: 'Di' } ]);
    });

    it('# projection via find(query, projection) second arg', function () {
      expect(c.find({ age: 25 }, { name: 1 }).toArray())
        .eql([ { _id: 2, name: 'Bob' }, { _id: 4, name: 'Di' } ]);
    });

    it('# methods return the cursor (chainable)', function () {
      var cur = c.find({});
      expect(cur.sort({ age: 1 })).equal(cur);
      expect(cur.skip(1)).equal(cur);
      expect(cur.limit(1)).equal(cur);
      expect(cur.project({ name: 1 })).equal(cur);
    });
  });

  describe('# deferred execution', function () {
    it('# no work happens until a terminal method', function () {
      var arr = [ { a: 1 } ];
      var cur = new Collection(arr).find({}); // built, not executed
      arr.push({ a: 2 });                      // mutate before terminal
      expect(cur.toArray().length).eql(2);     // sees the later-added doc
    });
  });

  describe('# terminals', function () {
    it('# count honors the visible result (skip/limit)', function () {
      expect(c.find({}).count()).eql(4);
      expect(c.find({}).limit(2).count()).eql(2);
    });

    it('# forEach', function () {
      var names = [];
      c.find({ age: 25 }).forEach(function (d) { names.push(d.name); });
      expect(names).eql([ 'Bob', 'Di' ]);
    });

    it('# map', function () {
      expect(c.find({ age: 25 }).map(function (d) { return d.name; })).eql([ 'Bob', 'Di' ]);
    });

    it('# hasNext / next iteration', function () {
      var cur = c.find({ age: 25 });
      var out = [];
      while (cur.hasNext()) { out.push(cur.next().name); }
      expect(out).eql([ 'Bob', 'Di' ]);
      expect(cur.next()).eql(null);
    });
  });

  describe('# mutation contract', function () {
    it('# reads are deep-immutable (result is independent of the source)', function () {
      var arr = [ { a: { b: 1 } } ];
      var r = new Collection(arr).find({}).toArray();
      r[0].a.b = 999;
      expect(arr[0].a.b).eql(1);
    });

    it('# does not mutate the source array', function () {
      var copy = data.slice();
      c.find({}).sort({ age: -1 }).limit(2).toArray();
      expect(data).eql(copy);
    });
  });

  describe('# validation', function () {
    it('# skip/limit reject negatives', function () {
      expect(function () { c.find({}).skip(-1); }).throw(TypeError);
      expect(function () { c.find({}).limit(-1); }).throw(TypeError);
    });
  });

});
