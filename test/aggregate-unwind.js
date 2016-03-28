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

var mm = require('../lib/');


describe('# aggregate', function() {

  describe('# _parseFieldPath()', function() {

    it('# not a string', function() {
      expect(function() {
        mm._parseFieldPath( 1 );
      }).throw(Error);
    });

    it('# not starts with $', function() {
      expect(function() {
        mm._parseFieldPath( 'abc' );
      }).throw(Error);
    });

    it('# removes $', function() {
      expect(
        mm._parseFieldPath( '$abc' )
      ).eql( 'abc');
    });

  });

  describe('# $unwind', function() {

    it('# not array', function() {
      var a = [
        { a: {} }
      ];
      //var stage = { $unwind: '$a' };

      expect(function() {
        mm._aggregateStageOps.$unwind(a, '$a');
      }).throw(Error);
    });

    it('# empty array', function() {
      var a = [
        { a: [] }
      ];
      //var stage = { $unwind: '$a' };
      var r = [];

      expect(
        mm._aggregateStageOps.$unwind(a, '$a')
      ).eql(r);
    });

    it('# array of scalars', function() {
      var a = [
        { a: [ 1, 2, 3 ] }
      ];
      var r = [
        { a: 1 },
        { a: 2 },
        { a: 3 },
      ];
      expect(
        mm._aggregateStageOps.$unwind(a, '$a')
      ).eql(r);
    });

    it('# array of scalars - several elements in collection', function() {
      var a = [
        { a: [] },
        { a: [ 1 ] },
        { a: [ 2, 3 ] },
      ];
      //var stage = { $unwind: '$a' };
      var r = [
        { a: 1 },
        { a: 2 },
        { a: 3 },
      ];

      expect(
        mm._aggregateStageOps.$unwind(a, '$a')
      ).eql(r);
    });

    it('# array of objects', function() {
      var a = [
        {
          a: [
            { b: 1 },
            { b: 2 },
            { b: 3 }
          ]
        }
      ];
      //var stage = { $unwind: '$a' };
      var r = [
        { a: { b: 1 } },
        { a: { b: 2 } },
        { a: { b: 3 } },
      ];

      expect(
        mm._aggregateStageOps.$unwind(a, '$a')
        //mm.aggregate(a, [
        //  stage
        //])
      ).eql(r);
    });

    it('# compound field - array of scalars', function() {
      var a = [
        {
          a: {
            b: 1,
            c: [ 1, 2, 3 ],
          }
        }
      ];
      var r = [
        { a: { b: 1, c: 1 } },
        { a: { b: 1, c: 2 } },
        { a: { b: 1, c: 3 } },
      ];
      expect(
        mm._aggregateStageOps.$unwind(a, '$a.c')
      ).eql(r);
    });

  });

});
