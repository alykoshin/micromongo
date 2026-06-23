/**
 * Reshaping aggregation stages — $unset, $count, $replaceRoot/$replaceWith,
 * $sortByCount. Ported from the official MongoDB manual examples.
 *
 * Sources:
 *   $replaceRoot: https://www.mongodb.com/docs/manual/reference/operator/aggregation/replaceRoot/
 *   $sortByCount: https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/
 *   $count:       https://www.mongodb.com/docs/manual/reference/operator/aggregation/count/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');


describe('# reshaping stages - mongo docs', function () {

  describe('# $unset', function () {
    it('# removes a single field', function () {
      expect(mm.aggregate([ { _id: 1, a: 1, b: 2 } ], [ { $unset: 'b' } ]))
        .eql([ { _id: 1, a: 1 } ]);
    });
    it('# removes a list of fields', function () {
      expect(mm.aggregate([ { _id: 1, a: 1, b: 2, c: 3 } ], [ { $unset: [ 'b', 'c' ] } ]))
        .eql([ { _id: 1, a: 1 } ]);
    });
  });

  describe('# $count', function () {
    it('# outputs a single document with the count', function () {
      expect(mm.aggregate([ { a: 1 }, { a: 2 }, { a: 3 } ], [ { $count: 'total' } ]))
        .eql([ { total: 3 } ]);
    });
  });

  describe('# $replaceRoot', function () {
    var people = [
      { _id: 1, name: 'Arlene', age: 34, pets: { dogs: 2, cats: 1 } },
      { _id: 2, name: 'Sam', age: 41, pets: { cats: 1, fish: 3 } },
      { _id: 3, name: 'Maria', age: 25 },
    ];

    it('# promotes a merged document to the root', function () {
      var res = mm.aggregate(people, [ { $replaceRoot: { newRoot: {
        $mergeObjects: [ { dogs: 0, cats: 0, birds: 0, fish: 0 }, '$pets' ],
      } } } ]);
      expect(res).eql([
        { dogs: 2, cats: 1, birds: 0, fish: 0 },
        { dogs: 0, cats: 1, birds: 0, fish: 3 },
        { dogs: 0, cats: 0, birds: 0, fish: 0 },
      ]);
    });

    it('# $replaceWith promotes a sub-document (alias)', function () {
      expect(mm.aggregate([ { _id: 1, sub: { x: 1, y: 2 } } ], [ { $replaceWith: '$sub' } ]))
        .eql([ { x: 1, y: 2 } ]);
    });
  });

  describe('# $sortByCount', function () {
    var exhibits = [
      { _id: 1, tags: [ 'painting', 'satire', 'Expressionism' ] },
      { _id: 2, tags: [ 'woodcut', 'Expressionism' ] },
      { _id: 3, tags: [ 'oil', 'Surrealism', 'painting' ] },
      { _id: 5, tags: [ 'Surrealism', 'painting', 'oil' ] },
      { _id: 6, tags: [ 'oil', 'painting', 'abstract' ] },
      { _id: 7, tags: [ 'Expressionism', 'painting', 'oil' ] },
      { _id: 8, tags: [ 'abstract', 'painting' ] },
    ];

    it('# groups by value and sorts by count descending', function () {
      var res = mm.aggregate(exhibits, [ { $unwind: '$tags' }, { $sortByCount: '$tags' } ]);
      // Top counts are deterministic; ties (count 2 / count 1) may order arbitrarily.
      expect(res[0]).eql({ _id: 'painting', count: 6 });
      expect(res[1]).eql({ _id: 'oil', count: 4 });
      expect(res[2]).eql({ _id: 'Expressionism', count: 3 });
      expect(res).length(7);
    });
  });

});
