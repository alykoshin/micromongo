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

//var mm = require('../../lib/');
var aggregate = require('../../lib/aggregate/');


//describe('# aggregate', function() {

  describe('# aggregate _parseFieldPath()', function() {

    it('# not a string', function() {
      expect(function() {
        aggregate._parseFieldPath( 1 );
      }).throw(Error);
    });

    it('# not starts with $', function() {
      expect(function() {
        aggregate._parseFieldPath( 'abc' );
      }).throw(Error);
    });

    it('# removes $', function() {
      expect(
        aggregate._parseFieldPath( '$abc' )
      ).eql( 'abc');
    });

  });

  describe('# aggregate $unwind', function() {

    it('# not array', function() {
      var a = [
        { a: {} }
      ];
      //var stage = { $unwind: '$a' };

      expect(function() {
        aggregate._aggregateStageOps.$unwind(a, '$a');
      }).throw(Error);
    });

    it('# empty array', function() {
      var a = [
        { a: [] }
      ];
      //var stage = { $unwind: '$a' };
      var r = [];

      expect(
        aggregate._aggregateStageOps.$unwind(a, '$a')
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
        aggregate._aggregateStageOps.$unwind(a, '$a')
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
        aggregate._aggregateStageOps.$unwind(a, '$a')
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
        aggregate._aggregateStageOps.$unwind(a, '$a')
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
        aggregate._aggregateStageOps.$unwind(a, '$a.c')
      ).eql(r);
    });

    describe('# preserveNullAndEmptyArrays', function() {
      var a = [
        {
          a: undefined,
          b: null,
          c: [],
        }
      ];

      it('# undefined field', function() {
        var r = a;
        expect(
          aggregate._aggregateStageOps.$unwind(a, { path: '$a', preserveNullAndEmptyArrays: true })
        ).eql(r);
      });

      it('# null field', function() {
        var r = a;
        expect(
          aggregate._aggregateStageOps.$unwind(a, { path: '$a', preserveNullAndEmptyArrays: true })
        ).eql(r);
      });

      it('# empty array', function() {
        var r = a;
        expect(
          aggregate._aggregateStageOps.$unwind(a, { path: '$a', preserveNullAndEmptyArrays: true })
        ).eql(r);
      });

    });

    describe('# includeArrayIndex', function() {
      var a = [
        {
          a: [ 'a', 'b', 'c' ],
        }
      ];

      it('# undefined field', function() {
        var r = [
          { a: 'a', i: 0 },
          { a: 'b', i: 1 },
          { a: 'c', i: 2 },
        ];
        expect(
          aggregate._aggregateStageOps.$unwind(a, { path: '$a', includeArrayIndex: 'i' })
        ).eql(r);
      });

    });

  //});


});
