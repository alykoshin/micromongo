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

var mm = require('../lib/');
var Collection = require('../lib/collection');


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

    it('# find (with projection)', function () {
      var c = new Collection(data);
      expect(c.find({ qty: { $gt: 5 } }, { item: 1 }))
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
      var out = c.find({});
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

});
