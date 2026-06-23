/**
 * Tests for mm.configure() — global default settings (Phase 1).
 */

'use strict';

/* globals describe, before, beforeEach, afterEach, after, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../lib/');
var settings = require('../lib/settings');


describe('# configure()', function () {

  afterEach(function () {
    settings.reset(); // never leak settings between tests
  });

  describe('# read / write', function () {

    it('# returns current settings (defaults) when called with no args', function () {
      expect(mm.configure()).eql({ idProjectionMongo: true, whereTimeout: 1000 });
    });

    it('# merges provided keys and returns the updated settings', function () {
      var res = mm.configure({ idProjectionMongo: false });
      expect(res).eql({ idProjectionMongo: false, whereTimeout: 1000 });
      expect(mm.configure()).eql({ idProjectionMongo: false, whereTimeout: 1000 });
    });

    it('# ignores unknown keys', function () {
      mm.configure({ nope: 123 });
      expect(mm.configure()).eql({ idProjectionMongo: true, whereTimeout: 1000 });
    });

    it('# coerces idProjectionMongo to boolean', function () {
      mm.configure({ idProjectionMongo: 0 });
      expect(mm.configure().idProjectionMongo).eql(false);
    });

    it('# reset() restores defaults', function () {
      mm.configure({ idProjectionMongo: false, whereTimeout: 50 });
      settings.reset();
      expect(mm.configure()).eql({ idProjectionMongo: true, whereTimeout: 1000 });
    });

  });

  describe('# idProjectionMongo affects projection', function () {

    var a = [ { _id: 1, name: 'x', age: 5 } ];

    it('# default (true): _id auto-included in inclusion projection', function () {
      expect(mm.find(a, {}, { name: 1 })).eql([ { _id: 1, name: 'x' } ]);
    });

    it('# false: _id treated as a normal field (not auto-included)', function () {
      mm.configure({ idProjectionMongo: false });
      expect(mm.find(a, {}, { name: 1 })).eql([ { name: 'x' } ]);
    });

    it('# false: _id can still be explicitly included', function () {
      mm.configure({ idProjectionMongo: false });
      expect(mm.find(a, {}, { _id: 1, name: 1 })).eql([ { _id: 1, name: 'x' } ]);
    });

  });

  describe('# whereTimeout is read at use', function () {

    it('# $where still evaluates with a custom timeout set', function () {
      mm.configure({ whereTimeout: 2000 });
      expect(mm.find([ { a: 5 }, { a: 1 } ], { $where: 'this.a > 2' })).eql([ { a: 5 } ]);
    });

  });

});
