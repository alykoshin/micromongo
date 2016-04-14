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

//var mm = require('../lib/');
var aggregate = require('../../lib/aggregate/');


//describe('# aggregate', function() {

  describe('# aggregate $sort', function() {

    it('# one field - numerical', function() {
      var a = [
        { a:  3 },
        { a:  2 },
        { a:  1 },
      ];
      var s = { a: 1 };
      var r = [
        { a:  1 },
        { a:  2 },
        { a:  3 },
      ];
      expect(aggregate._aggregateStageOps.$sort(a, s)).eql(r);
    });

    it('# one field - compound', function() {
      var a = [
        { a:  { b: 3 } },
        { a:  { b: 2 } },
        { a:  { b: 1 } },
      ];
      var s = { 'a.b': 1 };
      var r = [
        { a:  { b: 1 } },
        { a:  { b: 2 } },
        { a:  { b: 3 } },
      ];
      expect(aggregate._aggregateStageOps.$sort(a, s)).eql(r);
    });

    it('# two fields - numerical and string', function() {
      var a = [
        { a:  2, b: 'aab' },
        { a:  2, b: 'aaa' },
        { a:  1, b: 'b' },
        { a:  1, b: 'a' },
      ];
      var s = { a: -1, b: 1 };
      var r = [
        { a:  2, b: 'aaa' },
        { a:  2, b: 'aab' },
        { a:  1, b: 'a' },
        { a:  1, b: 'b' },
      ];
      expect(aggregate._aggregateStageOps.$sort(a, s)).eql(r);
    });

    it('# array comparison');

  //});

});
