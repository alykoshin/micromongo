/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var crud = require('../../lib/crud/');


describe('# comparision operators - mongo docs', function() {


  describe('# $eq', function () {

    var array = [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] }
    ];

    it('# Equals a Specified Value', function () {
      var query = { qty: { $eq: 20 } };
      var res   = [
        { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
        { _id: 5, item: { name: 'mn', code: '000' }, qty:  20, tags: [ [ 'A', 'B' ], 'C' ] }
      ];
      expect(crud.find(array, query)).eql(res);
    });

    describe('# Field in Embedded Document Equals a Value', function () {
      it('# (1)', function () {
        var query = { "item.name": { $eq: "ab" } };
        var res   = [
          { _id: 1, item: { name: "ab", code: "123" }, qty: 15, tags: [ "A", "B", "C" ] }
        ];
        expect(crud.find(array, query)).eql(res);
      });

      it('# (2)', function () {
        var query = { "item.name": "ab" };
        var res   = [
          { _id: 1, item: { name: "ab", code: "123" }, qty: 15, tags: [ "A", "B", "C" ] }
        ];
        expect(crud.find(array, query)).eql(res);
      });
    });

    it('#Array Element Equals a Value');

    describe('#Equals an Array Value', function () {

      var res = [
        { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
        { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] }
      ];

      it('#with $eq', function () {
        var query1 = { tags: { $eq: [ 'A', 'B' ] } };
        expect(crud.find(array, query1)).eql(res);
      });

      it.skip('#without $eq (implicit $eq)', function () {
        var query2 = { tags: [ 'A', 'B' ] };
        expect(crud.find(array, query2)).eql(res);
      });

    });
  });

  describe('#', function() {
    var inventory;

    beforeEach(function(){

      inventory = [
        { qty: 10, carrier: { fee: 3 }, price: 3 },
        { qty: 20, carrier: { fee: 2 }, price: 2 },
        { qty: 30, carrier: { fee: 1 }, price: 1 },
      ];
    });

    describe('# $gt', function () {
      it('{ qty: { $gt: 20 } }', function () {
        var query = { qty: { $gt: 20 } };
        var res = [
          inventory[2],
        ];
        expect(crud.find(inventory, query)).eql(res);
      });
      it.skip('{ "carrier.fee": { $gt: 2 } }, { $set: { price: 9.99 } }', function () {
        var query = { "carrier.fee": { $gt: 2 } };
        var res = [
          inventory[0],
        ];
        expect(crud.find(inventory, query)).eql(res);
      });
    });

    describe('#$gte', function () {
      it('{ qty: { $gte: 20 } }', function () {
        var query = { qty: { $gte: 20 } };
        var res = [
          inventory[1],
          inventory[2],
        ];
        expect(crud.find(inventory, query)).eql(res);
      });
      it.skip('{ "carrier.fee": { $gte: 2 } }, { $set: { price: 9.99 } }', function () {
        var query = { "carrier.fee": { $gte: 2 } };
        var res = [
          inventory[0],
          inventory[1],
        ];
        expect(crud.find(inventory, query)).eql(res);

      });
    });

    describe('$lt', function () {
      it('{ qty: { $lt: 20 } }', function () {
        var query = { qty: { $lt: 20 } };
        var res   = [
          inventory[ 0 ],
        ];
        expect(crud.find(inventory, query)).eql(res);
      });
      it('{ "carrier.fee": { $lt: 20 } }, { $set: { price: 9.99 } }');
    });

    describe('#$lte', function () {
      it('{ qty: { $lte: 20 } }', function () {
        var query = { qty: { $lte: 20 } };
        var res   = [
          inventory[ 0 ],
          inventory[ 1 ],
        ];
        expect(crud.find(inventory, query)).eql(res);
      });
      it('{ "carrier.fee": { $lte: 5 } }, { $set: { price: 9.99 } }');
    });

    describe('#$ne', function () {
      it('{ qty: { $ne: 20 } }', function () {
        var query = { qty: { $ne: 20 } };
        var res   = [
          inventory[ 0 ],
          inventory[ 2 ],
        ];
        expect(crud.find(inventory, query)).eql(res);
      });
      it('{ "carrier.state": { $ne: "NY" } }, { $set: { qty: 20 } }');
    });

  });

  describe('#$in', function () {

    it('#Use the $in Operator to Match Values', function () {
      var array = [
        { qty:  0 },
        { qty:  5 },
        { qty: 10 },
        { qty: 15 },
        { qty: 20 },
      ];
      var query = { qty: { $in: [ 5, 15 ] } };
      var res = [
        { qty:  5 },
        { qty: 15 },
      ];
      expect(crud.find(array, query)).eql(res);
    });

    it('#Use the $in Operator to Match Values in an Array');

    it('#Use the $in Operator with a Regular Expression');

  });

  describe('#$nin', function () {

    it('{ qty: { $nin: [ 5, 15 ] } }', function () {
      var array = [
        { qty:  0 },
        { qty:  5 },
        { qty: 10 },
        { qty: 15 },
        { qty: 20 },
      ];
      var query = { qty: { $nin: [ 5, 15 ] } };
      var res = [
        { qty:  0 },
        { qty: 10 },
        { qty: 20 },
      ];
      expect(crud.find(array, query)).eql(res);
    });

    it('#{ tags: { $nin: [ "appliances", "school" ] } }');


  });

});
