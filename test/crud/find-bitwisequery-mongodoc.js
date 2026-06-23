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


describe('#Bitwise Query Operators - mongo docs', function() {

  // https://www.mongodb.com/docs/manual/reference/operator/query/bitsAllSet/
  // Doc dataset; the BinData document (_id:4) is omitted — micromongo has no
  // BinData type. a:54 = 00110110, a:20 = 00010100.
  var collection = [
    { _id: 1, a: 54 },
    { _id: 2, a: 20 },
    { _id: 3, a: 20 },
  ];

  function ids(res) { return res.map(function (d) { return d._id; }); }

  describe('#$bitsAllSet', function () {
    it('# bit position array [1, 5]', function () {
      expect(ids(crud.find(collection, { a: { $bitsAllSet: [ 1, 5 ] } }))).eql([ 1 ]);
    });
    it('# integer bitmask 50', function () {
      expect(ids(crud.find(collection, { a: { $bitsAllSet: 50 } }))).eql([ 1 ]);
    });
  });

  describe('#$bitsAnySet', function () {
    it('# any of positions [1, 5] set', function () {
      expect(ids(crud.find(collection, { a: { $bitsAnySet: [ 1, 5 ] } }))).eql([ 1 ]);
    });
  });

  describe('#$bitsAllClear', function () {
    it('# all of positions [1, 5] clear', function () {
      expect(ids(crud.find(collection, { a: { $bitsAllClear: [ 1, 5 ] } }))).eql([ 2, 3 ]);
    });
  });

  describe('#$bitsAnyClear', function () {
    it('# any of positions [1, 2] clear', function () {
      expect(ids(crud.find(collection, { a: { $bitsAnyClear: [ 1, 2 ] } }))).eql([ 2, 3 ]);
    });
  });

});
