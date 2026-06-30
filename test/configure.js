/**
 * Tests for mm.configure() — global default settings (Phase 1).
 */

'use strict';

/* globals describe, before, beforeEach, afterEach, after, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../dist/');
var settings = require('../dist/settings');


describe('# configure()', function () {

  afterEach(function () {
    settings.reset(); // never leak settings between tests
  });

  describe('# read / write', function () {

    var DEFAULTS = { idProjectionMongo: true, whereTimeout: 1000, textSearch: 'lightweight', autoId: false };

    it('# returns current settings (defaults) when called with no args', function () {
      expect(mm.configure()).eql(DEFAULTS);
    });

    it('# merges provided keys and returns the updated settings', function () {
      var res = mm.configure({ idProjectionMongo: false });
      expect(res).eql({ idProjectionMongo: false, whereTimeout: 1000, textSearch: 'lightweight', autoId: false });
      expect(mm.configure()).eql({ idProjectionMongo: false, whereTimeout: 1000, textSearch: 'lightweight', autoId: false });
    });

    it('# ignores unknown keys', function () {
      mm.configure({ nope: 123 });
      expect(mm.configure()).eql(DEFAULTS);
    });

    it('# coerces idProjectionMongo to boolean', function () {
      mm.configure({ idProjectionMongo: 0 });
      expect(mm.configure().idProjectionMongo).eql(false);
    });

    it('# reset() restores defaults', function () {
      mm.configure({ idProjectionMongo: false, whereTimeout: 50 });
      settings.reset();
      expect(mm.configure()).eql(DEFAULTS);
    });

  });

  describe('# idProjectionMongo affects projection', function () {

    var a = [ { _id: 1, name: 'x', age: 5 } ];

    it('# default (true): _id auto-included in inclusion projection', function () {
      expect(mm.find(a, {}, { name: 1 })).eql([ { _id: 1, name: 'x' } ]);
    });

    it('# false: _id treated as a normal field (not auto-included)', function () {
      mm.configure({ idProjectionMongo: false });
      expect(mm.find(a, {}, { name: 1 })).eql([ { name: 'x' } ]);
    });

    it('# false: _id can still be explicitly included', function () {
      mm.configure({ idProjectionMongo: false });
      expect(mm.find(a, {}, { _id: 1, name: 1 })).eql([ { _id: 1, name: 'x' } ]);
    });

  });

  describe('# whereTimeout is read at use', function () {

    it('# $where still evaluates with a custom timeout set', function () {
      mm.configure({ whereTimeout: 2000 });
      expect(mm.find([ { a: 5 }, { a: 1 } ], { $where: 'this.a > 2' })).eql([ { a: 5 } ]);
    });

  });

  describe('# autoId controls _id generation on insert / upsert', function () {

    it('# coerces autoId to boolean', function () {
      mm.configure({ autoId: 1 });
      expect(mm.configure().autoId).eql(true);
    });

    it('# default (off): insertOne leaves a doc without _id untouched, insertedId undefined', function () {
      var arr = [];
      var res = mm.insertOne(arr, { a: 1 });
      expect(res.insertedId).eql(undefined);
      expect(arr[0]).eql({ a: 1 });               // no _id stamped
    });

    it('# on: insertOne generates an _id when the doc has none', function () {
      mm.configure({ autoId: true });
      var arr = [];
      var res = mm.insertOne(arr, { a: 1 });
      expect(res.insertedId).to.be.a('string');   // generated token
      expect(arr[0]._id).eql(res.insertedId);     // stamped onto the stored doc
      expect(arr[0].a).eql(1);
    });

    it('# on: an explicit _id is preserved (never overwritten)', function () {
      mm.configure({ autoId: true });
      var arr = [];
      var res = mm.insertOne(arr, { _id: 42, a: 1 });
      expect(res.insertedId).eql(42);
      expect(arr[0]._id).eql(42);
    });

    it('# insertMany / insert inherit the setting (route through insertOne)', function () {
      mm.configure({ autoId: true });
      var arr = [];
      var res = mm.insertMany(arr, [ { a: 1 }, { _id: 7, a: 2 } ]);
      expect(arr[0]._id).to.be.a('string');       // generated
      expect(arr[1]._id).eql(7);                   // explicit kept
      expect(res.insertedIds[0]).eql(arr[0]._id);
      expect(res.insertedIds[1]).eql(7);
    });

    it('# bulkWrite insertOne inherits the setting', function () {
      mm.configure({ autoId: true });
      var arr = [];
      var res = mm.bulkWrite(arr, [ { insertOne: { document: { a: 1 } } } ]);
      expect(arr[0]._id).to.be.a('string');
      expect(res.insertedIds[0]).eql(arr[0]._id);
    });

    it('# upsert follows the same agreement: off ⇒ no _id, on ⇒ generated', function () {
      // off (default): upsert inserts without an _id
      var arr = [];
      var off = mm.updateOne(arr, { a: 1 }, { $set: { b: 2 } }, { upsert: true });
      expect(off.upsertedCount).eql(1);
      expect(off.upsertedId).eql(undefined);
      expect(arr[0]).eql({ a: 1, b: 2 });

      // on: upsert generates an _id
      mm.configure({ autoId: true });
      var arr2 = [];
      var on = mm.updateOne(arr2, { a: 1 }, { $set: { b: 2 } }, { upsert: true });
      expect(on.upsertedId).to.be.a('string');
      expect(arr2[0]._id).eql(on.upsertedId);
    });

    it('# upsert still honors an _id supplied via the query', function () {
      var arr = [];
      var res = mm.updateOne(arr, { _id: 99 }, { $set: { b: 2 } }, { upsert: true });
      expect(res.upsertedId).eql(99);             // query _id wins regardless of autoId
      expect(arr[0]._id).eql(99);
    });

  });

});
