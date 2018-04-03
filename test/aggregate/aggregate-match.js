/**
 * Created by alykoshin on 25.03.16.
 */

// https://docs.mongodb.org/v3.2/reference/method/db.collection.count/


/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var aggregate = require('../../lib/aggregate/');
const ObjectId = require('../../lib/utils').ObjectId;


//describe('# aggregate', function() {

describe('# aggregate $match', function() {
  //
  //var a = [
  //  { a:  1, b:  1 },
  //  { a:  2, b:  2 },
  //  { a:  3, b:  3 },
  //];
  //
  //it('# basic', function() {
  //  var p = { a: 1 };
  //  var r = [
  //    { a:  1 },
  //    { a:  2 },
  //    { a:  3 },
  //  ];
  //  expect(aggregate._aggregateStageOps.$project(a, p)).eql(r);
  //});
  describe('# examples from mongo docs (https://docs.mongodb.com/manual/reference/operator/aggregation/match/)', function() {

    const articles = [
      { "_id" : ObjectId("512bc95fe835e68f199c8686"), "author" : "dave", "score" : 80, "views" : 100 },
      { "_id" : ObjectId("512bc962e835e68f199c8687"), "author" : "dave", "score" : 85, "views" : 521 },
      { "_id" : ObjectId("55f5a192d4bede9ac365b257"), "author" : "ahn", "score" : 60, "views" : 1000 },
      { "_id" : ObjectId("55f5a192d4bede9ac365b258"), "author" : "li", "score" : 55, "views" : 5000 },
      { "_id" : ObjectId("55f5a1d3d4bede9ac365b259"), "author" : "annT", "score" : 60, "views" : 50 },
      { "_id" : ObjectId("55f5a1d3d4bede9ac365b25a"), "author" : "li", "score" : 94, "views" : 999 },
      { "_id" : ObjectId("55f5a1d3d4bede9ac365b25b"), "author" : "ty", "score" : 95, "views" : 1000 },
    ];

    it('# "Equality Match"', function() {
      const expected = [
        { "_id" : ObjectId("512bc95fe835e68f199c8686"), "author" : "dave", "score" : 80, "views" : 100 },
        { "_id" : ObjectId("512bc962e835e68f199c8687"), "author" : "dave", "score" : 85, "views" : 521 },
      ];

      const result = aggregate(articles, [
          { $match : { author : "dave" } }
        ]
      );

      expect(result).eql(expected);
    });


    it('# "Perform a Count" (without $group)', function() {
      const expected = 5;

      const result = aggregate(articles, [
          { $match: { $or: [ { score: { $gt: 70, $lt: 90 } }, { views: { $gte: 1000 } } ] } },
        ]
      );

      expect(result.length).equal(expected);
    });
  });

  //it('# 5/5', function() {
  //  //var stage = { $skip: 5 };
  //  var r = [];
  //  expect(aggregate._aggregateStageOps.$skip(a, 5)).eql(r);
  //});
  //
  //it('# 3/5', function() {
  //  //var stage = { $skip: 3 };
  //  var r = [
  //    a[ 3 ], // zero-based, points to { a: 4 }
  //    a[ 4 ], // zero-based, points to { a: 5 }
  //  ];
  //  expect(aggregate._aggregateStageOps.$skip(a, 3)).eql(r);
  //});
  //
  //it('# aggregate $skip', function() {
  //  var stage = { $skip: 3 };
  //  var r = [
  //    a[ 3 ], // zero-based, points to { a: 4 }
  //    a[ 4 ], // zero-based, points to { a: 5 }
  //  ];
  //  expect(mm.aggregate(a, [
  //    stage
  //  ])).eql(r);
  //});

  //});


});
