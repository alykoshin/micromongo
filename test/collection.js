/**
 * Tests for the Collection wrapper (Phase 3).
 *
 * Collection is pure data encapsulation: every method must produce the same
 * result as the equivalent functional call, and must honor the mutation
 * contract (reads deep-immutable, writes mutate the owned array in place).
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../dist/');
var Collection = require('../dist/collection');


describe('# Collection', function () {

  describe('# construction', function () {

    it('# defaults to an empty array', function () {
      expect(new Collection().toArray()).eql([]);
    });

    it('# is exported from the package root', function () {
      expect(mm.Collection).equal(Collection);
    });

    it('# throws TypeError if given a non-array', function () {
      expect(function () { return new Collection(123); }).throw(TypeError);
    });

    it('# owns the array passed in (toArray returns the same reference)', function () {
      var data = [ { a: 1 } ];
      expect(new Collection(data).toArray()).equal(data);
    });

  });

  describe('# reads match the functional API', function () {

    var data;
    beforeEach(function () {
      data = [
        { _id: 1, item: 'abc', qty: 10 },
        { _id: 2, item: 'xyz', qty: 5 },
        { _id: 3, item: 'ijk', qty: 30 },
      ];
    });

    it('# count', function () {
      var c = new Collection(data);
      expect(c.count({ qty: { $gte: 10 } })).eql(mm.count(data, { qty: { $gte: 10 } }));
    });

    it('# find (with projection) — returns a Cursor; .toArray() matches mm.find', function () {
      var c = new Collection(data);
      expect(c.find({ qty: { $gt: 5 } }, { item: 1 }).toArray())
        .eql(mm.find(data, { qty: { $gt: 5 } }, { item: 1 }));
    });

    it('# findOne', function () {
      var c = new Collection(data);
      expect(c.findOne({ item: 'xyz' })).eql(mm.findOne(data, { item: 'xyz' }));
    });

    it('# aggregate', function () {
      var c = new Collection(data);
      var stages = [ { $match: { qty: { $gte: 10 } } }, { $sort: { qty: 1 } } ];
      expect(c.aggregate(stages)).eql(mm.aggregate(data, stages));
    });

  });

  describe('# mutation contract', function () {

    it('# reads are deep-immutable (mutating a result leaves the data untouched)', function () {
      var c = new Collection([ { a: { b: 1 } } ]);
      var out = c.find({}).toArray();
      out[0].a.b = 999;
      expect(c.toArray()[0].a.b).eql(1);
    });

    it('# insertOne mutates the owned array, returns { nInserted }', function () {
      var c = new Collection([]);
      expect(c.insertOne({ a: 1 })).eql({ nInserted: 1 });
      expect(c.toArray()).eql([ { a: 1 } ]);
    });

    it('# insertMany mutates and returns count', function () {
      var c = new Collection([]);
      expect(c.insertMany([ { a: 1 }, { a: 2 } ])).eql({ nInserted: 2 });
      expect(c.toArray().length).eql(2);
    });

    it('# deleteOne removes first match in place', function () {
      var c = new Collection([ { a: 1 }, { a: 2 }, { a: 1 } ]);
      expect(c.deleteOne({ a: 1 })).eql({ deletedCount: 1 });
      expect(c.toArray()).eql([ { a: 2 }, { a: 1 } ]);
    });

    it('# deleteMany removes all matches in place', function () {
      var c = new Collection([ { a: 1 }, { a: 2 }, { a: 1 } ]);
      expect(c.deleteMany({ a: 1 })).eql({ deletedCount: 2 });
      expect(c.toArray()).eql([ { a: 2 } ]);
    });

    it('# remove honors justOne', function () {
      var c = new Collection([ { a: 1 }, { a: 1 } ]);
      expect(c.remove({ a: 1 }, true)).eql({ nRemoved: 1 });
      expect(c.toArray().length).eql(1);
    });

  });

  describe('# independence', function () {

    it('# two collections over different arrays do not interfere', function () {
      var a = new Collection([ { x: 1 } ]);
      var b = new Collection([ { x: 2 } ]);
      a.insertOne({ x: 9 });
      expect(a.toArray().length).eql(2);
      expect(b.toArray().length).eql(1);
    });

  });

  describe('# delegates the full write/update surface', function () {
    // Parity with the functional API for the methods not covered above — each
    // delegation forwards to crud and mutates the owned array.

    it('# insert (dispatches to insertMany for an array)', function () {
      var c = new Collection([]);
      expect(c.insert([ { a: 1 }, { a: 2 } ])).eql({ nInserted: 2 });
      expect(c.toArray().length).eql(2);
    });

    it('# updateMany', function () {
      var c = new Collection([ { x: 1 }, { x: 1 }, { x: 2 } ]);
      expect(c.updateMany({ x: 1 }, { $inc: { x: 10 } }))
        .eql({ acknowledged: true, matchedCount: 2, modifiedCount: 2 });
      expect(c.toArray()).eql([ { x: 11 }, { x: 11 }, { x: 2 } ]);
    });

    it('# replaceOne', function () {
      var c = new Collection([ { _id: 1, x: 1 } ]);
      expect(c.replaceOne({ _id: 1 }, { _id: 1, y: 2 }))
        .eql({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
      expect(c.toArray()[0]).eql({ _id: 1, y: 2 });
    });

    it('# findOneAndUpdate returns the before-doc', function () {
      var c = new Collection([ { _id: 1, x: 1 } ]);
      expect(c.findOneAndUpdate({ _id: 1 }, { $set: { x: 9 } })).eql({ _id: 1, x: 1 });
      expect(c.toArray()[0]).eql({ _id: 1, x: 9 });
    });

    it('# findOneAndReplace returns the before-doc', function () {
      var c = new Collection([ { _id: 1, x: 1 } ]);
      expect(c.findOneAndReplace({ _id: 1 }, { _id: 1, y: 2 })).eql({ _id: 1, x: 1 });
      expect(c.toArray()[0]).eql({ _id: 1, y: 2 });
    });

    it('# findOneAndDelete returns and removes the doc', function () {
      var c = new Collection([ { _id: 1 }, { _id: 2 } ]);
      expect(c.findOneAndDelete({ _id: 1 })).eql({ _id: 1 });
      expect(c.toArray()).eql([ { _id: 2 } ]);
    });

  });

});
