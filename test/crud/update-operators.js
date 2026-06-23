/**
 * Tests for the update-operator engine (Phase 4) — lib/crud/update.js.
 * Semantics per https://www.mongodb.com/docs/manual/reference/operator/update-field/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var applyUpdate = require('../../lib/crud/update');


describe('# update operators', function () {

  describe('# $set', function () {
    it('# sets a new field', function () {
      var d = { a: 1 };
      expect(applyUpdate(d, { $set: { b: 2 } })).eql(true);
      expect(d).eql({ a: 1, b: 2 });
    });
    it('# overwrites an existing field', function () {
      var d = { a: 1 };
      applyUpdate(d, { $set: { a: 9 } });
      expect(d).eql({ a: 9 });
    });
    it('# returns false (no change) when value is identical', function () {
      expect(applyUpdate({ a: 1 }, { $set: { a: 1 } })).eql(false);
    });
    it('# sets via dotted path', function () {
      var d = { a: { b: 1 } };
      applyUpdate(d, { $set: { 'a.c': 2 } });
      expect(d).eql({ a: { b: 1, c: 2 } });
    });
  });

  describe('# $unset', function () {
    it('# removes a field', function () {
      var d = { a: 1, b: 2 };
      applyUpdate(d, { $unset: { b: '' } });
      expect(d).eql({ a: 1 });
    });
    it('# no-op (false) if field absent', function () {
      expect(applyUpdate({ a: 1 }, { $unset: { z: '' } })).eql(false);
    });
  });

  describe('# $inc', function () {
    it('# increments existing', function () {
      var d = { n: 5 };
      applyUpdate(d, { $inc: { n: 3 } });
      expect(d).eql({ n: 8 });
    });
    it('# creates field set to the increment when missing', function () {
      var d = {};
      applyUpdate(d, { $inc: { n: 5 } });
      expect(d).eql({ n: 5 });
    });
    it('# throws on non-numeric', function () {
      expect(function () { applyUpdate({}, { $inc: { n: 'x' } }); }).throw(TypeError);
    });
  });

  describe('# $mul', function () {
    it('# multiplies existing', function () {
      var d = { n: 4 };
      applyUpdate(d, { $mul: { n: 3 } });
      expect(d).eql({ n: 12 });
    });
    it('# sets to 0 when field missing', function () {
      var d = {};
      applyUpdate(d, { $mul: { n: 5 } });
      expect(d).eql({ n: 0 });
    });
  });

  describe('# $min / $max', function () {
    it('# $min writes only if strictly less', function () {
      var d = { n: 5 };
      expect(applyUpdate(d, { $min: { n: 8 } })).eql(false);
      expect(d).eql({ n: 5 });
      applyUpdate(d, { $min: { n: 2 } });
      expect(d).eql({ n: 2 });
    });
    it('# $min sets the value when field missing', function () {
      var d = {};
      applyUpdate(d, { $min: { n: 2 } });
      expect(d).eql({ n: 2 });
    });
    it('# $max writes only if strictly greater', function () {
      var d = { n: 5 };
      expect(applyUpdate(d, { $max: { n: 2 } })).eql(false);
      applyUpdate(d, { $max: { n: 9 } });
      expect(d).eql({ n: 9 });
    });
  });

  describe('# $rename', function () {
    it('# renames a field', function () {
      var d = { a: 1 };
      applyUpdate(d, { $rename: { a: 'b' } });
      expect(d).eql({ b: 1 });
    });
    it('# no-op (false) if source field absent', function () {
      expect(applyUpdate({ a: 1 }, { $rename: { x: 'y' } })).eql(false);
    });
  });

  describe('# $currentDate', function () {
    it('# true sets a Date', function () {
      var d = {};
      applyUpdate(d, { $currentDate: { t: true } });
      expect(d.t).instanceof(Date);
    });
    it('# { $type: "date" } sets a Date', function () {
      var d = {};
      applyUpdate(d, { $currentDate: { t: { $type: 'date' } } });
      expect(d.t).instanceof(Date);
    });
    it('# timestamp type is rejected', function () {
      expect(function () {
        applyUpdate({}, { $currentDate: { t: { $type: 'timestamp' } } });
      }).throw(Error);
    });
  });

  describe('# $setOnInsert', function () {
    it('# is a no-op on update', function () {
      expect(applyUpdate({ a: 1 }, { $setOnInsert: { b: 2 } })).eql(false);
    });
  });

  describe('# $push', function () {
    it('# creates the array if the field is missing', function () {
      var d = {};
      applyUpdate(d, { $push: { a: 1 } });
      expect(d).eql({ a: [ 1 ] });
    });
    it('# appends a bare value', function () {
      var d = { a: [ 1 ] };
      applyUpdate(d, { $push: { a: 2 } });
      expect(d).eql({ a: [ 1, 2 ] });
    });
    it('# $each appends multiple', function () {
      var d = { a: [ 1 ] };
      applyUpdate(d, { $push: { a: { $each: [ 2, 3 ] } } });
      expect(d).eql({ a: [ 1, 2, 3 ] });
    });
    it('# $position inserts at an index', function () {
      var d = { a: [ 1, 2, 3 ] };
      applyUpdate(d, { $push: { a: { $each: [ 9 ], $position: 0 } } });
      expect(d).eql({ a: [ 9, 1, 2, 3 ] });
    });
    it('# $slice positive keeps the first n', function () {
      var d = { a: [ 1, 2, 3 ] };
      applyUpdate(d, { $push: { a: { $each: [ 4, 5 ], $slice: 3 } } });
      expect(d).eql({ a: [ 1, 2, 3 ] });
    });
    it('# $slice negative keeps the last n', function () {
      var d = { a: [ 1, 2, 3 ] };
      applyUpdate(d, { $push: { a: { $each: [ 4, 5 ], $slice: -2 } } });
      expect(d).eql({ a: [ 4, 5 ] });
    });
    it('# $slice 0 empties the array', function () {
      var d = { a: [ 1, 2 ] };
      applyUpdate(d, { $push: { a: { $each: [ 3 ], $slice: 0 } } });
      expect(d).eql({ a: [] });
    });
    it('# $sort scalars ascending', function () {
      var d = { a: [ 3, 1, 2 ] };
      applyUpdate(d, { $push: { a: { $each: [], $sort: 1 } } });
      expect(d).eql({ a: [ 1, 2, 3 ] });
    });
    it('# $sort documents by field descending', function () {
      var d = { a: [ { s: 2 }, { s: 1 } ] };
      applyUpdate(d, { $push: { a: { $each: [ { s: 3 } ], $sort: { s: -1 } } } });
      expect(d).eql({ a: [ { s: 3 }, { s: 2 }, { s: 1 } ] });
    });
    it('# errors on a non-array field', function () {
      expect(function () { applyUpdate({ a: 5 }, { $push: { a: 1 } }); }).throw(TypeError);
    });
  });

  describe('# $addToSet', function () {
    it('# adds a new value', function () {
      var d = { a: [ 1, 2 ] };
      applyUpdate(d, { $addToSet: { a: 3 } });
      expect(d).eql({ a: [ 1, 2, 3 ] });
    });
    it('# no-op (false) on a duplicate', function () {
      expect(applyUpdate({ a: [ 1, 2 ] }, { $addToSet: { a: 2 } })).eql(false);
    });
    it('# deep-equals objects for dedup', function () {
      expect(applyUpdate({ a: [ { x: 1 } ] }, { $addToSet: { a: { x: 1 } } })).eql(false);
    });
    it('# $each dedups each candidate', function () {
      var d = { a: [ 1 ] };
      applyUpdate(d, { $addToSet: { a: { $each: [ 1, 2, 3 ] } } });
      expect(d).eql({ a: [ 1, 2, 3 ] });
    });
    it('# creates the array when missing', function () {
      var d = {};
      applyUpdate(d, { $addToSet: { a: 1 } });
      expect(d).eql({ a: [ 1 ] });
    });
  });

  describe('# $pop', function () {
    it('# 1 removes the last element', function () {
      var d = { a: [ 1, 2, 3 ] };
      applyUpdate(d, { $pop: { a: 1 } });
      expect(d).eql({ a: [ 1, 2 ] });
    });
    it('# -1 removes the first element', function () {
      var d = { a: [ 1, 2, 3 ] };
      applyUpdate(d, { $pop: { a: -1 } });
      expect(d).eql({ a: [ 2, 3 ] });
    });
    it('# no-op on missing or empty', function () {
      expect(applyUpdate({}, { $pop: { a: 1 } })).eql(false);
      expect(applyUpdate({ a: [] }, { $pop: { a: 1 } })).eql(false);
    });
    it('# rejects a direction other than 1/-1', function () {
      expect(function () { applyUpdate({ a: [ 1 ] }, { $pop: { a: 2 } }); }).throw(Error);
    });
  });

  describe('# $pull', function () {
    it('# removes all elements equal to a value', function () {
      var d = { a: [ 1, 2, 1, 3 ] };
      applyUpdate(d, { $pull: { a: 1 } });
      expect(d).eql({ a: [ 2, 3 ] });
    });
    it('# removes elements matching a condition (reuses the query engine)', function () {
      var d = { a: [ 1, 5, 8, 3 ] };
      applyUpdate(d, { $pull: { a: { $gt: 4 } } });
      expect(d).eql({ a: [ 1, 3 ] });
    });
    it('# removes objects by exact match', function () {
      var d = { a: [ { x: 1 }, { x: 2 } ] };
      applyUpdate(d, { $pull: { a: { x: 1 } } });
      expect(d).eql({ a: [ { x: 2 } ] });
    });
    it('# no-op (false) when nothing matches', function () {
      expect(applyUpdate({ a: [ 1, 2 ] }, { $pull: { a: 9 } })).eql(false);
    });
  });

  describe('# $pullAll', function () {
    it('# removes every listed value', function () {
      var d = { a: [ 1, 2, 3, 1, 2 ] };
      applyUpdate(d, { $pullAll: { a: [ 1, 2 ] } });
      expect(d).eql({ a: [ 3 ] });
    });
  });

  describe('# $bit (edge cases)', function () {
    it('# missing field is treated as 0', function () {
      var d = {};
      expect(applyUpdate(d, { $bit: { flags: { or: 5 } } })).eql(true);
      expect(d).eql({ flags: 5 }); // 0 | 5
    });
    it('# applies and/or/xor in order within one spec', function () {
      var d = { f: 12 };               // 1100
      applyUpdate(d, { $bit: { f: { and: 10, or: 1 } } }); // (1100 & 1010)=1000 ; |0001 =1001
      expect(d).eql({ f: 9 });
    });
    it('# no-op when the value is unchanged', function () {
      var d = { f: 8 };
      expect(applyUpdate(d, { $bit: { f: { and: 8 } } })).eql(false); // 8 & 8 = 8
    });
    it('# throws on a non-integer field', function () {
      expect(function () { applyUpdate({ f: 'x' }, { $bit: { f: { and: 1 } } }); })
        .throw(/integer field/);
    });
    it('# throws on an unsupported sub-operator', function () {
      expect(function () { applyUpdate({ f: 1 }, { $bit: { f: { not: 1 } } }); })
        .throw(/and, or, xor/);
    });
  });

  describe('# positional array paths (edge cases)', function () {
    it('# $[] on a missing array is a no-op (no path expands)', function () {
      var d = { _id: 1 };
      expect(applyUpdate(d, { $inc: { 'a.$[]': 1 } })).eql(false);
      expect(d).eql({ _id: 1 });
    });
    it('# $[<id>] with no matching elements changes nothing', function () {
      var d = { a: [ 1, 2, 3 ] };
      expect(applyUpdate(d, { $set: { 'a.$[x]': 9 } }, { arrayFilters: [ { x: { $gt: 100 } } ] }))
        .eql(false);
      expect(d).eql({ a: [ 1, 2, 3 ] });
    });
    it('# missing array filter for an identifier throws', function () {
      expect(function () {
        applyUpdate({ a: [ 1 ] }, { $set: { 'a.$[y]': 9 } }, { arrayFilters: [ { x: { $gt: 0 } } ] });
      }).throw(/array filter/);
    });
    it('# expandPositionalPaths resolves concrete indices', function () {
      var doc = { a: [ 10, 20, 30 ] };
      var paths = applyUpdate.expandPositionalPaths(doc, 'a.$[id].v',
        { id: { id: { $gte: 20 } } });
      // a[1] and a[2] match (>=20) — but they're scalars, so v paths still form:
      expect(paths).eql([ 'a.1.v', 'a.2.v' ]);
    });
  });

  describe('# upsert document builder', function () {
    it('# seeds equality fields from the query, skips operators', function () {
      var doc = applyUpdate.buildUpsertDoc({ a: 1, b: { $gt: 5 } }, { $set: { c: 3 } });
      expect(doc).eql({ a: 1, c: 3 }); // b ($gt) contributes nothing
    });
    it('# applies $setOnInsert on the built doc', function () {
      var doc = applyUpdate.buildUpsertDoc({ _id: 1 }, { $set: { x: 1 }, $setOnInsert: { y: 2 } });
      expect(doc).eql({ _id: 1, x: 1, y: 2 });
    });
    it('# replacement upsert fills query equality the replacement omits', function () {
      var doc = applyUpdate.buildUpsertDoc({ _id: 9 }, { name: 'z' });
      expect(doc).eql({ name: 'z', _id: 9 });
    });
  });

  describe('# multiple operators & validation', function () {
    it('# applies multiple operators in one spec', function () {
      var d = { a: 1 };
      applyUpdate(d, { $set: { b: 2 }, $inc: { a: 1 } });
      expect(d).eql({ a: 2, b: 2 });
    });
    it('# rejects mixing operators with plain fields', function () {
      expect(function () { applyUpdate({}, { $set: { a: 1 }, b: 2 }); }).throw(/mix/);
    });
    it('# rejects a replacement document (no operators)', function () {
      expect(function () { applyUpdate({}, { a: 1 }); }).throw(/replacement document/);
    });
    it('# rejects an unknown operator', function () {
      expect(function () { applyUpdate({}, { $frob: { a: 1 } }); }).throw(/Unknown update operator/);
    });
  });

});
