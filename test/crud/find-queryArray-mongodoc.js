/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var crud     = require('../../lib/crud/');
var ObjectId = require('../../lib/utils.js').ObjectId;


describe('# query operator array - mongo docs', function() {


  describe('# $all', function() {
    describe('# Behavior', function() {
      it('# Equivalent to $and Operation', function() {
        var a = [
          { tags: [ "abc", "def"      ] },
          { tags: [ "ssl", "def"      ] },
          { tags: [ "ssl", "security" ] },
          { tags: [ "ssl", "security", "xyz" ] },
        ];
        var q1 = { tags: { $all: [ "ssl" , "security" ] } };
        var q2 = { $and: [ { tags: "ssl" }, { tags: "security" } ] };
        var r1 = crud.find(a, q1);
        var r2 = crud.find(a, q2);
        expect(r1).eql(r2);
      });

      it.skip('# Nested Array', function() {
        var a = [
          { tags: [ ["abc", "def"            ] ] },
          { tags: [ ["ssl", "def"            ] ] },
          { tags: [ ["ssl", "security"       ] ] },
          { tags: [ ["ssl", "security", "xyz"] ] },
        ];
        var q1 = { tags: { $all: [ [ "ssl", "security" ] ] } };
        //var q1 = { tags: { $all: [ [ "ssl", "security" ] ] } };
        var q2 = { $and: [ { tags: [ "ssl", "security" ] } ] };
        //var q2 = { $and: [ { tags: [ "ssl", "security" ] } ] };
        var q3 = { tags: [ "ssl", "security" ] };
        //var q3 = { tags: [ "ssl", "security" ] };
        var r1 = crud.find(a, q1);
        //var r2 = crud.find(a, q2);
        var r3 = crud.find(a, q3);
        //expect(r1).eql(r2);
        expect(r1).eql(r3);
      });
    });

    describe('# Examples', function() {
      var inventory = [
        {
          _id: ObjectId("5234cc89687ea597eabee675"),
          code: "xyz",
          tags: [ "school", "book", "bag", "headphone", "appliance" ],
          qty: [
            { size: "S", num: 10, color: "blue" },
            { size: "M", num: 45, color: "blue" },
            { size: "L", num: 100, color: "green" }
          ]
        },
        {
          _id: ObjectId("5234cc8a687ea597eabee676"),
          code: "abc",
          tags: [ "appliance", "school", "book" ],
          qty: [
            { size: "6", num: 100, color: "green" },
            { size: "6", num: 50, color: "blue" },
            { size: "8", num: 100, color: "brown" }
          ]
        },
        {
          _id: ObjectId("5234ccb7687ea597eabee677"),
          code: "efg",
          tags: [ "school", "book" ],
          qty: [
            { size: "S", num: 10, color: "blue" },
            { size: "M", num: 100, color: "blue" },
            { size: "L", num: 100, color: "green" }
          ]
        },
        {
          _id: ObjectId("52350353b2eff1353b349de9"),
          code: "ijk",
          tags: [ "electronics", "school" ],
          qty: [
            { size: "M", num: 100, color: "green" }
          ]
        },
      ];

      it('Use $all to Match Values', function() {
        var q = { tags: { $all: [ "appliance", "school", "book" ] } };
        var r = [
          inventory[0],
          inventory[1]
        ];
        var res = crud.find(inventory, q);
        expect(r).eql(res);
      });

      it('Use $all with $elemMatch');

      it.skip('use the $all operator to select against a non-array field (1)', function() {
        var q1 = { "qty.num": { $all: [ 50 ] } };
        var r = [
          inventory[1]
        ];
        var res = crud.find(inventory, q1);
        expect(r).eql(res);
      });

      it.skip('select against a non-array field (2)', function() {
        var q2 = { "qty.num" : 50 };
        var r = [
          inventory[1]
        ];
        var res = crud.find(inventory, q2);
        expect(r).eql(res);
      });

    });

  });

  describe('# $elemMatch', function() {

    it('# Element Match', function() {
      var scores = [
        { _id: 1, results: [ 82, 85, 88 ] },
        { _id: 2, results: [ 75, 88, 89 ] },
      ];
      var query = { results: { $elemMatch: { $gte: 80, $lt: 85 } } };
      var r = [
        scores[0]
      ];
      var res = crud.find(scores, query);
      expect(r).eql(res);
    });

    it('# Array of Embedded Documents', function() {

      var survey = [
        { _id: 1, results: [ { product: "abc", score: 10 }, { product: "xyz", score: 5 } ] },
        { _id: 2, results: [ { product: "abc", score:  8 }, { product: "xyz", score: 7 } ] },
        { _id: 3, results: [ { product: "abc", score:  7 }, { product: "xyz", score: 8 } ] },
      ];
      var query = { results: { $elemMatch: { product: "xyz", score: { $gte: 8 } } } };
      var r = [
        survey[2]
      ];
      var res = crud.find(survey, query);
      expect(r).eql(res);
    });

    it.skip('# Single Query Condition', function() {
      var survey = [
        { _id: 1, results: [ { product: "abc", score: 10 }, { product: "xyz", score: 5 } ] },
        { _id: 2, results: [ { product: "abc", score:  8 }, { product: "xyz", score: 7 } ] },
        { _id: 3, results: [ { product: "abc", score:  7 }, { product: "xyz", score: 8 } ] },
      ];
      var q1 = { results: { $elemMatch: { product: "xyz" } } };
      var q2 = { "results.product": "xyz" };

      var r1 = crud.find(survey, q1);
      var r2 = crud.find(survey, q2);
      expect(r1).eql(r2);
    });

  });


  describe('# $size', function() {
    var collection = [
      { field: [ 'red', 'green' ] },
      { field: [ 'apple', 'lime' ] },
      { field: 'fruit' },
      { field: [ 'orange', 'lemon', 'grapefruit' ] }
    ];
    it('# $size:2', function() {
      var query = { field: { $size: 2 } };
      expect( crud.find(collection, query) ).eql([ collection[0], collection[1] ]);
    });
    it('# $size:1', function() {
      var query = { field: { $size: 1 } };
      expect( crud.find(collection, query) ).eql([]);
    });
  });


});
