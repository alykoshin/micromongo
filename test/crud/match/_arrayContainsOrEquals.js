/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var _ae = require('../../../lib/crud/match')._arrayEqlOrElementEql;


describe('# _arrayEqlOrElementEql', function() {

  describe('# equals', function () {

    it('# empty', function () {
      expect(_ae([],[])).eql(true);
    });

    it('# scalars', function () {
      expect(_ae([ 1, 2 ], [ 1, 2   ])).eql(true);
      expect(_ae([ 1, 2 ], [ 1     ])).eql(false);
      expect(_ae([ 1, 2 ], [ 1, 3 ])).eql(false);
      expect(_ae([ 1, 2 ], [ 1, 2, 3 ])).eql(false);
    });

    it('# objects', function () {
      expect(_ae([ {a: 1}, {b: 2} ], [ {a: 1}, {b: 2} ])).eql(true);
      expect(_ae([ {a: 1}, {b: 3} ], [ {a: 1}, {b: 2} ])).eql(false);
      expect(_ae([ {a: 1}, {c: 2} ], [ {a: 1}, {b: 2} ])).eql(false);
    });

  });


  describe('# contains', function () {

    it('# scalars', function () {
      expect(_ae([ [ 1, 2], 3 ], [ 1, 2] )).eql(true);
      expect(_ae([ [ 1, 2], 3 ], [ 1  ] )).eql(false);
      expect(_ae([ [ 1, 2], 3 ], [ 1, 3] )).eql(false);
    });

  });


});
