/**
 * distinct() — ported from the official MongoDB manual example.
 * Source: https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');


describe('# distinct() - mongo docs', function () {

  var inventory = [
    { _id: 1, dept: 'A', item: { sku: '111', color: 'red' }, sizes: [ 'S', 'M' ] },
    { _id: 2, dept: 'A', item: { sku: '111', color: 'blue' }, sizes: [ 'M', 'L' ] },
    { _id: 3, dept: 'B', item: { sku: '222', color: 'blue' }, sizes: 'S' },
    { _id: 4, dept: 'A', item: { sku: '333', color: 'black' }, sizes: [ 'S' ] },
  ];

  it('# distinct values of a simple field', function () {
    expect(mm.distinct(inventory, 'dept')).eql([ 'A', 'B' ]);
  });

  it('# array fields are flattened (each element is a distinct value)', function () {
    expect(mm.distinct(inventory, 'sizes')).eql([ 'S', 'M', 'L' ]);
  });

  it('# nested field with a query filter', function () {
    expect(mm.distinct(inventory, 'item.sku', { dept: 'A' })).eql([ '111', '333' ]);
  });

  it('# Collection.distinct delegates', function () {
    expect(new mm.Collection(inventory).distinct('dept')).eql([ 'A', 'B' ]);
  });

});
