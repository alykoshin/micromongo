/**
 * Aggregation pipeline stages — tests ported from the official MongoDB manual
 * examples (collection + pipeline + expected output), following the repo's
 * `-mongodoc.js` convention. Covers only the IMPLEMENTED stages.
 *
 * Sources:
 *   $sort:    https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/
 *   $unwind:  https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/
 *   $project: https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/
 *   $match:   https://www.mongodb.com/docs/manual/reference/operator/aggregation/match/
 *   $limit:   https://www.mongodb.com/docs/manual/reference/operator/aggregation/limit/
 *   $skip:    https://www.mongodb.com/docs/manual/reference/operator/aggregation/skip/
 *
 * NOTE on $limit / $skip: their doc pages show only pipeline syntax, no
 * before/after dataset. To assert a real result we apply them to the $sort
 * page's `restaurants` dataset after a deterministic `$sort`. The $limit/$skip
 * semantics ("first n" / "skip first n") are exactly as documented.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');


describe('# aggregation stages - mongo docs', function () {

  // From the $sort doc page.
  var restaurants = [
    { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
    { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
    { _id: 3, name: 'Empire State Pub', borough: 'Brooklyn' },
    { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
    { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
  ];

  describe('# $sort', function () {
    it('# Ascending/Descending Sort (borough, _id)', function () {
      var res = mm.aggregate(restaurants, [ { $sort: { borough: 1, _id: 1 } } ]);
      expect(res).eql([
        { _id: 3, name: 'Empire State Pub', borough: 'Brooklyn' },
        { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
        { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
        { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
        { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
      ]);
    });
  });

  describe('# $limit', function () {
    it('# passes the first n documents', function () {
      var res = mm.aggregate(restaurants, [ { $sort: { _id: 1 } }, { $limit: 2 } ]);
      expect(res.map(function (d) { return d._id; })).eql([ 1, 2 ]);
    });
  });

  describe('# $skip', function () {
    it('# skips the first n documents', function () {
      var res = mm.aggregate(restaurants, [ { $sort: { _id: 1 } }, { $skip: 3 } ]);
      expect(res.map(function (d) { return d._id; })).eql([ 4, 5 ]);
    });
  });

  describe('# $unwind', function () {
    it('# Unwind Array (top-level array of scalars)', function () {
      var a = [ { _id: 1, item: 'ABC1', sizes: [ 'S', 'M', 'L' ] } ];
      var res = mm.aggregate(a, [ { $unwind: '$sizes' } ]);
      expect(res).eql([
        { _id: 1, item: 'ABC1', sizes: 'S' },
        { _id: 1, item: 'ABC1', sizes: 'M' },
        { _id: 1, item: 'ABC1', sizes: 'L' },
      ]);
    });
  });

  describe('# $project', function () {
    var movie = {
      _id: 'X',
      title: 'The Great Train Robbery',
      rated: 'TV-G',
      plot: 'A group of bandits stage a brazen train hold-up...',
      genres: [ 'Short', 'Western' ],
      runtime: 11,
    };

    it('# Include Specific Fields', function () {
      var res = mm.aggregate([ movie ], [ { $project: { title: 1, rated: 1 } } ]);
      expect(res).eql([ { _id: 'X', title: 'The Great Train Robbery', rated: 'TV-G' } ]);
    });

    it('# Exclude the _id Field', function () {
      var res = mm.aggregate([ movie ], [ { $project: { _id: 0, title: 1, rated: 1 } } ]);
      expect(res).eql([ { title: 'The Great Train Robbery', rated: 'TV-G' } ]);
    });
  });

  describe('# $match', function () {
    // $match uses the same query syntax as find(). Equality + comparison example
    // adapted from the $match doc page ({ rated: "TV-PG", runtime: { $gt: 1000 } }).
    it('# Equality + comparison match', function () {
      var a = [
        { _id: 1, rated: 'TV-PG', runtime: 1256 },
        { _id: 2, rated: 'TV-PG', runtime: 500 },
        { _id: 3, rated: 'TV-G', runtime: 2000 },
      ];
      var res = mm.aggregate(a, [ { $match: { rated: 'TV-PG', runtime: { $gt: 1000 } } } ]);
      expect(res).eql([ { _id: 1, rated: 'TV-PG', runtime: 1256 } ]);
    });
  });

});
