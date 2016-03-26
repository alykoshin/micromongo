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
var _ = require('lodash');

var mm = require('../lib/');


describe('#delete - development', function() {
  var a;

  beforeEach(function() {
    a = [
      { a:  1, b: 1 },
      { a:  2, b: 2 },
      { a:  2, b: 3 },
      { a:  2, b: 4 },
      { a:  3, b: 5 },
    ];
    console.log('a='+JSON.stringify(a));
  });

  describe('#deleteOne', function() {

    it('# first', function() {
      var q = { a: 1 };
      var r = a.filter(function(item) { return item.a !== 1; });

      var result = mm.deleteOne( a, q );

      expect(a).eql(r);
      expect(result).eql({ deletedCount: 1 });
    });

    it('# first of several', function() {
      var q = { a: 2 };
      //var r = a.filter(function(item) { return item.a === 2; });
      var idx = _.findIndex(a, function(item) { return item.a === 2; });
      var r = a.slice();
      r.splice(idx,1);

      var result = mm.deleteOne( a, q );

      expect(a).eql(r);
      expect(result).eql({ deletedCount: 1 });
    });

    it('# last', function() {
      var q = { a: 3 };
      var r = a.filter(function(item) { return item.a !== 3; });

      var result = mm.deleteOne( a, q );

      expect(a).eql(r);
      expect(result).eql({ deletedCount: 1 });
    });

  });

  describe('# deleteMany', function() {

    it('# first', function() {
      var q = { a: 1 };
      var r = a.filter(function(item) { return item.a !== 1; });

      var result = mm.deleteMany( a, q );

      expect(a).eql(r);
      expect(result).eql({ deletedCount: 1 });
    });

    it('# several', function() {
      var q = { a: 2 };
      var r = a.filter(function(item) { return item.a !== 2; });
      console.log('r:'+JSON.stringify(r));

      var result = mm.deleteMany( a, q );

      expect(a).eql(r);
      expect(result).eql({ deletedCount: 3 });
    });

    it('# last', function() {
      var q = { a: 3 };
      var r = a.filter(function(item) { return item.a !== 3; });

      var result = mm.deleteMany( a, q );

      expect(a).eql(r);
      expect(result).eql({ deletedCount: 1 });
    });

  });


});
