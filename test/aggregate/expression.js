/**
 * Aggregation expression evaluator (lib/aggregate/expression.js) — unit tests.
 * These cover the engine internals (field refs, operators, $$vars); the
 * operators are exercised end-to-end via $group and computed $project too.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var evaluate = require('../../lib/aggregate/expression');


describe('# aggregation expressions', function () {

  var doc = {
    price: 10, qty: 3, first: 'Ada', last: 'Lovelace', score: 75,
    tags: [ 'a', 'b', 'c' ], nested: { total: 5 },
    items: [ { price: 2, qty: 5 }, { price: 3, qty: 2 } ],
  };

  it('# field references and literals', function () {
    expect(evaluate('$price', doc)).eql(10);
    expect(evaluate('$nested.total', doc)).eql(5);
    expect(evaluate(42, doc)).eql(42);
    expect(evaluate({ $literal: '$price' }, doc)).eql('$price');
  });

  it('# arithmetic', function () {
    expect(evaluate({ $multiply: [ '$price', '$qty' ] }, doc)).eql(30);
    expect(evaluate({ $add: [ 3, '$nested.total' ] }, doc)).eql(8);
    expect(evaluate({ $subtract: [ 10, 3 ] }, doc)).eql(7);
    expect(evaluate({ $divide: [ 10, 2 ] }, doc)).eql(5);
    expect(evaluate({ $mod: [ 10, 3 ] }, doc)).eql(1);
  });

  it('# string', function () {
    expect(evaluate({ $concat: [ '$first', ' ', '$last' ] }, doc)).eql('Ada Lovelace');
    expect(evaluate({ $toUpper: '$first' }, doc)).eql('ADA');
    expect(evaluate({ $toLower: '$last' }, doc)).eql('lovelace');
  });

  it('# comparison and conditional', function () {
    expect(evaluate({ $gte: [ '$score', 50 ] }, doc)).eql(true);
    expect(evaluate({ $cond: [ { $gte: [ '$score', 50 ] }, 'pass', 'fail' ] }, doc)).eql('pass');
    expect(evaluate({ $cond: { if: { $gt: [ '$qty', 100 ] }, then: 'H', else: 'L' } }, doc)).eql('L');
    expect(evaluate({ $ifNull: [ '$missing', '$first' ] }, doc)).eql('Ada');
    expect(evaluate({ $switch: { branches: [
      { case: { $lt: [ '$score', 60 ] }, then: 'F' },
      { case: { $lt: [ '$score', 80 ] }, then: 'C' },
    ], default: 'A' } }, doc)).eql('C');
  });

  it('# boolean', function () {
    expect(evaluate({ $and: [ { $gt: [ '$score', 50 ] }, { $lt: [ '$score', 100 ] } ] }, doc)).eql(true);
    expect(evaluate({ $or: [ false, { $eq: [ '$first', 'Ada' ] } ] }, doc)).eql(true);
    expect(evaluate({ $not: [ { $gt: [ '$score', 100 ] } ] }, doc)).eql(true);
  });

  it('# array operators', function () {
    expect(evaluate({ $size: '$tags' }, doc)).eql(3);
    expect(evaluate({ $arrayElemAt: [ '$tags', 0 ] }, doc)).eql('a');
    expect(evaluate({ $arrayElemAt: [ '$tags', -1 ] }, doc)).eql('c');
    expect(evaluate({ $in: [ 'b', '$tags' ] }, doc)).eql(true);
  });

  it('# $map and $filter with $$ variables', function () {
    expect(evaluate({ $map: { input: '$items', as: 'it',
      in: { $multiply: [ '$$it.price', '$$it.qty' ] } } }, doc)).eql([ 10, 6 ]);
    expect(evaluate({ $filter: { input: '$items', as: 'it',
      cond: { $gte: [ '$$it.qty', 3 ] } } }, doc)).eql([ { price: 2, qty: 5 } ]);
  });

  it('# deep nesting', function () {
    expect(evaluate({ $add: [ { $multiply: [ '$price', '$qty' ] }, '$nested.total' ] }, doc)).eql(35);
  });

  it('# unknown operator throws', function () {
    expect(function () { evaluate({ $frobnicate: 1 }, doc); }).throw(/Unsupported aggregation expression operator/);
  });

});
