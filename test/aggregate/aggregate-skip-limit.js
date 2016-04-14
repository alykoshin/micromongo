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

var mm = require('../../lib/');
var aggregate = require('../../lib/aggregate/');


//describe('# aggregate', function() {

  var a = [
    { a:  1 },
    { a:  2 },
    { a:  3 },
    { a:  4 },
    { a:  5 },
  ];

  describe('# aggregate $skip', function() {

    it('# 0/5', function() {
      //var stage = { $skip: 0 };
      var r = a;
      expect(aggregate._aggregateStageOps.$skip(a, 0)).eql(r);
    });

    it('# 5/5', function() {
      //var stage = { $skip: 5 };
      var r = [];
      expect(aggregate._aggregateStageOps.$skip(a, 5)).eql(r);
    });

    it('# 3/5', function() {
      //var stage = { $skip: 3 };
      var r = [
        a[ 3 ], // zero-based, points to { a: 4 }
        a[ 4 ], // zero-based, points to { a: 5 }
      ];
      expect(aggregate._aggregateStageOps.$skip(a, 3)).eql(r);
    });

    it('# aggregate $skip', function() {
      var stage = { $skip: 3 };
      var r = [
        a[ 3 ], // zero-based, points to { a: 4 }
        a[ 4 ], // zero-based, points to { a: 5 }
      ];
      expect(mm.aggregate(a, [
        stage
      ])).eql(r);
    });

  });



  describe('# $limit', function() {

    it('# 0/5', function() {
      var stage = { $limit: 0 };
      var r = [];
      expect(mm.aggregate(a, [
        stage
      ])).eql(r);
    });

    it('# 5/5', function() {
      var stage = { $limit: 5 };
      var r = a;
      expect(mm.aggregate(a, [
        stage
      ])).eql(r);
    });

    it('# 3/5', function() {
      var stage = { $limit: 3 };
      var r = [
        a[ 0 ], // zero-based, points to { a: 0 }
        a[ 1 ],
        a[ 2 ],
      ];
      expect(mm.aggregate(a, [
        stage
      ])).eql(r);
    });

  //});



});
