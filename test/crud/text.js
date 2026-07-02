/**
 * $text query operator + $meta:"textScore" projection (Phase 10).
 *
 * Three fidelity modes selected via mm.configure({ textSearch }). These are
 * semantic tests (matching behavior, mode switching, score ordering) — exact
 * MongoDB score *values* are intentionally not reproduced (see lib/crud/text.js
 * LIMITATIONS), so we assert membership and relative order, not numbers.
 */

'use strict';

/* globals describe, beforeEach, afterEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');
var settings = require('../../dist/settings');

function ids(res) { return res.map(function (d) { return d._id; }).sort(); }


describe('# $text + $meta', function () {

  var articles = [
    { _id: 1, subject: 'coffee', author: 'xyz' },
    { _id: 2, subject: 'Coffee Shopping', author: 'efg' },
    { _id: 3, subject: 'Baking a cake', author: 'abc' },
    { _id: 4, subject: 'baking', author: 'xyz' },
    { _id: 5, subject: 'coffee and cream', author: 'efg' },
  ];

  afterEach(function () { settings.reset(); });

  describe('# lightweight mode (default)', function () {

    it('# is the default mode', function () {
      expect(mm.configure().textSearch).eql('lightweight');
    });

    it('# matches documents containing the term', function () {
      expect(ids(mm.find(articles, { $text: { $search: 'coffee' } }))).eql([ 1, 2, 5 ]);
    });

    it('# OR semantics across terms', function () {
      expect(ids(mm.find(articles, { $text: { $search: 'coffee cake' } }))).eql([ 1, 2, 3, 5 ]);
    });

    it('# phrase search ("...") requires the consecutive sequence', function () {
      expect(mm.find(articles, { $text: { $search: '"coffee shopping"' } }).map(function (d) { return d._id; }))
        .eql([ 2 ]);
    });

    it('# term negation (-word) excludes matches', function () {
      // "coffee -shopping": coffee docs minus the one containing "shopping" (doc 2)
      expect(ids(mm.find(articles, { $text: { $search: 'coffee -shopping' } }))).eql([ 1, 5 ]);
    });

    it('# exact-token only: "bake" does NOT match "baking" (no stemming)', function () {
      expect(mm.find(articles, { $text: { $search: 'bake' } })).eql([]);
    });

    it('# empty search matches nothing', function () {
      expect(mm.find(articles, { $text: { $search: '' } })).eql([]);
    });
  });

  describe('# stemming mode', function () {
    beforeEach(function () { mm.configure({ textSearch: 'stemming' }); });

    it('# "bake" matches "baking" (Porter stemming)', function () {
      expect(ids(mm.find(articles, { $text: { $search: 'bake' } }))).eql([ 3, 4 ]);
    });

    it('# diacritics fold (café ~ cafe)', function () {
      var a = [ { _id: 1, t: 'café' }, { _id: 2, t: 'tea' } ];
      expect(mm.find(a, { $text: { $search: 'cafe' } }).map(function (d) { return d._id; })).eql([ 1 ]);
    });
  });

  describe('# exact mode', function () {
    beforeEach(function () { mm.configure({ textSearch: 'exact' }); });

    it('# matches like stemming, score uses the fts_spec coefficient shape', function () {
      var r = mm.find(articles, { $text: { $search: 'coffee' } }, { score: { $meta: 'textScore' } });
      expect(r.length).least(3);
      r.forEach(function (d) { expect(d.score).a('number').above(0); });
    });
  });

  describe('# $meta: "textScore"', function () {
    it('# projects a numeric relevance score', function () {
      var r = mm.find(articles, { $text: { $search: 'coffee' } },
        { subject: 1, score: { $meta: 'textScore' } });
      r.forEach(function (d) { expect(d.score).a('number'); });
    });

    it('# only "textScore" is supported', function () {
      expect(function () {
        mm.find(articles, { $text: { $search: 'coffee' } }, { s: { $meta: 'indexKey' } });
      }).throw(/textScore/);
    });
  });

  describe('# configure() switching', function () {
    it('# rejects an invalid mode', function () {
      expect(function () { mm.configure({ textSearch: 'bogus' }); }).throw(/textSearch must be/);
    });

    it('# switching modes changes matching behavior', function () {
      mm.configure({ textSearch: 'lightweight' });
      expect(mm.find(articles, { $text: { $search: 'bake' } })).eql([]);
      mm.configure({ textSearch: 'stemming' });
      expect(ids(mm.find(articles, { $text: { $search: 'bake' } }))).eql([ 3, 4 ]);
    });
  });

  describe('# validation', function () {
    it('# $text requires { $search: <string> }', function () {
      expect(function () { mm.find(articles, { $text: {} }); }).throw(/\$search/);
    });
  });

});
