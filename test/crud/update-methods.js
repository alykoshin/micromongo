/**
 * Tests for the update / replace / findOneAnd* methods (Phase 4).
 * Return shapes follow the MongoDB driver: { acknowledged, matchedCount, modifiedCount }.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');


describe('# update methods', function () {

  describe('# updateOne', function () {
    it('# updates the first match, returns the driver report', function () {
      var a = [ { _id: 1, x: 1 }, { _id: 2, x: 1 } ];
      expect(mm.updateOne(a, { x: 1 }, { $set: { y: 9 } }))
        .eql({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
      expect(a[0]).eql({ _id: 1, x: 1, y: 9 });
      expect(a[1]).eql({ _id: 2, x: 1 }); // second untouched
    });

    it('# matched but unchanged => modifiedCount 0', function () {
      var a = [ { _id: 1, x: 5 } ];
      expect(mm.updateOne(a, { x: 5 }, { $set: { x: 5 } }))
        .eql({ acknowledged: true, matchedCount: 1, modifiedCount: 0 });
    });

    it('# no match => zero counts', function () {
      expect(mm.updateOne([ { x: 1 } ], { x: 99 }, { $set: { y: 1 } }))
        .eql({ acknowledged: true, matchedCount: 0, modifiedCount: 0 });
    });

    it('# rejects a replacement document', function () {
      expect(function () { mm.updateOne([ { x: 1 } ], { x: 1 }, { y: 2 }); })
        .throw(/requires an update document with operators/);
    });
  });

  describe('# updateMany', function () {
    it('# updates all matches', function () {
      var a = [ { x: 1 }, { x: 1 }, { x: 2 } ];
      expect(mm.updateMany(a, { x: 1 }, { $inc: { x: 10 } }))
        .eql({ acknowledged: true, matchedCount: 2, modifiedCount: 2 });
      expect(a).eql([ { x: 11 }, { x: 11 }, { x: 2 } ]);
    });
    it('# rejects a replacement document', function () {
      expect(function () { mm.updateMany([ { x: 1 } ], { x: 1 }, { y: 2 }); })
        .throw(/requires an update document with operators/);
    });
  });

  describe('# replaceOne', function () {
    it('# replaces the first match in place, preserving position', function () {
      var a = [ { _id: 1, x: 1 }, { _id: 2, x: 2 } ];
      expect(mm.replaceOne(a, { _id: 2 }, { _id: 2, y: 9 }))
        .eql({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
      expect(a).eql([ { _id: 1, x: 1 }, { _id: 2, y: 9 } ]);
    });

    it('# rejects an operator document', function () {
      expect(function () { mm.replaceOne([ { x: 1 } ], { x: 1 }, { $set: { y: 2 } }); })
        .throw(/without update operators/);
    });
  });

  describe('# findOneAnd* return the document before modification', function () {
    it('# findOneAndUpdate', function () {
      var a = [ { _id: 1, x: 1 } ];
      expect(mm.findOneAndUpdate(a, { _id: 1 }, { $set: { x: 9 } })).eql({ _id: 1, x: 1 });
      expect(a[0]).eql({ _id: 1, x: 9 });
    });

    it('# findOneAndReplace', function () {
      var a = [ { _id: 1, x: 1 } ];
      expect(mm.findOneAndReplace(a, { _id: 1 }, { _id: 1, y: 2 })).eql({ _id: 1, x: 1 });
      expect(a[0]).eql({ _id: 1, y: 2 });
    });

    it('# findOneAndDelete', function () {
      var a = [ { _id: 1 }, { _id: 2 } ];
      expect(mm.findOneAndDelete(a, { _id: 1 })).eql({ _id: 1 });
      expect(a).eql([ { _id: 2 } ]);
    });

    it('# return null when nothing matches', function () {
      expect(mm.findOneAndUpdate([ { x: 1 } ], { x: 9 }, { $set: { y: 1 } })).eql(null);
      expect(mm.findOneAndDelete([ { x: 1 } ], { x: 9 })).eql(null);
    });

    it('# findOneAndReplace rejects an operator document', function () {
      expect(function () { mm.findOneAndReplace([ { x: 1 } ], { x: 1 }, { $set: { y: 2 } }); })
        .throw(/without update operators/);
    });
  });

  describe('# Collection delegates updates', function () {
    it('# Collection.updateOne', function () {
      var c = new mm.Collection([ { _id: 1, n: 1 } ]);
      expect(c.updateOne({ _id: 1 }, { $inc: { n: 5 } }))
        .eql({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
      expect(c.toArray()[0]).eql({ _id: 1, n: 6 });
    });
  });

});
