/**
 * $sample aggregation stage.
 *
 * Returns `size` documents selected at random. Because the output is random,
 * these tests assert PROPERTIES (count, distinctness, membership, edge cases)
 * rather than an exact result — there is no deterministic doc example to port.
 * Semantics: https://www.mongodb.com/docs/manual/reference/operator/aggregation/sample/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');

var data = [ { _id: 1 }, { _id: 2 }, { _id: 3 }, { _id: 4 }, { _id: 5 } ];


describe('# $sample', function () {

  it('# returns exactly `size` documents', function () {
    expect(mm.aggregate(data, [ { $sample: { size: 3 } } ])).length(3);
  });

  it('# samples distinct documents, all drawn from the source', function () {
    var res = mm.aggregate(data, [ { $sample: { size: 4 } } ]);
    var ids = res.map(function (d) { return d._id; });
    expect(new Set(ids).size).eql(4); // distinct
    ids.forEach(function (id) {
      expect(data.some(function (d) { return d._id === id; })).eql(true);
    });
  });

  it('# size >= collection length returns all documents', function () {
    expect(mm.aggregate(data, [ { $sample: { size: 10 } } ])).length(5);
  });

  it('# size 0 returns an empty result', function () {
    expect(mm.aggregate(data, [ { $sample: { size: 0 } } ])).eql([]);
  });

  it('# does not mutate the source array', function () {
    var copy = data.slice();
    mm.aggregate(data, [ { $sample: { size: 3 } } ]);
    expect(data).eql(copy);
  });

  it('# rejects an invalid size parameter', function () {
    expect(function () { mm.aggregate(data, [ { $sample: {} } ]); }).throw(/requires/);
    expect(function () { mm.aggregate(data, [ { $sample: { size: -1 } } ]); }).throw(/requires/);
  });

  it('# over many single-draws, sampling covers multiple elements (randomness)', function () {
    var seen = {};
    for (var k = 0; k < 60; ++k) {
      mm.aggregate(data, [ { $sample: { size: 1 } } ]).forEach(function (d) { seen[d._id] = true; });
    }
    expect(Object.keys(seen).length).least(3);
  });

});
