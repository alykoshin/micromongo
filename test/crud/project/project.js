/**
 * Created by alykoshin on 23.03.16.
 */

'use strict';

/* globals describe, before, beforeEach, after, it */

var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');

var project = require('../../../lib/crud/project');


describe('# projection - development', function() {

  describe('# primitive projection', function() {

    describe('# doc with 1 field', function() {
      var doc = { value: 'ab' };

      it('# empty projection', function() {
        var projection = {};
        var res = { value: 'ab' };
        expect(project( doc, projection )).eql( res );
      });

      it('# inclusive all (1)', function() {
        var projection = { value: 1 };
        var res = { value: 'ab' };
        expect(project( doc, projection )).eql( res );
      });

      it('# inclusive all (true)', function() {
        var projection = { value: true };
        var res = { value: 'ab' };
        expect(project( doc, projection )).eql( res );
      });

      it('# exclusive all (0)', function() {
        var projection = { value: 0 };
        var res = {};
        expect(project( doc, projection )).eql( res );
      });

      it('# exclusive all (false)', function() {
        var projection = { value: false };
        var res = {};
        expect(project( doc, projection )).eql( res );
      });

    });

    describe('# doc with 2 fields', function() {
      var doc = { value1: 1, value2: 2 };

      it('# inclusive all', function() {
        var projection = { value1: 1, value2: 1 };
        var res = { value1: 1, value2: 2 };
        expect(project( doc, projection )).eql( res );
      });

      it('# inclusive 1st', function() {
        var projection = { value1: 1 };
        var res = { value1: 1 };
        expect(project( doc, projection )).eql( res );
      });

      it('# inclusive 2nd', function() {
        var projection = { value2: 1 };
        var res = { value2: 2 };
        expect(project( doc, projection )).eql( res );
      });


      it('# exclusive all', function() {
        var projection = { value1: 0, value2: 0 };
        var res = { };
        expect(project( doc, projection )).eql( res );
      });

      it('# exclusive 1st', function() {
        var projection = { value1: 0 };
        var res = { value2: 2 };
        expect(project( doc, projection )).eql( res );
      });

      it('# exclusive 2nd', function() {
        var projection = { value2: 0 };
        var res = { value1: 1 };
        expect(project( doc, projection )).eql( res );
      });

    });

    describe('# invalid projections', function() {
      var doc = {};

      it('# attempt inclusive/exclusive', function() {
        var projection = { value1: 0, value2: 1 };
        expect(function() {
          project( doc, projection );
        }).throw(Error);
      });

      it('# attempt exclusive/inclusive', function() {
        var projection = { value1: 1, value2: 0 };
        expect(function() {
          project( doc, projection );
        }).throw(Error);
      });

      it('# attempt invalid value', function() {
        var projection = { value: -1, value2: 0 };
        expect(function() {
          project( doc, projection );
        }).throw(Error);
      });

    });

  });


  describe('# projection for embedded documents', function() {

    var doc = { value1: { value2: 'ab' } };

    it('# inclusive', function() {
      var projection = { 'value1.value2': 1 };
      var res = { value1: { value2: 'ab' } };
      expect(project( doc, projection )).eql( res );
    });

    it('# exclusive', function() {
      var projection = { 'value1.value2': 0 };
      var res = { value1 : {} };
      expect(project( doc, projection )).eql( res );
    });

    it('# exclude parent', function() {
      var projection = { value1: 0 };
      var res = {};
      expect(project( doc, projection )).eql( res );
    });

    it('# exclude child', function() {
      var projection = { value2: 0 };
      var res = doc;
      expect(project( doc, projection )).eql( res );
    });

  });

  describe('# projection for _id', function() {
    var doc = { _id: 0, value1: 1, value2: 2 };

    it('# empty projection', function() {
      var projection = {};
      var res = { _id: 0, value1: 1, value2: 2 };
      expect(project( doc, projection )).eql( res );
    });

    describe('# scalar _id', function() {

      describe('# exclusion', function() {

        it('# exclude _id', function() {
          var projection = { _id: 0, value1: 0 };
          var res = { value2: 2 };
          expect(project( doc, projection )).eql( res );
        });

        it('# include _id', function() {
          var projection = { _id: 1, value1: 0 };
          var res = { _id: 0, value2: 2 };
          expect(project( doc, projection )).eql( res );
        });

      });

    });


    describe('# inclusion', function() {

      it('# exclude _id', function() {
        var projection = { _id: 0, value1: 1 };
        var res = { value1: 1 };
        expect(project( doc, projection )).eql( res );
      });

      it('# include _id', function() {
        var projection = { _id: 1, value1: 1 };
        var res = { _id: 0, value1: 1 };
        expect(project( doc, projection )).eql( res );
      });

    });

    describe('# object _id', function() {
      var doc = { _id: { value: 'value' }, value1: 1, value2: 2 };

      describe('# exclusion', function() {

        it('# exclude _id', function() {
          var projection = { _id: 0, value1: 0 };
          var res = { value2: 2 };
          expect(project( doc, projection )).eql( res );
        });

        it('# include _id', function() {
          var projection = { _id: 1, value1: 0 };
          var res = { _id: { value: 'value' }, value2: 2 };
          expect(project( doc, projection )).eql( res );
        });

      });

      describe('# inclusion', function() {

        it('# exclude _id', function() {
          var projection = { _id: 0, value1: 0 };
          var res = { value2: 2 };
          expect(project( doc, projection )).eql( res );
        });

        it('# include _id', function() {
          var projection = { _id: 1, value1: 0 };
          var res = { _id: { value: 'value' }, value2: 2 };
          expect(project( doc, projection )).eql( res );
        });

      });

    });

  });

});
