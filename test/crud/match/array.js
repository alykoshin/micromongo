/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var match = require('../../../lib/crud/match');


describe('# array query operators', function() {


  describe('# $size', function() {

    describe('# normal primitive array', function() {
      it('# match', function() {
        expect(match( { a: [ 1, 2, 3 ] }, { a: { $size: 3  } } )).eql(true);
      });
      it('# not match', function() {
        expect(match( { a: [ 1, 2, 3 ] }, { a: { $size: 0  } } )).eql(false);
      });
    });


    describe('# empty array', function() {
      it('# match', function() {
        expect(match( { a: [] }, { a: { $size: 0  } } )).eql(true);
      });
      it('# not match', function() {
        expect(match( { a: [] }, { a: { $size: 1  } } )).eql(false);
      });
    });

    describe('# non-array field', function() {
      it('# undefined', function() {
        expect(match( { }, { a: { $size: 0  } } )).eql(false);
      });
      it('# null', function() {
        expect(match( { a: null }, { a: { $size: 1  } } )).eql(false);
      });
      it('# object', function() {
        expect(match( { a: {} }, { a: { $size: 1  } } )).eql(false);
      });
      it('# number', function() {
        expect(match( { a: 1 }, { a: { $size: 1  } } )).eql(false);
      });
    });

  });


});
