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


//describe('# aggregate', function() {

  describe('# aggregate $project', function() {

    var a = [
      { a:  1, b:  1 },
      { a:  2, b:  2 },
      { a:  3, b:  3 },
    ];

    it('# basic', function() {
      var p = { a: 1 };
      var r = [
        { a:  1 },
        { a:  2 },
        { a:  3 },
      ];
      expect(aggregate._aggregateStageOps.$project(a, p)).eql(r);
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
