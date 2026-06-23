/**
 * Computed $project and $addFields/$set — fields whose value is an aggregation
 * expression evaluated per document (Phase 6, on top of the expression engine).
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');


describe('# computed $project / $addFields', function () {

  describe('# $project computed fields', function () {
    it('# adds a computed field (inclusion mode implied)', function () {
      expect(mm.aggregate([ { _id: 1, price: 10, qty: 3 } ],
        [ { $project: { revenue: { $multiply: [ '$price', '$qty' ] } } } ]))
        .eql([ { _id: 1, revenue: 30 } ]);
    });

    it('# mixes plain inclusion with a computed field', function () {
      expect(mm.aggregate([ { _id: 1, name: 'x', price: 10, qty: 3 } ],
        [ { $project: { name: 1, revenue: { $multiply: [ '$price', '$qty' ] } } } ]))
        .eql([ { _id: 1, name: 'x', revenue: 30 } ]);
    });

    it('# _id: 0 with a computed field', function () {
      expect(mm.aggregate([ { _id: 1, price: 10, qty: 2 } ],
        [ { $project: { _id: 0, total: { $multiply: [ '$price', '$qty' ] } } } ]))
        .eql([ { total: 20 } ]);
    });

    it('# plain exclusion still works (no computed fields)', function () {
      expect(mm.aggregate([ { _id: 1, a: 1, b: 2 } ], [ { $project: { b: 0 } } ]))
        .eql([ { _id: 1, a: 1 } ]);
    });
  });

  describe('# $addFields / $set', function () {
    it('# $addFields adds a computed field, keeps existing', function () {
      expect(mm.aggregate([ { _id: 1, a: 2, b: 3 } ],
        [ { $addFields: { sum: { $add: [ '$a', '$b' ] } } } ]))
        .eql([ { _id: 1, a: 2, b: 3, sum: 5 } ]);
    });

    it('# $set is an alias for $addFields', function () {
      expect(mm.aggregate([ { _id: 1, x: 5 } ],
        [ { $set: { doubled: { $multiply: [ '$x', 2 ] } } } ]))
        .eql([ { _id: 1, x: 5, doubled: 10 } ]);
    });

    it('# overwrites an existing field', function () {
      expect(mm.aggregate([ { _id: 1, x: 5 } ],
        [ { $addFields: { x: { $add: [ '$x', 1 ] } } } ]))
        .eql([ { _id: 1, x: 6 } ]);
    });
  });

  describe('# full pipeline', function () {
    it('# $group then computed $project (average via $divide)', function () {
      var res = mm.aggregate([
        { cat: 'x', v: 10 }, { cat: 'x', v: 20 }, { cat: 'y', v: 5 },
      ], [
        { $group: { _id: '$cat', total: { $sum: '$v' }, n: { $sum: 1 } } },
        { $project: { _id: 1, total: 1, avg: { $divide: [ '$total', '$n' ] } } },
        { $sort: { _id: 1 } },
      ]);
      expect(res).eql([ { _id: 'x', total: 30, avg: 15 }, { _id: 'y', total: 5, avg: 5 } ]);
    });
  });

});
