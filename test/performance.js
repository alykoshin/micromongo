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
    return _sampleArr(count, { a: 1, b: 1 })
  };

  var testHuge = function(methodName, count) {
    var a = sampleArr(count);
    var q = { a: 1, b: 1 };
    var e = methodName === 'find' ? a : count; // find() will return copy of array, count() - number of elements

    msStart = Date.now();
    var r = mm[methodName]( a, q );
    console.log(methodName+' '+count+' elements - Elapsed: '+(Date.now()-msStart)+' ms');

    // deep comparision takes a lot of time !!!
    //expect(r).eql(e);
  };


  it('#count 1000 elements', function() {
    testHuge('count', 1000);
  });

  it('#count 10000 elements', function() {
    testHuge('count', 10000);
  });


  it('#find 1000 elements', function() {
    testHuge('find', 1000);
  });

  it('#find 10000 elements', function() {
    this.timeout(10000);
    testHuge('find', 10000);
  });


});
