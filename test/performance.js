/**
 * Created by alykoshin on 25.03.16.
 */

// https://docs.mongodb.org/v3.2/reference/method/db.collection.count/


/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, afterEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var mm = require('../lib/');


describe('#performance', function() {

  var msStart;

  var _sampleArr = function(count, oSample) {
    var aSample = [];
    for (var i=0; i<count; ++i) {
      aSample.push(oSample);
    }
    return aSample;
  };

  var sampleArr = function(count) {
    return _sampleArr(count, {
      a: Math.random*100,
      b: Math.random*100,
    });
  };

  var testHuge = function(count, fn) {
    var a = sampleArr(count);
    //var q = { a: 1, b: 1 };
    //var e = methodName === 'find' ? a : count; // find() will return copy of array, count() - number of elements

    msStart = Date.now();
    //var r = mm[methodName]( a, q );
    fn(a);
    console.log('Processed '+count+' elements - Elapsed: '+(Date.now()-msStart)+' ms');

    // deep comparision takes a lot of time !!!
    //expect(r).eql(e);
  };

  //

  it('# count 1000 elements', function() {
    //testHuge(1000, function(a) { mm.count(a,{a:1,b:1}); });
    testHuge(1000, function(a) { mm.count(a,{a:{$lt:50},b:{$gt:50}}); });
  });

  it.skip('#count 10000 elements', function() {
    //testHuge(10000, function(a) { mm.count(a,{a:1,b:1}); });
    testHuge(10000, function(a) { mm.count(a,{a:{$lt:50},b:{$gt:50}}); });
  });

  it.skip('# count 100000 elements', function() {
    //testHuge(10000, function(a) { mm.count(a,{a:1,b:1}); });
    testHuge(100000, function(a) { mm.count(a,{a:{$lt:50},b:{$gt:50}}); });
  });

  //

  it('# find 1000 elements', function() {
    //testHuge(1000, function(a) { mm.find(a,{a:1,b:1}); });
    testHuge(1000, function(a) { mm.find(a,{a:{$lt:50},b:{$gt:50}}); });
  });

  it.skip('# find 10000 elements', function() {
    //testHuge(10000, function(a) { mm.find(a,{a:1,b:1}); });
    testHuge(10000, function(a) { mm.find(a,{a:{$lt:50},b:{$gt:50}}); });
  });

  it.skip('# find 100000 elements', function() {
    this.timeout(10000);
    //testHuge(100000, function(a) { mm.find(a,{a:1,b:1}); });
    testHuge(100000, function(a) { mm.find(a,{a:{$lt:50},b:{$gt:50}}); });
  });

  //

  it('# sort 1000 elements', function() {
    testHuge(1000, function(a) { mm.aggregate(a, [{$sort: {a:1,b:1}}]); });
  });

  it.skip('# sort 10000 elements', function() {
    testHuge(10000, function(a) { mm.aggregate(a, [{$sort: {a:1,b:1}}]); });
  });

  it.skip('# sort 100000 elements', function() {
    this.timeout(10000);
    testHuge(100000, function(a) { mm.aggregate(a, [{$sort: {a:1,b:1}}]); });
  });

  //

  if (process.version < 'v5.3.0') {

    it('# node version < v5.3.0 (slow implementation) - find $where 50 elements', function () {
      this.timeout(10000);
      testHuge(50, function (a) { mm.find(a, { $where: "this.a>=50" }); });
    });

  } else {

    it('# node version >= v5.3.0 - find $where 1000 elements', function() {
      testHuge(1000, function(a) { mm.find(a, { $where: "this.a>=50" } ); });
    });

    it.skip('# node version >= v5.3.0 - find $where 5000 elements', function() {
      this.timeout(10000);
      testHuge(5000, function(a) { mm.find(a, { $where: "this.a>=50" } ); });
    });

  }

});
