'use strict';

/**
 * $rand — return a random float in [0, 1). Aggregation expression operator,
 * typically used inside $expr to sample documents.
 * Ported from the official MongoDB docs:
 *   https://www.mongodb.com/docs/manual/reference/operator/aggregation/rand/
 */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');
var evaluate = require('../../dist/aggregate/expression');

describe('# $rand (mongodoc)', function () {

  it('# { $rand: {} } returns a float in [0, 1)', function () {
    for (var i = 0; i < 1000; ++i) {
      var v = evaluate({ $rand: {} }, {});
      expect(typeof v).eql('number');
      expect(v).to.be.at.least(0);
      expect(v).to.be.below(1);
    }
  });

  it('# $rand re-evaluates (not a constant) — yields many distinct values', function () {
    var seen = {};
    for (var i = 0; i < 200; ++i) { seen[evaluate({ $rand: {} }, {})] = true; }
    // overwhelmingly likely >100 distinct values from 200 draws
    expect(Object.keys(seen).length).to.be.above(100);
  });

  it('# used via $expr to sample ~half the documents (doc pattern: { $lt: [0.5, {$rand:{}}] })', function () {
    // Mirrors the docs' { $match: { $expr: { $lt: [0.5, { $rand: {} } ] } } }.
    var voters = [];
    for (var i = 0; i < 2000; ++i) { voters.push({ _id: i, district: 3 }); }

    var picked = mm.find(voters, { $expr: { $lt: [ 0.5, { $rand: {} } ] } });

    // ~50% expected; allow a wide band so the test isn't flaky (P(outside) ~ 0).
    expect(picked.length).to.be.within(800, 1200);
    // each picked doc is a real voter
    picked.forEach(function (d) { expect(d.district).eql(3); });
  });

});
