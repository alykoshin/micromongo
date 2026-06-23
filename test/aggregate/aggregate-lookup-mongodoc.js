/**
 * $lookup aggregation stage — ported from the official MongoDB manual example.
 * Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/
 *
 * Left outer equality join: for each input doc, collect foreign docs where
 * foreignField equals the input's localField (array localField matches each
 * element, no $unwind), into the `as` array. The foreign collection (`from`) is
 * resolved by name via the registry, or passed directly as a Collection/array.
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');


describe('# $lookup - mongo docs', function () {

  beforeEach(function () { mm._registry.reset(); });

  it('# joins orders to inventory by array localField (doc example)', function () {
    mm.collection('inventory', [
      { _id: 101, name: 'Widget', price: 10 },
      { _id: 102, name: 'Gadget', price: 20 },
      { _id: 103, name: 'Doohickey', price: 15 },
    ]);
    var orders = [
      { _id: 1, item_ids: [ 101, 102 ], customer: 'Alice' },
      { _id: 2, item_ids: [ 102, 103 ], customer: 'Bob' },
    ];

    var res = mm.aggregate(orders, [
      { $lookup: { from: 'inventory', localField: 'item_ids', foreignField: '_id', as: 'items' } },
    ]);

    expect(res).eql([
      { _id: 1, item_ids: [ 101, 102 ], customer: 'Alice', items: [
        { _id: 101, name: 'Widget', price: 10 },
        { _id: 102, name: 'Gadget', price: 20 },
      ] },
      { _id: 2, item_ids: [ 102, 103 ], customer: 'Bob', items: [
        { _id: 102, name: 'Gadget', price: 20 },
        { _id: 103, name: 'Doohickey', price: 15 },
      ] },
    ]);
  });

  it('# scalar localField', function () {
    mm.collection('cats', [ { _id: 'x', label: 'X' }, { _id: 'y', label: 'Y' } ]);
    var res = mm.aggregate([ { _id: 1, cat: 'x' } ],
      [ { $lookup: { from: 'cats', localField: 'cat', foreignField: '_id', as: 'c' } } ]);
    expect(res[0].c).eql([ { _id: 'x', label: 'X' } ]);
  });

  it('# `from` may be passed directly as an array', function () {
    var res = mm.aggregate([ { k: 1 } ], [ { $lookup: {
      from: [ { fk: 1, v: 'hit' }, { fk: 2 } ], localField: 'k', foreignField: 'fk', as: 'j',
    } } ]);
    expect(res[0].j).eql([ { fk: 1, v: 'hit' } ]);
  });

  it('# left outer join: no match yields an empty `as` array', function () {
    var res = mm.aggregate([ { k: 99 } ], [ { $lookup: {
      from: [ { fk: 1 } ], localField: 'k', foreignField: 'fk', as: 'j',
    } } ]);
    expect(res[0].j).eql([]);
  });

  it('# unknown named collection throws', function () {
    expect(function () {
      mm.aggregate([ { k: 1 } ], [ { $lookup: { from: 'nope', localField: 'k', foreignField: 'f', as: 'j' } } ]);
    }).throw(/unknown collection/);
  });
});
