'use strict';

/**
 * Driver-shaped write-result reports, ported from the official MongoDB docs.
 *
 *   insertOne  https://www.mongodb.com/docs/manual/reference/method/db.collection.insertOne/
 *   insertMany https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/
 *   deleteOne  https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteOne/
 *   deleteMany https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteMany/
 *
 * The documented results are:
 *   insertOne  -> { acknowledged: true, insertedId: <_id> }
 *   insertMany -> { acknowledged: true, insertedIds: { <index>: <_id>, … } }
 *   delete*    -> { acknowledged: true, deletedCount: <n> }
 *
 * micromongo additionally carries `insertedCount` on insertOne (a harmless
 * superset of the documented fields) and, unlike the server, does NOT
 * auto-generate `_id` — so `insertedId` is the supplied `_id`, or `undefined`.
 */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');

describe('# write-result reports (mongodoc-shaped)', function () {

  describe('# insertOne', function () {
    // Doc example: db.products.insertOne( { _id: 10, item: "box", qty: 20 } )
    //   => { acknowledged: true, insertedId: 10 }
    it('# returns { acknowledged, insertedId } using the supplied _id', function () {
      var products = [];
      var res = mm.insertOne(products, { _id: 10, item: 'box', qty: 20 });
      expect(res.acknowledged).eql(true);
      expect(res.insertedId).eql(10);
      expect(res.insertedCount).eql(1);
      expect(products).eql([ { _id: 10, item: 'box', qty: 20 } ]);
    });

    it('# insertedId is undefined when the document has no _id (micromongo does not auto-generate)', function () {
      var c = [];
      var res = mm.insertOne(c, { item: 'card' });
      expect(res).eql({ acknowledged: true, insertedId: undefined, insertedCount: 1 });
    });
  });

  describe('# insertMany', function () {
    // Doc example shape: { acknowledged: true, insertedIds: { '0': <id0>, '1': <id1>, … } }
    it('# returns { acknowledged, insertedCount, insertedIds } keyed by position', function () {
      var products = [];
      var res = mm.insertMany(products, [
        { _id: 11, item: 'pencil', qty: 50 },
        { _id: 12, item: 'pen', qty: 20 },
      ]);
      expect(res.acknowledged).eql(true);
      expect(res.insertedCount).eql(2);
      expect(res.insertedIds).eql({ 0: 11, 1: 12 });
    });
  });

  describe('# deleteOne / deleteMany', function () {
    // Doc example: { acknowledged: true, deletedCount: 1 }
    it('# deleteOne returns { acknowledged, deletedCount: 1 } on a match', function () {
      var orders = [ { _id: 1, status: 'D' }, { _id: 2, status: 'D' } ];
      expect(mm.deleteOne(orders, { status: 'D' })).eql({ acknowledged: true, deletedCount: 1 });
    });

    it('# deleteMany returns { acknowledged, deletedCount: <n> }', function () {
      var orders = [ { _id: 1, status: 'D' }, { _id: 2, status: 'A' }, { _id: 3, status: 'D' } ];
      expect(mm.deleteMany(orders, { status: 'D' })).eql({ acknowledged: true, deletedCount: 2 });
    });

    it('# deleteOne with no match returns deletedCount: 0', function () {
      var orders = [ { _id: 1, status: 'A' } ];
      expect(mm.deleteOne(orders, { status: 'Z' })).eql({ acknowledged: true, deletedCount: 0 });
    });
  });

});
